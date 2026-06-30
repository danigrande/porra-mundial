# Golden Dataset & Reliability Contract

## Golden Dataset Spec

The golden dataset consists of **102 test cases across 6 files** in `agente_mundial/tests/evals/golden_datasets/`:

| Dataset | File | Tests | What it tests |
|---------|------|-------|---------------|
| Intent classification | `intent_classification.json` | 32 | Query routing (ranking, my_status, help, greeting, factual, general) + boundary cases in Korean |
| Personality responses | `personality_responses.json` | 33 | Full pipeline: 7 personalities, ES/EN/KO, with golden reference responses |
| Language purity | `language_purity.json` | 15 | Judge-only: contamination detection (Arabic, Hangul, CJK, Thai, Cyrillic), quality scoring, personality matching |
| Transcreation | `transcreation.json` | 8 | Cultural adaptation to KO/AR/TH/JA across 4 personalities (andres_montes, roncero, pedrerol, fabrizio) |
| Edge cases | `edge_cases.json` | 9 | Pipeline + judge-only: empty leaderboard, unregistered user, long query, unsupported language, XSS injection, personality mismatch, transcreation fallback, personality override |
| Daily summaries | `daily_summaries.json` | 5 | Summary generation for 4 personalities (andres_montes, pedrerol, roncero), including empty leaderboard |

**Sample golden test rows (13 of 102):**

| # | Input | Expected Output | Edge Case? | Judge Type |
|---|-------|----------------|-----------|-----------|
| 1 | `"¿Quién va primero en la clasificación?"` (es, andres_montes) | street_wisdom humor, clean Spanish, max 500 chars | N | LLM |
| 2 | `"¿Quién va primero?"` (es, roncero) | exaggerated_emotion, passionate tone | N | LLM |
| 3 | `"Who's winning?"` (en, trump) | superlative, English | N | LLM |
| 4 | `"Who leads the leaderboard?"` (en, darth_vader) | menacing_wit, English | N | LLM |
| 5 | `{sourceResponse: "¡Ráfaga!..." targetLanguage: ko, personalityId: andres_montes}` | street_wisdom transcreated to Korean (must contain Hangul) | Y | LLM + Transcreation |
| 6 | `{sourceResponse: "¡ATENTOS!..." targetLanguage: ar, personalityId: pedrerol}` | dramatic_reveal transcreated to Arabic (must contain Arabic script) | Y | LLM + Transcreation |
| 7 | `{sourceResponse: "¡ESTO ES HISTÓRICO!..." targetLanguage: th, personalityId: roncero}` | exaggerated_emotion transcreated to Thai (must contain Thai script) | Y | LLM + Transcreation |
| 8 | `{sourceResponse: "¡Ráfaga!..." targetLanguage: ja, personalityId: andres_montes}` | street_wisdom transcreated to Japanese (must contain CJK/Kana) | Y | LLM + Transcreation |
| 9 | Hangul + Arabic characters injected into Spanish response (es, andres_montes) | FAIL: script contamination detected — fast-path regex should catch | Y | Rule-based (regex fast-path) |
| 10 | "El jugador que va primero tiene más puntos que los demás. Felicitaciones." (es, andres_montes) | FAIL: generic boring response, no personality or humor | Y | LLM |
| 11 | Andrés Montes perfect response with street_wisdom catchphrases (es, andres_montes) | PASS: high energy, cultural references, clean Spanish | Y | LLM |
| 12 | `"¿Cómo voy en la clasificación?"` (es, juez_dredd) | authoritarian_judgment, legal terminology, clean Spanish | N | LLM |
| 13 | Juez Dredd perfect response with "I AM THE LAW" + sentencing metaphors (es, juez_dredd) | PASS: authoritarian_judgment, dark humor within bounds | Y | LLM |

**Judge Type legend:**

| Type | Mechanism | File |
|------|-----------|------|
| LLM | `llama-3.1-8b-instant` evaluates language_purity (0-10) + quality (0-10) | `judgeService.js` |
| Rule-based | `detectScriptContamination()` regex detects non-Latin scripts mixed into response → auto-fail at 0/10 without calling LLM | `judgeService.js:42-67` |
| LLM + Transcreation | Response passes through `transcreationService.js` (cultural adaptation with up to 2 retries via Judge), then final Judge evaluation | `transcreationService.js` |

**Adversarial rows included:** 5 (rows 9-13)
- Script contamination (mixed scripts in Spanish)
- Generic/boring response — no personality
- Perfect response (positive control for baseline calibration)
- Wrong personality voice (out-of-character)
- Empty response

**Coverage gaps (shown in the 13-row sample, covered in full dataset):**
- No daily summary tests in sample (6 exist in `daily_summaries.json`)
- No intent classification tests in sample (32 exist in `intent_classification.json`)
- No HTML injection test in sample (exists in `edge_cases.json`)
- No personality override test in sample (exists in `edge_cases.json`)

---

## Confidence UX Design

**Current state: Not implemented.** No confidence indicator exists in the user-facing UI. The Judge scores are stored in AILog and visible in the dev dashboard, but never shown to users.

**Proposed design:**

