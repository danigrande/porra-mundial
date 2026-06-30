# Compounding System Design — Porra Mundial 2026

---

## Feedback Loops

| Loop | Iteration 1 → Iteration n | Compounds? | Status | Correction vs Original |
|------|--------------------------|-----------|--------|----------------------|
| **Quality Gate** | Judge gives feedback → response corrected. Feedback from n-1 injected as `⚠️ CORRECCIÓN REQUERIDA` block in user prompt for n. | ✅ Yes — each attempt (max 3) learns from the last | ✅ Live | Original was accurate. Added detail: feedback goes into **user prompt** (not system prompt). |
| **HITL → Golden Dataset** | Human reviews force-approved or downvoted response → manually promotes to `local_overrides.json`. Eval runner merges overrides into personality + intent datasets. | ⚠️ No — fully manual two-step (verdict then promote). `local_overrides.json` is gitignored — lost on redeploy. Only `intent`/`personality` types loaded. | ⚠️ Manual | Original claimed "self-expands" — **wrong**. It's a manual process with persistence gaps. |
| **RAG Context** | New message → `vectorizeMessage()` stores embedding on Message document. `semanticSearchContextForPlayer()` queries by cosine similarity with regex fallback. | ⚠️ Partial — embeddings are stored AND queried via `semanticSearchContextForPlayer()` (cosine similarity, fallback to `$regex`). `vectorizeMessage()` writes embeddings; `retrieveContextForPlayer()` (regex-only) is now the fallback path. | ⚠️ Limited | Original claimed "context grows with each interaction" — context grows, and vector search exists, but per-group silo and regex fallback limit effectiveness. |
| **Per-personality eval thresholds** | Global `purity=8, quality=6` applied uniformly to all 7 personalities × 14 languages. | ✅ Yes — once implemented: Roncero/ES gets `quality=5`, all transcreation languages get `purity=7`. Resolved via `(personalityId, targetLanguage)` key in `config.evals.thresholds.overrides`. | 🔲 Todo | Replaces fictional Meta-Judge row. Closes SILO #5. |
| **Response → Catchphrase → Prompt** | Full response texts stored in cross-group in-memory Map (max 3 per personalityId). Fed into `buildAnchorBlock()` as "RECENTLY USED catchphrases (AVOID these now)". | ⚠️ Partially — FIFO eviction forces variety, but stores full responses not catchphrase tokens. No TTL, no banned list. | ⚠️ In-memory only | Original said "list grows → bot forced to innovate" — **wrong**. No "banned list" or exhaustion mechanism. |

### Connectivity Map

```
                          ┌──────────────────────┐
                          │   RAG (always) ───────┤
                          │  semanticSearch →      │
                          │  cosine sim + regex    │── SILO #2 (per-group)
                          │  fallback              │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Web Search (added)   │
                          │  conditional on       │
                          │  intent === factual   │
                          └──────────┬───────────┘
                                     │
                  ┌──────────────────▼──────────────┐
                  │     messageHandler.js            │
                  │  unifies RAG + Web Search        │
                  │  both pass through to context    │
                  │  no cross-group context          │── SILO #2
                  └──────────┬───────────────────────┘
                             │
                  ┌──────────▼──────────────────┐
                  │      groqEngine.js           │
                  │  stateless per-call          │── SILO #12 (no multi-turn memory)
                  │  catchphrases cross-group ✅ │
                  │  recentBotOutputs in-memory  │
                  └──────────┬──────────────────┘
                             │
               ┌─────────────▼─────────────┐
               │      judgeService.js       │
               │  completely stateless       │── SILO #4 (no cross-request memory)
               │  same thresholds for all    │── SILO #5 (global purity=8, quality=6)
               └──────────┬─────────────────┘
                          │
               ┌──────────▼──────────────────┐
               │  transcreationService.js     │
               │  stateless, no cache/memory  │── SILO #6
               │  2 retries, no feedback inj  │
               └─────────────────────────────┘

    ┌────────────┐    ┌────────────┐    ┌────────────┐
    │  RAG       │    │  Anchors   │    │ Language   │
    │  SILO #2   │    │  SILO #8   │    │  SILO #7   │
    │  per-group │    │  hardcoded │    │  no memory │
    │  regex     │    │  global    │    │  per-msg   │
    │  fallback  │    │  no group  │    │  detection │
    │  + semantic│    │  override  │    │            │
    └────────────┘    └────────────┘    └────────────┘

                    ┌─────────────────────────┐
                    │       MongoDB             │
                    │  AILog ← write-only       │
                    │  Feedback ← forward link  │── SILO #10 (partial: ChatbotFeedback has
                    │    to AILog (aiLogId) ✅  │    aiLogId, but AILog lacks feedbackId)
                    │  HITL ← linked ✅         │
                    │  Golden Dataset ✅        │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  devDashboard.js         │
                    │  SILO #9: per-personality│
                    │  but NOT per-group evals │
                    │  SILO #10: partial       │
                    │  Feedback↔AILog view     │
                    └─────────────────────────┘
```

