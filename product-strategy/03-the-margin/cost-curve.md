# Cost Curve & Pricing Strategy

## Cost Model



### MVP (10 users/month)

| Cost Category | Per-User/Month | Notes |
|---|---|---|
| Inference (primary model) | **$0** | **Primary: `llama-3.3-70b-versatile`**. Free on Groq tier |
| Inference (judge/quality gate) | **$0** | `llama-3.1-8b-instant` — free on Groq. **2 calls per response** (primary + judge), up to 3 retries |
| Inference (daily summaries) | **$0** | Separate 70B call per group at 08:45 daily |
| Infrastructure | **$0** | Render Free + Vercel Hobby |
| Data/storage | **$0** | MongoDB Atlas M0 free tier |
| Web Search (Tavily) | **$0** | 1,000 free searches/mo — sufficient at 10 users |
| Email (Brevo) | **$0** | 300 free emails/day — sufficient at 10 users |
| Push Notifications | **$0** | Expo Push — free tier |
| Human-in-the-loop | **$0** | "Done by Developer" but still present in code (`HumanReview` model, 20 reviews/day cap). Not billed |
| **Total AI COGS** | **$0** |  All services fit within free tiers |

---

### Real MVP (1,000 users/month)

| Cost Category | Per-User/Month | Notes |
|---|---|---|
| Inference (primary 70B) | **$25-35** | Groq free tier has ~30 req/min, 500K tokens/day — **will throttle at 1,000 users**. Partial move to paid Together.ai (Llama-3.3-70B: $0.59/M input, $0.79/M output). Not "$15 for 8B". |
| Inference (judge 8B) | **$5-10** | Judge runs on every response (not sampling). 2x the call volume of primary. Still on Groq free can help, but rate limits bite here too. |
| Inference (daily summaries) | **$5** | 1 summary/group/day × 70B model. Assuming ~50-100 groups at 1k users. |
| Transcreation (8 distant languages) | **$0-5** | Only if non-Latin users are present. Extra 70B call per response in ko/th/ar/ja/ru/zh/vi/hi |
| Web Search (Tavily) | **$7** | 1,000 free searches/mo exceeded. Paid starter: ~$7/1K searches |
| Email (Brevo) | **$0-10** | 300 free/day = 9,000/mo — may suffice if only password resets. Brevo Starter: $25/mo |
| Infrastructure | **$7-14** | Render Standard ($14/mo) — correct. Free tier sleeps; WebSockets + cron jobs require paid plan. |
| Data/storage | **$9** | MongoDB Atlas M2 ($9/mo, 2GB) — reasonable for 1k users. Add **~$3/mo for data transfer egress** |
| Human-in-the-loop | **$0** | Auto-queued enforcement. Adds operational overhead (reviewing 20/day) but no direct API cost |
| **Total AI COGS** | **$55-95/mo ($0.055-0.095/user)** | 70B model pricing is the dominant factor. |

---


## Enterprise (100,000 users/month) — Self-Hosted Cascade Architecture

| Cost Category | Monthly Cost | Notes |
|---|---|---|
| **GPU inference** (8B triage + 8B judge + 8B fine-tuned transcreation) | **$600-900** | 1-2 cloud GPUs (A10G/L4) self-hosting all inference. vLLM serves 100+ req/s per GPU. No per-token pricing. Covers chat responses, quality gate, transcreation, RAG embeddings. |
| **Frontier inference** (GPT-4o-mini, ~4% traffic) | **$200-500** | Only async summaries (daily + personality). ~15k calls/day at GPT-4o-mini prices ($0.15/M in, $0.60/M out). Immune to volume spikes. |
| **Web Search** (Tavily) | **$150-300** | Scale plan. Could reduce by caching common football queries. |
| **Email** (Brevo) | **$40-100** | Transactional emails (password resets, notifications). |
| **Infrastructure** (servers + networking) | **$500-900** | 2-4 Node instances behind load balancer + Redis for Socket.IO scaling + bandwidth egress (~200-400k concurrent WebSocket connections). **Cheaper than all-API model because GPU does the heavy lifting — no need for expensive Render Pro instances.** |
| **Data/storage** (MongoDB Atlas M30/M40) | **$600-1,000** | M30 (~$350) or M40 (~$700) + $150-250 for data transfer + backups. |
| **RAG / Embeddings** | **$0** | Self-hosted on the same GPU. MiniLM-L12-v2 is tiny (~0.5GB VRAM, runs alongside the 8B model at no extra cost). |
| **Human-in-the-loop** | **$5,000-15,000** | 3-5 moderators (LATAM contractors) reviewing bot responses, edge cases, and feedback. Still needed at 100k users; no architectural shortcut here. |
| **Monitoring & Observability** | **$300-800** | Datadog or Grafana + Sentry + uptime monitoring. |
| **Total OpEx** | **~$7,390-20,500/mo (~$0.074-0.205/user)** | |
| **CapEx amortized** (12-month) | **~$2,250/mo** | $27k one-time (self-hosted setup + payments + gating + fine-tuning). |
| **Total COGS (OpEx + amortized CapEx)** | **~$9,640-22,750/mo** | |