| Confidence Level | What It Means | What Would Be Shown |
|-----------------|---------------|---------------------|
| **High (>90%)** | Golden dataset pass rate maintained, Judge passed on first attempt with high scores | No indicator — response delivered normally |
| **Medium (70-90%)** | Judge passed but with low scores (<7) or required retries (2-3 attempts) | Subtle indicator (e.g., faded "Powered by AI" badge) |
| **Low (<70%)** | Force-approved after exhausting all retries, or Judge failed but delivered anyway | Bot qualifies the response: "No estoy seguro, pero..." or "Según mis cálculos..." |

**User control surface:**
- Thumbs up/down with 1-5 rating + optional reason (already implemented in `routes/chatbotFeedback.js`)
- No user-facing confidence toggle exists today

---

## Reliability Contract

**Important:** The metrics and thresholds below are **aspirational**. The measurement infrastructure partially exists (eval runner, AILog latency capture, Judge scoring) but automated alerting, CI integration, and rollback mechanisms are not yet built.

| Metric | Target | Measurement | Current Status | Alert Threshold |
|--------|--------|-------------|----------------|-----------------|
| **Accuracy** | 92% | `evalRunner.js --dataset all` — runs 102 golden tests. Results persisted to `EvalRun` model with per-dataset pass rates, regression tracking, and A/B comparison. | ✅ Eval runner and EvalRun model exist. No automated scheduling — currently CLI-only or triggered from dev dashboard. | <88% → manual check (no automated paging) |
| **Hallucination rate** | <1% | Every response evaluated by Judge (`judgeService.js`) on language_purity (0-10) + quality (0-10). Scores stored in `AILog.evalScores`. | ✅ Real-time Judge on every response. No auto-rollback mechanism exists. | >2% → manual review (no automated action) |
| **Latency (p95)** | <800ms | Per-request latency captured in `AILog.latencyMs`. No external monitoring service (Datadog/Grafana) configured. | ⚠️ Data captured but no real-time alerting. No dashboard. | >1200ms for 5min (requires external monitoring setup) |
| **Drift velocity** | <0.5%/wk | `EvalRun.comparisonWithPrevious` tracks pass rate deltas between consecutive runs. Dev dashboard shows pass rate trend chart over time. | ✅ Comparison logic and trend chart exist. Manually triggered — no weekly schedule. | >1% decay/wk → visual alert in dev dashboard trend chart |

### Infrastructure gaps to close before going to production:

1. **Schedule weekly golden runs** — add a cron job (`node evalRunner.js --dataset all`) that runs every Sunday and compares against the previous run
2. **Integrate external monitoring** — Datadog or Grafana for real-time p95 latency alerting
3. **Build auto-rollback** — if accuracy drops below 88% on a scheduled run, revert to the last good model configuration

---

## HITL Architecture

**Current implementation (as coded):**

| Aspect | Detail |
|--------|--------|
| **Trigger** | Auto-created in `routes/chatbotFeedback.js:24-72` when: (1) user downvotes (rating 1-2), (2) user rates 4-5 but Judge disagreed (calibration signal), (3) quality gate force-approved after exhausting 3 retries |
| **Daily cap** | 20 reviews/day (`config.hitl.maxDailyReviews: 20`) |
| **Deduplication** | Max 3 similar reviews per personality+language per 7-day window |
| **Reviewer** | Developer via dev dashboard UI at `/evals/hitl/pending`. No on-call rotation configured. |
| **Verdict submission** | Pass/fail + confidence (1-5) + free-text notes (`routes/devDashboard.js:766-793`) |
| **Promotion to golden dataset** | Manual click: "Promote" writes entry to `local_overrides.json` — becomes a permanent test case in the eval suite |
| **Feedback loop** | Promoted entries are merged into the eval dataset. Next `evalRunner.js` run will test against them. No automated retrain trigger. |

**What does not exist (gaps):**
- No on-call rotation or escalation path
- No automated model retraining after N corrections
- No user-facing confidence exposure
- No auto-rollback on drift

---

## Red-Team Findings

*What failure mode did your partner find that you missed?*

**Before implementting LLM as judge architecture, during early testing I found out messages to mix languages and being cringe instead of funny (specially in spanish).** 

However, based on codebase analysis, three likely findings:

1. **Golden dataset is too small for statistical significance.** 102 tests across 6 categories means the personality dataset (33 tests) can flag a regression but cannot measure it precisely. One failure drops the pass rate by ~3 percentage points — a single anomalous test can trigger a false alarm. Minimum viable size for reliable measurement: ~200 tests per category.

2. **No latency SLO enforcement.** The reliability contract targets p95 <800ms, but latency is only logged to AILog. No alerting, no paging, no dashboard. If the self-hosted GPU degrades during a match, you won't know until users complain. This is especially critical for the World Cup peak (100k users).

3. **No data freshness gate.** The golden dataset is static hand-crafted JSON. There is no mechanism to automatically add new edge cases from production (e.g., a new language, a new personality, a new query pattern that users actually typed). The dataset grows only when a developer manually adds cases. After the tournament, you should backfill the dataset with real user interactions that had high ChatbotFeedback ratings.