---

## Context Connectivity — Flows

| Flow | Source → Target | What Travels | Mechanism | Persistence | Status |
|------|----------------|-------------|-----------|-------------|--------|
| User → Bot | Message → messageHandler → groqEngine | Text, userId, groupName, game state, RAG (semantic + regex fallback), Tavily web search (added on top, not mutually exclusive) | Socket.IO + function params | Ephemeral | ✅ Live |
| Game State → Bot | DB → scoringEngine → leaderboard → system prompt | Rankings, points, exact hits, match drama | Cache (30s TTL) + template injection | Ephemeral (TTL) | ✅ Live |
| Chat History → Bot | Message collection → `retrieveContextForPlayer()` → system prompt | Raw chat text mentioning player (last 30 msgs via regex) | `$regex` on chatId + senderName + text | Persistent (DB), retrieval per-request | ✅ Live (regex-only) |
| Response → Judge | groqEngine output → judgeService | Response text, system prompt, anchors, target language | LLM call (`llama-3.1-8b`) + regex fast-path script detection | Ephemeral | ✅ Live |
| Judge → Retry | Judge scores → feedback injected into user prompt for next attempt | `judgesFeedback` string (what went wrong) | Loop param (max 3 iterations), injected as correction block | Ephemeral (intra-request) | ✅ Live |
| Force-Approved → HITL | Exhausted retries → HumanReview → promote → `local_overrides.json` | Query, response, judge scores, personality | MongoDB write + file write (gitignored) | Semi-persistent (lost on redeploy) | ⚠️ Manual |
| User Downvote → HITL | ChatbotFeedback rating 1-2 → HumanReview | messageId, aiLogId, rating, reason | MongoDB | Persistent | ✅ Live |
| Feedback → LangFlow → PRD | Feedback text → LangFlow analysis → PRD document | Subject, detail, priority, acceptance criteria | LangFlow API (falls back to simulated analysis — no FLOW_ID configured) | Persistent (MongoDB) | ⚠️ Code exists, not configured |
| Benchmark → Regression Alert | EvalRun n vs n-1 → pass rate delta | Per-test pass/fail, comparison JSON | JSON comparison in memory | Persistent (runs in MongoDB) | ⚠️ Webhook is `console.log` stub |
| Catchphrases → Cross-User | User A triggers persona → `recentBotOutputs` → User B gets different phrase | Last 3 full response texts per personalityId | In-memory Map (cross-group, all users share) | ❌ Ephemeral (lost on restart) | ⚠️ In-memory only |
| Admin → Group Personality | Admin sets `ai_personality` → bot persona for the group | Personality ID → anchors + system prompt | DB field + code switch | Persistent | ✅ Live |
| Group Identity → Bot | Group name → rules, members, prediction mode, phase | Scoring rules, member list, prediction mode | DB fetch per request (30s cache) | Ephemeral | ✅ Live |
| User Correction → Dataset | LLM detects correction → Correction model → manual promote | Original response, corrected text, confidence | MongoDB | Persistent | ✅ Live (manual promote) |

---

## Silos — What's Trapped, Why It Hurts, Where