### Comparison: API-only vs Self-hosted Cascade

| Cost Category | API-only (old) | Self-hosted cascade (new) | Delta |
|---|---|---|---|
| Inference (all) | $3,900-6,200 | **$800-1,400** | **-77%** |
| Infrastructure | $500-900 | **$500-900** | Same (GPU replaces Render Pro, not eliminates it) |
| Data/storage | $600-900 | **$600-1,000** | Same |
| RAG / Embeddings | $200-500 | **$0** (same GPU) | — |
| HITL | $5,000-15,000 | **$5,000-15,000** | Same |
| Monitoring | $300-800 | **$300-800** | Same |
| Third-party APIs | $190-400 | **$190-400** | Same |
| **Total OpEx** | **$10,690-23,700** | **~$7,390-20,500** | **~14-31% reduction** |
| **Gross margin (pass rev only)** | 90-94% | **94-96%** | Improved |
| **Provider lock-in risk** | High (per-token API) | **None** (self-hosted weights) | Eliminated |

---

**Root causes of cost scale:**
1. **70B ≠ 8B** — primary model is `llama-3.3-70b-versatile`, not the 8B version. ~12x cost per token on paid tiers.
2. **Double inference** — every response has 2 LLM calls (primary + judge), plus retries up to 3x.
4. **Missing HITL at scale** — Thumbs up/down replaces *technical* infrastructure but not the *human* cost of moderation at 100k users.
5. **Transcreation** — 8 non-Latin languages require extra 70B calls per response.


## Finantial impact of self-hosting

1. **70B ≠ 8B** — primary model is `llama-3.3-70b-versatile`, not the 8B version. ~12x cost per token on paid tiers. **Mitigated by self-hosted cascade: 96% of traffic moves to a self-hosted 8B GPU, eliminating per-token pricing.**
2. **Double inference** — every response has 2 LLM calls (primary + judge), plus retries up to 3x. **Mitigated: both run on the same GPU at no extra marginal cost.**
3. **HITL at scale** — Thumbs up/down replaces technical infrastructure but not the human cost of moderation at 100k users. **Unchanged: 3-5 moderators at $5,000-15,000/mo becomes the dominant cost line (~68% of OpEx).**
4. **Transcreation** — 8 non-Latin languages require extra 70B calls per response. **Mitigated: fine-tuned 8B on the same GPU handles transcreation at zero marginal cost.**
5. **Per-token API dependency (new)** — under the API-only model, every usage spike linearly increases cost. **Eliminated: self-hosted GPU is a fixed cost regardless of volume.**



## Cascading Strategy
<!-- Cheap model → frontier model routing logic -->

### Current (10 users/month) — AS-IS TODAY

| Field | Value |
|---|---|
| **Triage model** | **None.** No cascade exists. Only one primary model for all paths. |
| **Frontier model** | **None.** Same model for chat, summaries, transcreation. |
| **Primary model** | `llama-3.3-70b-versatile` via Groq |
| **Judge model** | `llama-3.1-8b-instant` via Groq |
| **Routing rule** | **None.** Every path → 70B. No feature-based routing. |
| **Cascade ratio** | N/A (100% 70B) | — |
| **Fallback (not cascade)** | `Qwen/Qwen2.5-7B-Instruct` via HuggingFace (only when Groq errors) |
| **Transcreation** | 70B Groq + 8B Judge retry loop |
| **Total AI COGS** | **$0/mo** (all free tier) |

### Future (100k users/month)

