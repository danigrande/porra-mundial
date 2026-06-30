# Three-Horizon Roadmap & Board Pitch — Agente Mundial

**Context:** Today is June 1, 2026. World Cup kicks off June 11. We have 10 days until launch and a 50-day tournament ahead (June 11 — July 20). The post-tournament cliff is real and frames every decision, but we have a full tournament cycle to generate data, validate retention, and prove the model.

---

## Roadmap

### Horizon 1 — Ship (0-4 weeks: June 1 — June 29)
*High confidence. Ships before or during group stage. Earns H2 credibility.*

| Initiative | Strategy Component | Metric | Confidence |
|-----------|-------------------|--------|------------|
| Per-personality eval thresholds (closes SILO #5) | Guardrails — right-size quality expectations per (personalityId, targetLanguage) | Judge pass rate delta per personality | **H** — config change only, 1 afternoon, ships before kickoff |
| Leaderboard history with position delta + sparkline | Bet — gives users a reason to check daily from matchday 1 | DAU, share clicks | **H** — backend data exists, UI work only, ships in week 1 |
| Add FR/PT/IT/DE as direct-generation languages | Moat — captures 4 additional language markets from day 1 | Transcreation bypass rate, user satisfaction | **H** — `languageRouter.js` already lists them as "direct" and `buildLanguageInstruction()` supports any ISO code. Needs personality-specific prompt tuning, ships before kickoff |
| Match reminder notifications + ICS calendar export | Contract — keeps users returning for each prediction window | Push notification CTR >5% | **M** — push infrastructure exists, needs scheduling logic |

### Horizon 2 — Validate (1-3 months: July — August)
*Medium confidence. Ships during knockout stage + immediate post-tournament. Named hypothesis + kill criteria.*

| Initiative | Hypothesis | Kill Criteria | Confidence |
|-----------|-----------|--------------|------------|
| "What-if" simulation + bracket playback | Users return post-tournament to replay scenarios and compare brackets | <15% of tournament users re-engage within 30 days post-final | **M** |
| Prediction strategy personality mode | Bot advisory ("what should I predict?") drives higher prediction frequency + correctness for knockout rounds | <20% adoption among active users | **M** |
| Fix RAG embeddings (make vector search primary) | Semantic retrieval improves response relevance vs regex-only | Golden dataset eval pass rate improvement <3pp | **M** — `semanticSearchContextForPlayer()` exists (cosine sim + regex fallback), but fallback path (`retrieveContextForPlayer` regex-only) is still hit when messages lack embedding vectors. Make vector search the default, regex the exception |
| Native "what-if" sim + shareable leaderboard cards | Viral sharing drives organic group growth during peak tournament moments | Share conversion rate <2% | **M** |

### Horizon 3 — Explore (3-6 months: September — December)
*Low confidence. Small investment. Builds toward secondary use case.*

| Initiative | What Must Be True First | Metric | Confidence |
|-----------|------------------------|--------|------------|
| Generic league support (La Liga, Premier League) | Post-tournament retention proves users want year-round predictions | >30% of World Cup users activate a league within 90 days | **L** |
| Custom personality creator / per-group anchor overrides | Personality is the #1 engagement driver per chatFeedback data | Community-created personality adoption rate | **L** |
| Cross-group leaderboard / global rankings | Multiple groups exist and users want broader comparison | Cross-group feature usage >10% | **L** |

**Unmapped items:** Reverse AILog→Feedback linkage (SILO #10 partial — `ChatbotFeedback` has `aiLogId` forward link, but `AILog` lacks `feedbackId`). Cut from roadmap. Backlog as tech debt if HITL volume exceeds 50 reviews/day.

---

## AI Evaluation

| Lens | Verdict | Notes |
|------|---------|-------|
| **Bet Validation** | Evidence-backed — but only 10 days until we find out | 102-test golden dataset, 7 personalities ready, HITL system tested. The bet (personality-driven commentary drives engagement) is unproven at scale. We'll have signal by matchday 3. |
| **Capability Gaps** | Realistic to build | H1 items are config + UI (1-3 days each). All ship before kickoff. H2 items require 1-2 weeks each — feasible during the tournament. |
| **Defensibility** | Platform-proof in the short term | Personality anchors + golden dataset + user corrections create switching costs. But no fine-tuning yet. A competitor with a better prompt could match quality in weeks. Fine-tuning is Year 2. |
| **Pricing Alignment** | Economics hold at 10% conversion | $4.99/group pass → $27k CapEx recovered at ~2,500 paid groups. Self-hosted cascade ($900-1,700/mo) keeps marginal cost near zero. Free tier ads ($0.75 CPM) cover unfunded users. |
| **Trust & Reliability** | Contract exists but not automated | Golden dataset (102 tests) + Judge (every response) + HITL (daily queue). Missing: automated eval scheduling, drift alerting, latency SLO enforcement. Acceptable for launch — fix in H2. |
| **Impact & Scale** | Breaks at 10x without self-hosted GPU | Current Groq free tier: 30 req/min, 500K tokens/day. At 100k users, every active group during a match exceeds this. Self-hosted GPU is the gating item for scale — must ship by round of 16 (June 28). |

**AI tool used:** Groq (`llama-3.3-70b-versatile` + `llama-3.1-8b-instant` judge), HuggingFace embeddings, Tavily web search.

**Biggest pushback received:** "Fine-tuning is the moat — but you have zero training data at launch and the tournament is 50 days. Fine-tuning can't improve this World Cup."

**What you changed as a result:** Dropped fine-tuning from all horizons. Reclassified Data Flywheel score from 5/5 to 2/5. Fine-tuning is Year 2 — it improves the next event, not this one. The near-term moat is prompt engineering + golden dataset compounding + HITL signal accumulation.

---

## Board Pitch

**Thesis:** Personality-driven AI commentary turns a static World Cup prediction pool into a daily social ritual — and the 50-day tournament generates enough data to validate a year-round product before the next major event.

**The case:**

**Why now (June 1 — 10 days before kickoff):** The 2026 World Cup starts June 11. We have a live, tested application with 7 personalities, a Judge on every response, a 102-test golden dataset, and a HITL system ready to capture human feedback. The gap is not the product — it's the $27k CapEx to ship monetization and the self-hosted GPU to survive 100k users. Every day of the tournament generates corrections, feedback, and golden dataset entries that compound the moat. If we ship monetization before matchday 1 (June 11), every new group from day 1 is a potential paid conversion.

**What's defensible:**
1. **Personality anchors** — 7 distinct, culturally-specific voices (Andrés Montes, Pedrerol, Roncero, Darth Vader, Trump, Fabrizio Romano, Juez Dredd) that took iteration to tune. Each has hardcoded catchphrases, humor mechanisms, and forbidden patterns.
2. **Golden dataset** — 102 curated tests across 14 languages, 6 categories, growing daily via HITL promotion.
3. **User corrections** — every user correction is a labeled data point. The Correction model captures full context (original response + user's correction + LLM confidence).
4. **Transcreation pipeline** — 8 non-Latin scripts with cultural adaptation (not raw translation). Korean Andrés Montes is not the same as Korean Pedrerol.
5. **Feedback → PRD pipeline** — LangFlow integration turns user feedback into structured PRDs with acceptance criteria.

None of these are un-copyable alone. Together they create a 6-12 month head start. The true moat (fine-tuned model + years of interaction data) is Year 2.

**The economics:**

| Item | Value |
|------|-------|
| Pricing | $4.99/group one-time pass (no ads + 7 personalities + cosmetics) |
| Free tier | Banner ads at $0.75 CPM blended |
| Conversion assumption | 10% of groups |
| CapEx required | $27k (feature gating + Stripe + provider router) |
| OpEx at 100k users | $900-1,700/mo (self-hosted cascade: 1-2 A10G GPUs for 96% traffic, GPT-4o-mini for 4% async summaries) |
| Payback | ~18 months at 10% conversion |
| First tournament | Likely breakeven to slight loss — but generates the data and user base for year-round |
| Post-tournament OpEx | $0/mo (scale back to Groq free tier for residual users) |

**The risks:**

| Risk | Mitigation |
|------|-----------|
| **Trust / failure modes:** Hallucination (wrong scores, wrong standings), offensive personality outputs (Trump, Juez Dredd), factual errors from web search | Judge evaluates every response in real-time (purity 0-10 + quality 0-10). 3 retries with feedback injection before force-approve. HITL queue auto-created from downvotes. Golden dataset detects regressions. |
| **Scale / governance:** Groq free tier caps at 30 req/min, 500K tokens/day. One match with 100 concurrent users exhausts the limit. No age verification. No data retention policy. GDPR gaps. | Self-hosted GPU must ship by round of 16 (June 28) — 17 days from now. Age gate + data retention policy (H2). Privacy policy update (needs legal counsel). |
| **Competitive:** A competitor launches a similar personality bot during the next tournament. Without fine-tuning, our advantage is prompt engineering + data — both copyable. | Fine-tuning is Year 2. Near-term: deepen the data flywheel (corrections → golden dataset → eval improvement). Lock users with group pass — switching costs rise with every prediction saved. |
| **Post-tournament cliff:** After July 20, DAU drops 90%+. The product is seasonal. | Generic league support (H3) is the bridge. Only funded if H2 re-engagement validates year-round demand. Kill criteria are explicit: <15% re-engagement in 30 days = don't build leagues. |

**The ask:** $27k CapEx for monetization infrastructure + $5k/month OpEx for self-hosted GPU (3-month minimum = $15k). Total: **$42k**.
- By matchday 1 (June 11): feature gating + Stripe + provider router ships.
- By round of 16 (June 28): self-hosted GPU cascade is live.
- By final (July 20): H2 validation data decides whether to fund generic leagues or pivot.

---

## M1 Baseline vs. Now

**M1 baseline:** "We ship a World Cup prediction bot with AI personalities. It's free. Fine-tuning is how we win."

**Now:** "We ship personality-driven AI commentary for the 2026 World Cup with a quality gate on every response, a growing golden dataset, and a HITL system capturing human feedback from day 1. Monetization ($4.99/group pass + $0.75 CPM ads) funds the self-hosted GPU that lets us survive 100k users. Fine-tuning is Year 2 — it cannot improve this World Cup. The post-tournament cliff is the existential risk. Generic league support is the bridge, funded only if H2 re-engagement hits targets."