| # | Silo | What's Trapped | Why It Hurts | Files |
|---|------|---------------|-------------|-------|
| 1 | **RAG ↔ Embeddings** | `vectorizeMessage()` stores embeddings on every message, but `semanticSearchContextForPlayer()` still falls back to regex if embeddings are unavailable or messages lack embedding vectors. | Semantic search exists but reliability depends on embedding coverage. Not all messages have embedding vectors — `retrieveContextForPlayer()` (regex-only) is the fallback path. Both RAG and web search are used: RAG always fetched, web search conditionally added. | `ragService.js:23-31`, `ragService.js:126-183`, `messageHandler.js:448-473` |
| 2 | **Per-Group RAG** | Group A's messages never inform Group B's bot | Same user in 2 groups gets no cross-group continuity. RAG filters by `chatId` regex. | `ragService.js:53-62` |
| 3 | **Embeddings partial usage** | `vectorizeMessage()` stores embeddings on every message (user + bot). `semanticSearchContextForPlayer()` queries via cosine similarity with regex fallback. `retrieveContextForPlayer()` (`$regex`-only) is the fallback path when embeddings are unavailable. | Semantic search exists but its reliability depends on embedding coverage in the DB. The regex fallback (`retrieveContextForPlayer`) is still the primary path for groups where messages lack embeddings. | `ragService.js:23-31`, `ragService.js:126-183` |
| 4 | **Judge stateless** | Each `judgeResponse()` starts from zero — no memory of "this personality/language fails a lot on purity" | Same mistakes repeated across requests; no trend-based threshold adjustment. | `judgeService.js` (all 199 lines) |
| 5 | **Global eval thresholds** | `minLanguagePurity: 8`, `minQuality: 6` apply to ALL personalities and ALL languages | Transcreated Korean held to same standard as native Spanish; Roncero (hyperbole) judged same as Fabrizio Romano (factual). | `config.js:47-48`, `judgeService.js:176` |
| 6 | **No transcreation memory** | "toma, toma, toma" → Korean costs a full LLM call every time | Repeated work, no translation memory, no cache of successful adaptations. | `transcreationService.js` (all 164 lines) |
| 7 | **No user language preference** | Language re-detected from scratch every message via Unicode regex | User who always writes in Korean pays detection cost every time; no fallback. | `languageRouter.js` |
| 8 | **Anchors hardcoded** | Humor mechanisms, catchphrases, cultural domains are immutable in source | Personality tuning requires code changes; no A/B testing; no group-level personality variants. | `anchors.js` (all 155 lines) |
| 9 | **No per-group quality analytics** | `/evals/stats` groups by `$targetLanguage` and `$anchorsUsed` only — never by `groupName` | Cannot answer "which group has the best/worst bot quality?" | `devDashboard.js:275-361` |
| 10 | **Feedback↔AILog partially linked** | `ChatbotFeedback` now has `aiLogId` field (direct forward link to AILog). `AILog` still lacks `feedbackId` (no reverse link). Correlation is possible forward-only without HumanReview. | Can query "what % of downvoted responses also failed the Judge?" directly from ChatbotFeedback → AILog. Reverse query ("find all feedback for this response") still requires joining through HumanReview. | `models/ChatbotFeedback.js`, `models/AILog.js`, `routes/devDashboard.js` |
| 11 | **Group cache memory-only** | Leaderboard, rankings, profiles cached per-group with 30s TTL, stored in in-process object | Lost on server restart; no warm-up on boot. | `messageHandler.js:19-20` |
| 12 | **No multi-turn memory** | `recentBotOutputs` tracks 3 full responses per persona (cross-group), not topics or conversation state | Bot starts each exchange fresh; no multi-turn coherence beyond what RAG provides. | `groqEngine.js:27-39`, `groqEngine.js:198-256` |

---

## Fine-Tuning Data Pipeline

### Data Sources for Fine-Tuning

| Source | Schema | Signal | Auto-Label Ready? | Volume |
|--------|--------|--------|-------------------|--------|
| **AILog** (`models/AILog.js`) | Full prompt/response, Judge scores, personality, language | Judge quality (0-10) + purity (0-10) | ✅ High-confidence: passed + quality >= 8 | Every response = high volume |
| **ChatbotFeedback** (`routes/chatbotFeedback.js`) | rating 1-5, reason, linked to AILog via `aiLogId` | User's explicit quality signal | ✅ High-confidence: rating 4-5 = good, 1-2 = bad | ~1-5% of responses get rated |
| **HumanReview** (`models/HumanReview.js`) | Verdict (pass/fail + confidence), source, personality, language | Human-labeled gold data | ❌ Requires human — capped at 20/day | Reviewed subset |
| **Correction** (`models/Correction.js`) | Original response + corrected text + detector confidence | Differential pair (bad -> good) | ✅ At detectorConfidence > 0.9 | Auto-detected, potentially high |
| **Golden Dataset** (JSON files) | 102 curated test cases, 6 categories | Human-curated regression tests | ❌ Hand-crafted, grows via HITL promotion | Manual |

