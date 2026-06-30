# Data Flywheel Map

> Score each loop 1-5. Your weakest loop is where competitors attack first.

## Flywheel Loops

| Loop | What It Measures | Score | Key Reasoning |
|------|------------------|-------|---------------|
| **Correction** | Do users fix AI outputs? Is that signal captured and reused? | **3/5** | Multiple capture mechanisms exist (thumbs, corrections, HITL, golden dataset promotion) but all are manual. No automated retraining. |
| **Preference** | Does the product learn individual / team preferences over time? | **3/5** | Static profiles + short-term RAG memory. No automated fact extraction from chat. Preferences are set once, never updated. |
| **Domain Context** | Does usage in one area improve quality in adjacent areas? | **2/5** | Only unidirectional injection (News → Chat, Game → Chat). No reverse loops. Chat data does not improve News or Game domains. |
| **Network** | Does each new user / team make the product better for everyone? | **2/5** | Strong intra-group effects. Zero inter-group effects. Data is fully siloed. |

**Total Flywheel Score: 10/20**

**Weakest Loop:** Domain Context + Network (tied at 2/5)

---

### Correction Loop — 3/5

*Do users fix AI outputs? Is that signal captured and reused?*

**What the system captures today:**

The correction loop has **three capture mechanisms**, not one:

1. **ChatbotFeedback (thumbs up/down).** Users rate bot responses 1-5 stars via `routes/chatbotFeedback.js`. Rating 1-2 optionally includes a reason (`incorrect`, `not_helpful`, `off_topic`, `rude`, `other`). Rating 1-2 auto-creates a `HumanReview` entry. Rating 4-5 where the Judge disagreed also creates a review (judge calibration signal).

2. **Conversational Correction Detection.** `messageHandler.js:69-127` automatically detects when a user is correcting the bot in natural conversation. A fast pre-filter checks for correction markers (`"no es así"`, `"te equivocas"`, `"corrige"`). If triggered, a Groq call confirms whether this is a correction and extracts the corrected text. The result is saved to the `Correction` model with original response, corrected text, group, personality, judge scores, and detector confidence.

3. **HumanReview Queue.** `routes/devDashboard.js:683-848` provides a full HITL workflow: pending queue, verdict submission (pass/fail with confidence), and promotion to golden dataset. `routes/corrections.js:132-162` provides the same promotion path for corrections.

**What the system does not do (why it stays at 3):**

All reuse is **manual**. A developer must:
- Open the HITL queue in the dev dashboard
- Review each pending correction or feedback
- Submit a verdict
- Click "promote to golden dataset"

There is no automated pipeline that:
- Injects top upvoted past interactions into the prompt as few-shot examples (level 4)
- Runs periodic DPO/LoRA fine-tuning on accumulated corrections (level 5)
- Automatically deploys improved model weights

**The scale:**

| Level | Description | Status |
|-------|-------------|--------|
| 1 — No Capture | Bot speaks into the void | ✅ Past |
| 2 — Passive Capture | Prompts are logged but users can't rate | ✅ Past |
| **3 — Active Capture for Manual Review** | Thumbs up/down + correction detection + HITL + golden dataset promotion | **📍 Here** |
| 4 — Dynamic Few-Shot Injection | Top upvoted interactions injected as prompt examples | ❌ Not done |
| 5 — Automated Retraining | Periodic DPO/LoRA on accumulated data, auto-deployed | ❌ Not done (planned post-WC) |

---

### Preference Loop — 3/5

*Does the product learn individual / team preferences over time?*

**What the system captures today:**

1. **Static profile fields**: Each user has `likes: [String]`, `dislikes: [String]`, `humor_style: String` (sarcastic, friendly, epic, serious, troll), `ai_personality: String` (7 options). These are set manually by the user through the profile screen and read by the bot on every interaction.

2. **Short-term RAG memory**: The last 30 messages in the group mentioning the player are retrieved as `chatContext` and injected into the bot's prompt. This gives the bot awareness of recent banter and inside jokes, but the context window is limited — older messages fall out.