At this scale, Groq free tier is unusable. The cascade becomes a **pricing architecture**.

| Field | Value |
|---|---|
| **Triage model** | **Self-hosted fine-tuned 8B** (recommend Qwen2.5-7B — already the HF fallback, best multilingual support, LoRA fine-tunable on one GPU). Handles chat + transcreation + Judge on a single GPU instance. |
| **Frontier model** | `GPT-4o-mini` via API — async summaries where number hallucination must be avoided and latency doesn't matter. Only ~4% of traffic. |
| **Routing rule** | Feature-based: <br>• `generateResponse` (chat, sync) → **self-hosted 8B**<br>• transcreation pipeline (sync, triggered per-response for non-Latin languages) → **same self-hosted 8B** (fine-tuned)<br>• `generateDailySummary` / `generatePersonalitySummary` (cron, async) → **GPT-4o-mini** |
| **Expected cascade ratio** | ~96% self-hosted 8B / ~4% GPT-4o-mini <br>(150k chat calls + 30k transcreation calls vs 10k summaries + 5k personality summaries per day) |
| **Cost consequence** | Self-hosted 8B: ~**$500-1,000/mo** (single GPU). GPT-4o-mini: ~**$400-700/mo** (4% of 200k daily calls). No per-token pricing for the bulk of traffic. |

---

### Summary table

| | 10 users/mo (AS-IS TODAY) | 100k users/mo (PROPOSED) |
|---|---|---|
| **Triage model** | **None.** Single model for all paths: `llama-3.3-70b-versatile` | Self-hosted fine-tuned 8B (Qwen2.5-7B) for chat + transcreation |
| **Frontier model** | **None.** Same 70B for chat, summaries, transcreation | GPT-4o-mini (API) for async summaries only |
| **Routing rule** | **None.** All traffic → 70B. No feature-based or intelligence-based split | Feature-based: synchronous (chat + transcreation) → self-hosted 8B; asynchronous (summaries) → GPT-4o-mini |
| **Cascade ratio** | N/A (100% 70B) | ~96% self-hosted 8B / ~4% GPT-4o-mini |
| **Transcreation** | 70B Groq + 8B Judge retry loop (1-3 70B calls per non-Latin response) | Integrated into triage (fine-tuned 8B, same GPU) — 1 local call, no per-token cost |
| **Judge** | `llama-3.1-8b-instant` (evaluates 70B output) | Same 8B Judge, could run on same GPU or be absorbed into fine-tuned model |
| **Total AI COGS** | **$0/mo** (all Groq free tier) | **~$900-1,700/mo** (GPU rental + GPT-4o-mini API) |

The jump from 10 to 100k users changes the **hosting** (API → self-hosted), not the **strategy** (triage/frontier split remains feature-based). The fine-tuned 8B is the key enabler — it keeps 96% of traffic off per-token APIs entirely.


## Pricing Model

## Pricing Model

### 1. Current Pricing

The app is **100% free** (pre-monetization). All API inference, database, and infrastructure costs are absorbed to build the user base. Standard for an MVP, but not sustainable at scale during the World Cup.

### 2. Why Standard SaaS Models Fail

**Seat-based** (e.g., $1/user/month) — **FAIL.** A group of 10 friends plays together. If one refuses to pay $1, the entire group abandons the app for a free Excel sheet on WhatsApp. Individual paywalls kill multiplayer social games.

**Usage-based** (e.g., buy "AI Tokens") — **FAIL.** Consumers hate micro-transactions for chat. Nobody wants to calculate if they have enough credits to ask the bot a question.

**Outcome-based** — **N/A.** Requires real-money sports betting, which has massive legal/compliance barriers.

### 3. Proposed Pricing: The Admin-Sponsored Group Pass

A **Freemium + Admin-Sponsored + Ads** model with two revenue streams.

**The Free Tier** — Any user creates a group, invites friends, enters predictions, sees the leaderboard for free. Zero friction for acquisition and viral growth. Free groups keep all engagement loops (push notifications, daily summaries, rich media, full history) to generate chat data for AI training. Banner ads shown on the leaderboard and chat.

**The "Agente Mundial" Group Pass** — **$4.99 one-time fee per tournament.** The Group Admin pays once, unlocking premium features for the entire group for the tournament duration (~40 days, June 11 — July 20).

### 4. Feature Split