### Labeling Strategy at Scale

The 20/day HITL cap cannot label thousands of entries. Solution: **signal-based auto-labeling** with HITL reduced to random sampling for quality monitoring.

```
All AILogs
  +-> Judge passed AND user rated 4-5     -> auto-label GOOD (high confidence)
  +-> Judge failed AND user rated 1-2     -> auto-label BAD (high confidence)
  +-> Correction with confidence > 0.9    -> auto-approve as DPO pair
  +-> Judge passed + retry count > 1      -> auto-label GOOD (model improved with feedback)
  +-> Judge failed AND user rated 4-5     -> HITL (signal conflict -- sample only)
  +-> Force-approved (3 retries)          -> HITL (likely bad -- sample only)
```

### Automated Retraining Pipeline (Proposed)

```
Daily cron (00:00 UTC):
  1. Query AILogs from last 24h with strong signals -> positive/negative pairs
  2. Query Corrections with high detector confidence -> DPO pairs
  3. Format as LoRA training JSONL (Alpaca or ShareGPT format)
  4. Run LoRA fine-tune on self-hosted GPU (Qwen2.5-7B, ~30 min)
  5. Run golden dataset eval against new weights
  6. If pass rate >= previous: deploy. If drop > 2pp: rollback + alert
```

### Pipeline Gaps (Current vs. Proposed)

| Gap | Current State | Needed |
|-----|-------------|--------|
| **Labeling** | Only human-verified entries (20/day) | Auto-label via signal confidence tiers |
| **Format conversion** | None | Script to convert AILog+Feedback+Correction -> JSONL |
| **Training trigger** | None | Daily cron with volume threshold (min 50 new entries) |
| **Eval gate** | CLI-only, manual | Auto-run eval after each training run |
| **Rollback** | None | Keep previous weights, revert if eval drops |
| **Deployment** | Manual env var change | Auto-swap model endpoint after passing eval |

### Why HITL Still Exists

Three sources remain non-automatable:
1. **Calibration signals** (user 4-5 + Judge fail) — someone must decide if the user or the Judge was right
2. **Force-approved responses** (3 retries exhausted) — genuinely ambiguous cases where the model couldn't self-correct
3. **Edge cases** (novel languages, new personalities) — no historical signal exists

At scale, HITL shifts from gatekeeping every entry to **monitoring quality via stratified random sampling** — just enough to detect drift in the auto-labeler.

---

## Governance Policy

**Scope:** AI features in Agente Mundial — personality-driven match commentary, web search (Tavily) for factual queries, transcreation to 8 non-Latin scripts, daily AI summaries, RSS news rebroadcasts. Excludes: Socket.IO peer-to-peer chat (covered by content moderation policy — `/api/report` + blocking), prediction engine and leaderboard (deterministic, no AI).

**Autonomy boundaries:**

| OK Solo | Needs Human |
|---------|-------------|
| Standard personality response (any of 7 personalities) | Force-approved response after 3 failed Judge retries → auto-enqueued to HITL |
| Web search for factual queries | User-downvoted response (rating 1-2) → auto-enqueued to HITL |
| Transcreation to KO/TH/AR/JA/RU/ZH/VI/HI (max 2 retries, falls back to source text) | User rates 4-5 but Judge failed → calibration signal → HITL |
| Daily summaries at 08:45 AM Spain time | User reports message → Report record created (no moderation UI exists — gap) |
| RSS breaking news rebroadcast | |
| User correction detection (LLM fire-and-forget to Correction model) | |

Never auto: Deleting user accounts (user-facing `DELETE /api/profile` is incomplete — misses push tokens, blocks, group memberships). Sending messages impersonating real people.

**Escalation triggers (existing):**
1. Judge scores < thresholds (purity < 8 OR quality < 6) → retry (max 3)
2. Max retries exhausted → force-approve + HITL (`source: 'force_approved'`)
3. User downvote (rating 1-2) → auto-create HumanReview (`source: 'user_downvote'`)
4. User rates 4-5 but Judge failed → calibration signal → HumanReview (`source: 'judge_disagree'`)
5. User reports content via `/api/report` → Report record (`status: 'pending'`)
6. User blocks another user → chat filtered + push blocked