3. **Repetition avoidance**: The last 3 bot outputs per personality are tracked to prevent catchphrase repetition. This is a local anti-spam mechanism, not a learning loop.

**What the system does not do:**

- **No automated fact extraction.** If a user says "I hate the French team" in chat, the bot remembers it via RAG for a few hours but does not permanently append `dislikes: ['France']` to that user's profile. A background cron job that analyzes daily chat logs and updates user profiles does not exist.

- **No long-term preference learning.** Humor style and personality are set once during onboarding. They are never adjusted based on which responses the user upvotes or which personalities they interact with most.

- **No group-level preference adaptation.** Group A might love dark humor while Group B hates it. The same system prompt is used for every group with the same personality. There is no per-group preference model.

**The scale:**

| Level | Description | Status |
|-------|-------------|--------|
| 1 — Stateless | Bot has no idea who is talking | ✅ Past |
| 2 — Static Profiling | Bot reads DB fields (name, points) but has no chat memory | ✅ Past |
| **3 — Short-Term RAG** | Bot reads recent chat window for context. Feels personalized but learning degrades as messages age out | **📍 Here** |
| 4 — Automated Fact Extraction | Background task analyzes chat logs and permanently updates user profiles with new likes/dislikes | ❌ Not done |
| 5 — Deep Personalization | Bot adjusts its own style per group based on accumulated feedback without developer intervention | ❌ Not done |

---

### Domain Context Loop — 2/5

*Does usage in one area improve quality in adjacent areas?*

**Current data flows:**

All flows are **unidirectional**. Data feeds into the Chat domain but never flows back out.

```
News Domain (RSS) ────► Chat Domain   ✅  Breaking news injected as webContext into bot prompt
Game Domain (leaderboard) ──► Chat   ✅  Player stats, points, positions injected into bot prompt
Chat Domain ──► News Domain          ❌  RSS uses static keywords (config.js:92-100). Chat discussions
                                       about specific teams do not update RSS filters.
Chat Domain ──► Game Domain          ❌  Banter does not affect predictions. No auto-fill, no prop bets,
                                       no match recommendations based on chat history.
Group A ──► Group B                  ❌  Data is fully siloed per group. An upvoted correction in Group A
                                       does not improve the experience for Group B.
```

**The "personalized breaking news" feature is aspirational, not in the codebase.**

The RSS feed searches for a hardcoded list of `worldCupKeywords` ('mundial', 'world cup', 'fifa', 'selección', 'gol', 'lesión', 'favorito', etc.). It does not:
- Read group chat data to identify which specific teams/users care about
- Dynamically update its keyword filters based on group conversations
- Send targeted news to Group A about Argentina because they talk about Argentina

To implement this, you would need a cron job that analyzes recent group chat for mentioned teams/players and updates a per-group keyword filter in the RSS service. This is feasible but does not exist today.

**The scale:**

| Level | Description | Status |
|-------|-------------|--------|
| 1 — Siloed | Chat is chat. Predictions are a spreadsheet. They don't talk to each other | ✅ Past |
| **2 — Unidirectional Injection** | Data from News and Game domains feeds Chat. Chat does not improve News or Game | **📍 Here** |
| 3 — Basic Cross-Pollination | Chat usage affects the UI (e.g., debated teams highlighted on prediction screen) | ❌ Not done |
| 4 — Strong Cross-Domain Loop | RSS dynamically adjusts filters based on group predictions. Chat upvotes improve game mechanics | ❌ Not done |
| 5 — Deep Cross-Domain Transfer | Entire app is a personalized organism. All domains mutually improve each other | ❌ Not done |

---

### Network Loop — 2/5

*Does each new user / team make the product better for everyone?*

**Current state:**

| Effect | Exists? | How |
|--------|---------|-----|
| Intra-group | ✅ Yes | Adding User B to a group makes the game better for that group (more competition, more chat context for the bot) |
| Inter-group | ❌ No | 1,000 groups in Argentina and 1,000 groups in Spain are completely siloed. No data, no model improvements, no aggregated insights flow between groups |

**Does the fine-tuning plan change this score? Not yet.**