| Free Tier | Paid Tier (+$4.99/group) |
|---|---|
| 4 AI personalities (2 ES + 2 EN) | 7 AI personalities (all) |
| Banner ads in leaderboard/chat | No banner ads |
| — | Breaking news RSS broadcasts |
| Push notifications | Push notifications |
| Daily AI summaries | Daily AI summaries |
| Image/audio/GIF/file sharing | Image/audio/GIF/file sharing |
| Full tournament message history | Full tournament message history |
| Custom scoring rules | Custom scoring rules |
| — | Custom player avatar |
| — | Nickname color |
| — | Player banner |
| — | VIP badge |
| — | Group avatar |
| — | Chat theme / accent color |
| — | Custom group tagline |
| — | Animated leaderboard effects |
| — | Premium emoji reactions |
| — | "Goal" celebration splash |
| — | Custom bot intro (personalized greeting per group) |

Paid tier sells **personality** (more bot variety) and **polish** (cosmetics, no ads, real-time news) — not functionality gates that split the user base.

### 5. Revenue Model

| Stream | Who pays | Amount | Notes |
|---|---|---|---|
| **Group Pass** | Group admin | $4.99 one-time | Per group, per tournament |
| **Banner Ads** | Ad network | ~$0.75 CPM | Blended base rate (Spain + LATAM + US). Spikes to ~$1.25-1.50 during World Cup |

### 6. Projected Revenue at Scale

Assumptions: 10 users/group, 10% pass conversion, 5 sessions/user/day, 40-day tournament, $0.75 blended CPM ($1.25 World Cup peak).

| Scale | Groups | Free users | Paid groups | Pass rev | Ad rev (40d) | **Total rev/tournament** |
|---|---|---|---|---|---|---|
| **100 users** | 10 | 90 | 1 | $5 | ~$10-17 | **~$15-22** |
| **1,000 users** | 100 | 900 | 10 | $50 | ~$100-170 | **~$150-220** |
| **10,000 users** | 1,000 | 9,000 | 100 | $499 | ~$1,000-1,700 | **~$1,500-2,200** |
| **100,000 users** | 10,000 | 90,000 | 1,000 | $4,990 | ~$10,000-17,000 | **~$15,000-22,000** |

### 7. Why This Works

- **Zero friction for the masses** — 9 out of 10 users never hit a paywall. They click the invite link and play.
- **Targets the highest-intent user** — The Group Admin organized the pool. They're highly likely to drop $5 (price of a beer) for a polished group experience.
- **Free tier stays engaging** — All core loops are free, generating user retention + training data.
- **Ads add incrementality** — At $0.75 CPM, ads roughly double the pass revenue at every scale tier. During World Cup peak ($1.25 CPM), ads cover infrastructure entirely.
- **Phenomenal margins** — With the self-hosted cascade (8B triage + GPT-4o-mini frontier), AI COGS for a group of 10 for the full tournament is ~$0.30-0.50. At $4.99, that's a **90-94% gross margin** on pass revenue. Total blended gross margin including ads: **~55-65%** depending on CPM.



**Model:** seat-based 

**Important:**
I'm selling a flat-rate pass but the COGS is usage-based. The only way that math works at scale is to cap my marginal cost via self-hosting. The cascade strategy isn't just an optimization — it's the condition that makes the $4.99 price point viable.

## Stress Tests

Based on the self-hosted cascade architecture (8B triage on GPU + GPT-4o-mini for 4% of traffic).