**Escalation triggers (gaps):**
- No profanity/toxicity detection in bot responses
- No PII leakage detection
- No "talk to a human" transfer mechanism
- No multi-turn conversation limits

**Audit cadence:**

| Cadence | Activity | Owner | Status |
|---------|----------|-------|--------|
| Weekly | Golden dataset eval run (manual CLI) | Developer | ⚠️ CLI-only, no cron |
| Daily (max 20)* | HITL review of pending queue | Developer | ✅ Dev dashboard |
| Monthly | LangFlow feedback analysis → PRD | Developer | ⚠️ FLOW_ID not configured |
| Quarterly | Full policy review | CTO | 🔲 Not implemented |

\* `config.hitl.maxDailyReviews: 20`, dedup window: 7 days, priority order: force_approved > user_downvote > judge_disagree.

**Regulatory exposure:**

| Regime | Applies? | Risk Tier | Key Gaps |
|--------|----------|-----------|----------|
| EU AI Act | Yes | Minimal | No DPIA, no system documentation |
| GDPR | Yes (email + name of EU users) | Limited | No lawful basis documented, no data processor register, no portability endpoint, incomplete account deletion, no retention policy |
| Spanish LOPDGDD | Yes | Limited | Same as GDPR |
| COPPA / Children | Likely (no age gate) | High exposure | Zero age verification, no parental consent |

**Controls in place:** bcrypt hashing, login rate limiting, EULA acceptance, no PII in LLM calls, no real-money transactions.

---

## Shadow AI Audit

| # | Workaround | Source | Signal | Freq | User Spend | Decision |
|---|-----------|--------|--------|------|------------|----------|
| 1 | Screenshot leaderboard → ChatGPT for "what-if" sims & trash talk | Group social dynamics — no trend data, no export | Workflow gap | H | $20/mo | **Build** — native "what-if" sim + shareable leaderboard cards |
| 2 | Pipe bot responses through DeepL/Google Translate for FR/PT/IT/DE friends | Bot native: ES (5 personalities) + EN (2). Transcreation covers KO/TH/AR/JA/RU/ZH/VI/HI only. Missing FR/PT/IT/DE — these are direct-gen in `languageRouter.js` but no prompts exist | Capability gap | M | $10/mo | **Build** — add FR/PT/IT/DE as direct-generation languages (low cost — existing pipeline) |
| 3 | ChatGPT/Claude for pre-deadline match research & prediction strategy | Bot handles factual ("who won?") but not advisory ("what should I predict?") | Capability gap | H | $20/mo | **Build** — add prediction strategy personality mode with team form analysis |
| 4 | Manual screenshots at intervals → AI to detect position changes | Leaderboard has no history, no trend direction (uses `Math.random()` placeholder in UI) | Workflow gap | M | $5/mo | **Build** — native leaderboard history with position delta + sparkline |
| 5 | Custom scrapers polling unprotected API for personal dashboards | No API keys, no rate limiting, no webhooks | Capability gap | L | $0/mo | **Govern** — add light rate limiting + official webhook |
| 6 | ChatGPT to generate custom roasts for specific group members | 7 fixed personalities — no per-user customization, no member-to-member roasting | Trust gap | M | $20/mo | **Partner** — ship "roast my friend" prompt templates for ChatGPT |
| 7 | AI to create group viewing-party schedules from match fixtures | No calendar integration, no kickoff reminders, no social coordination | Workflow gap | L | $10/mo | **Build** — match reminder notifications + ICS calendar export |

**Pattern Assessment:**
- Workarounds found: **7**
- Build: **4** | Partner: **1** | Govern: **1** | Ignore: **1**
- Adjacent spend: **~$85/mo** across surveyed users
- Dominant signal: **Capability gap (3) + Workflow gap (3)** — tied
- **Primary insight:** Users want more from the bot (prediction advice, native language support) AND more from their data (history, trend, export). The strongest near-term move is adding FR/PT/IT/DE direct-generation (covers #2 at near-zero marginal cost — already in `languageRouter.js` tier list as "direct" but no prompt variants) plus leaderboard history with position delta (#4 unlocks virality via shareable cards).