The plan to fine-tune an 8B model on accumulated AILogs will eventually create inter-group effects — what Group A upvotes will improve the model for Group B. But:
- Data collection only begins when the tournament starts
- Fine-tuning requires 2,000+ quality entries, which will take most of the 40-day tournament to accumulate
- Training and deployment happen after the World Cup
- The improved model serves the next tournament, not this one

For the current tournament, the network loop remains at 2/5. It will move to 3/5 only when the fine-tuned model is deployed for a future event.

**The scale:**

| Level | Description | Status |
|-------|-------------|--------|
| 1 — Isolated | Single-player tool. New users add zero value | ✅ Past |
| **2 — Local Network Effects** | Multiplayer game in private rooms. A new user benefits only their group | **📍 Here** |
| 3 — Aggregated Network Effects | Stranger data is anonymized and aggregated (e.g., "82% of users picked Spain to win") | ❌ Not done |
| 4 — AI-Driven Network Effects | Every interaction from any user improves the model for everyone (fine-tuned model serving all groups) | ❌ Not done (planned post-WC) |
| 5 — Marketplace Network Effects | True exponential value. Every user increases liquidity or matching | ❌ Not applicable |

---

## Encroachment Threat Assessment

### 1. Platform Encroachment
**Attacker:** Meta (WhatsApp) / Apple (Apple Intelligence)
**Vector:** Native, multimodal AI agents embedded directly into the OS or default group chats. A user types in their existing WhatsApp group: "@MetaAI, we are doing a World Cup pool. Keep track of our scores and roast us like Andrés Montes."
**Time-to-threat:** 1-2 years. The agents are rolling out now, but prompt-engineering a stateful, math-heavy game with perfect recall in a chaotic group chat is still highly error-prone.
**% of value at risk:** 30-40%. You survive because of dedicated UI. People want a visual, clickable leaderboard and dedicated prediction screens, not an endless wall of text trying to verify if the AI did the math right.

### 2. Vertical Competitor
**Attacker:** Sleeper (or ESPN / Yahoo Fantasy)
**Vector:** The incumbent in social fantasy sports. They already own the friend-group social graph, real-time sports data feeds, and group chat infrastructure. They integrate an AI API to create an "AI Commish" that roasts their users.
**Time-to-threat:** 6-12 months. Sleeper has the engineering velocity to build this in a single sprint.
**% of value at risk:** 90-100%. Existential. If your target audience is already on Sleeper and they launch an identical AI-banter World Cup pool, the friction for users to download your standalone app becomes insurmountable.

### 3. Adjacent Expansion
**Attacker:** Telegram (via Mini-App / Bot Developers)
**Vector:** Frictionless distribution. An indie developer builds your product as a "Telegram Mini App." Friend groups already talk on Telegram — they don't need to download a new app. They just add the bot to the group.
**Time-to-threat:** 3-6 months. Telegram's bot and WebApp APIs are extremely mature.
**% of value at risk:** 70-80%. This attacks your biggest weakness: Go-To-Market Friction. Getting 10 friends to install the same app is the hardest part of a multiplayer app. The adjacent attacker bypasses your entire acquisition funnel.

---

## 90-Day Encroachment Plan

**Attacker:** Meta (WhatsApp + Meta AI)

**Attack vector (targets your weakest loop):** Go-To-Market Friction. In a multiplayer app, the "Alpha" friend has to convince 10 friends to download a new app. Meta attacks this by launching the feature where the group already lives.

**Weeks 1-4 — what they ship:** Meta rolls out "WhatsApp Sports Bots" powered by Llama 3. Any user types `@MetaAI start a World Cup pool` in their existing group chat. WhatsApp pins a lightweight native leaderboard to the top of the chat. The AI announces matches and roasts whoever is in last place.

**Weeks 5-8 — how they poach users:** The World Cup is one week away. The "Alpha" friend tries to get everyone to download Agente Mundial. Three friends complain about downloading another app. The Alpha gives up, types `@MetaAI` in their existing group, and the pool is set up in 4 seconds. You lose the entire group before the first match.