| Scenario | Impact on Margin | Response |
|---|---|---|
| **1. Inference usage goes 3x** (users trigger the bot 3x more than projected) | **Low Impact.** With self-hosted 8B, marginal cost per message is near zero. A single GPU handles ~100+ req/s — 3x usage stays within capacity unless you're already near saturation. Cost impact: ~$0 if under capacity, or ~$500-1,000/mo if it forces a second GPU. Margin drops from ~94% to ~85-90% in the worst case. | **Monitor GPU utilization.** Add auto-scaling alerts at 70% sustained usage. The "Humor Cooldown" (bot says "Me voy al banquillo a beber agua" and ignores prompts for 15 min) is still a good UX safety net, but you'll likely never need it. |
| **2. Heaviest segment doubles** (top 10% of groups chat 2x more than average) | **Medium Impact (Infrastructure).** Margin impact on inference is negligible (self-hosted GPU doesn't care). The real risk is MongoDB write contention during live matches — 2x chat volume from power users means 2x message saves, 2x AILog inserts, and potential WebSocket saturation for everyone. | **Aggressive RAG Caching:** Cache chatContext in memory for 60 seconds for heaviest groups. **Rate-limit DB writes during peak match minutes** (buffer messages in memory, flush every 5 seconds). **Socket.IO horizontal scaling** — if one Node process reaches ~10k connections, spin up a second. |
| **3. Model provider raises prices 50%** | **Zero Impact.** This affects only the GPT-4o-mini calls (~4% of traffic). Self-hosted 8B is immune to API price hikes. Even if OpenAI doubles GPT-4o-mini pricing tomorrow (from $0.15/M in to $0.30/M in), total COGS increases by ~$200-350/mo at 100k users — less than 2% of revenue. | **Silent Switch:** The 8B triage is already self-hosted. For the 4% frontier traffic, swap GPT-4o-mini for Claude Haiku or Gemini Flash with one line of code. Users won't notice. |



The self-hosted cascade fundamentally shifts the risk from a **per-token API pricing**:

| Risk | Under per-token API | Under self-hosted cascade |
|---|---|---|
| **Usage spikes** | Cost scales linearly with every message | GPU is a fixed cost; more usage is free until capacity |
| **Price hikes** | Directly hits every dollar of margin | Only affects 4% of traffic (GPT-4o-mini) |
| **Provider lock-in** | Need to migrate API keys | Self-hosted 8B has no provider dependency |

### Ultimate Conclusion on Pricing Risk

The product is computationally cheap and self-hosting makes it **effectively immune to usage spikes and provider price changes**. The real risks at scale are:
1. **MongoDB write contention during live matches** — this is the #1 threat
2. **WebSocket connection limits** — a single Node process tops out around 10k concurrent sockets
3. **GPU capacity planning** — you need to know when to scale from 1 GPU to 2

None of these are pricing risks. The margins are structurally protected.

---



## Board One-Pager
<!-- Before/After: Old SaaS revenue vs. AI usage revenue for your product -->

**Before (Traditional Web2 / SaaS Model)**

The Product: A static utility. A digital spreadsheet where users input predictions and view a math-based leaderboard.

The Engagement Loop: Entirely dependent on the users. If the friend group is quiet or busy, the app feels dead. Engagement only spikes exactly when a match ends.

The Retention Problem: Users who perform poorly (last place) churn immediately because checking a leaderboard where they are losing is not fun.

Monetization: Extremely difficult. Users refuse to pay a subscription fee just to see a basic math leaderboard they could replicate in Excel.

---

**After (AI-Enabled Entertainment Platform)**

The Product: A dynamic, stateful game. The leaderboard is now commentated in real-time by unhinged, culturally tailored AI personas (Montes, Vader, Romano).

The Engagement Loop: Automated and continuous. The AI proactively generates personalized content (Daily Summaries, direct roasts, breaking news broadcasts), creating notifications that pull users back into the app even when there are no live matches.

The Retention Solution: Entertainment supersedes winning. Users in last place stick around simply because the AI's personalized roasting is funny and the group chat is active.

Monetization: Unlocks the "Premium Group Pass." Users won't pay for math, but Group Admins will gladly pay $4.99 to unlock 7 AI personalities, cosmetics, and an ad-free experience to entertain their friends for the entire 40-day tournament. Free-tier banner ads add a second revenue stream.

---

**Net Margin Shift**

Customer Acquisition Cost (CAC): Decreases. The AI's funny summaries are highly shareable screenshots, driving organic, viral top-of-funnel growth.

Cost of Goods Sold (COGS): Structurally contained. Self-hosted 8B inference on GPU (covers 96% of traffic) + GPT-4o-mini for async summaries (4%) keeps AI cost at ~$0.30-0.50 per group for the full tournament. Fixed GPU cost means usage spikes don't increase COGS.

Net Margin Impact: Massive Expansion. By introducing a $4.99 one-time Admin Pass against a ~$0.30-0.50 AI cost, the business transforms from a free, un-monetizable utility into a premium entertainment product operating at **~90-94% Gross Margins**. At 100k users, banner ads contribute another ~$10,000-17,000 in tournament revenue with zero marginal cost.