**Weeks 9-12 — why users don't come back:** The tournament is in the knockout stages. The game is stateful — accumulated points, banter history, and rivalries exist in WhatsApp. Moving a live prediction pool to a third-party is impossible. They are locked in.

**Your defense:**

- **The Brand Safety Moat.** Meta AI is RLHF'd to be polite and universally inoffensive. Your AI (Tomás Roncero, Darth Vader) is specifically prompted to be dramatic, aggressive, and culturally unhinged. Meta won't let their AI be mean enough to be genuinely funny. You win on humor quality.

- **Dedicated UX.** A WhatsApp chat thread is a terrible interface for stats. Your app has a dedicated UI for tracking plenos, honor points, and group rankings that a pinned chat message cannot replicate.

- **The Sanctuary Argument.** Many groups want a dedicated app for betting pools to separate game noise from daily life/work messages. Position Agente Mundial as the "Sports Bar" away from the main inbox.

5. Adjacent Expansion
Attacker: Telegram (via Mini-App / Bot Developers)
Vector: Frictionless distribution. An indie developer builds exactly what you have built, but as a "Telegram Mini App." Because friend groups already talk on Telegram, they don't have to convince their friends to download a new app or create new accounts. They just add the bot to the group, and the UI opens instantly within the chat.
Time-to-threat: 3-6 months. (Telegram's bot and WebApp APIs are extremely mature, and developers are flooding the ecosystem right now).
% of value at risk: 70% - 80%. This attacks your biggest weakness: Go-To-Market Friction. In a B2B2C/Multiplayer app, the hardest part is getting 10 friends to install the same app. By expanding into the chat app where the friends already live, the adjacent attacker bypasses your entire acquisition funnel.




---

## 90-Day Encroachment Plan

*Your partner played the Big Tech attacker. What was their plan to kill you?*


Attacker: Meta (WhatsApp + Meta AI)

Attack vector (target the weakest loop): Your weakest loop is Go-To-Market Friction. In a multiplayer app, the "Alpha" friend has to convince 10 lazy friends to download a brand new app, create accounts, and learn a new UI. Meta attacks this friction by launching the feature exactly where the friend group already lives.

Weeks 1-4 - what they ship: Meta rolls out "WhatsApp Sports Bots" natively in the app, powered by Llama 3. Any user can type @MetaAI start a World Cup prediction pool in this chat. WhatsApp instantly pins a lightweight, native leaderboard to the top of the group chat. The AI is programmed to automatically announce the daily matches and gently roast whoever is in last place.

Weeks 5-8 - how they poach users: The World Cup is one week away. The "Alpha" friend in the group tries to get everyone to download "Agente Mundial," but three friends complain about downloading another app. The Alpha friend gives up, types @MetaAI in their existing group, and the pool is set up in 4 seconds. You lose the entire group before the first match kicks off.

Weeks 9-12 - why users don't come back: The tournament is now in the knockout stages. The game is highly stateful. The friends have accumulated points, a rich history of banter in the chat, and established rivalries. Moving a live, mid-tournament prediction pool to a third-party app is impossible. They are permanently locked into WhatsApp for the duration of the event.

Your defense: Meta is a massive, horizontal monopoly. They build tools that must work safely for 3 billion people. Your defense relies entirely on being hyper-vertical, gamified, and culturally unhinged.

The "Brand Safety" Moat: Meta AI is heavily RLHF'd to be polite, safe, and universally inoffensive. Your AI (Tomás Roncero, Darth Vader) is specifically prompted to be dramatic, aggressive, and highly culturally specific. People play these games to laugh at their friends; Meta won't let their AI be mean enough to be genuinely funny. You win on the humor quality.
Dedicated UX: A WhatsApp chat thread is a terrible interface for viewing complex stats. Your app has a beautiful, dedicated UI for tracking plenos (exact hits), honor points, and group rankings that a simple pinned chat message can't replicate.
The "Sanctuary" Argument: Many friend groups actually want a dedicated app for their betting pools to separate the noise of the game from their daily life/work WhatsApp messages. You position Agente Mundial as the dedicated "Sports Bar" away from the noise of their main inbox.
