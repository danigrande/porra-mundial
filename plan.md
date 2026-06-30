# Agente Mundial — Implementation Plan

## Overview

7 phases, ~10-11h total. All phases are independent (no data dependencies between them). 

---

## Phase 1 — Prompt Cleanup (1h)

**Files:** `groqEngine.js`

Extract `SHARED_RULES_ES` / `SHARED_RULES_EN` constants from the 7 duplicated personality prompts. Each prompt had 6-8 identical rules copy-pasted. Now each personality prompt is just its unique introduction + shared rules + 3-4 personality-specific lines.

**Tokens saved:** ~300-400 tokens per response (shared rules no longer duplicated in every system prompt).

---

## Phase 2 — Personality-Specific Errors (1h)

**Files:** `anchors.js`, `groqEngine.js`

- Added `ERROR_MESSAGES` map in `anchors.js` — 7 personalities × 2 error types (`rateLimited`, `genericError`)
- Added `getErrorMessage(personalityId, type)` helper
- Replaced all hardcoded Spanish error strings in `groqEngine.js:generateResponse`, `generateDailySummary`, `generatePersonalitySummary`

**Before:** 429 errors always said "Ratatatatata!... jugón" (Andrés Montes style), even to Darth Vader users.
**After:** Each personality has thematically appropriate errors (Darth Vader: "I find your lack of patience... disturbing", Trump: "the BEST talker, and they silence me. Sad!").

---

## Phase 3 — Selective RAG Bot Vectorization (15min)

**Files:** `chatService.js`

Changed the bot message vectorization to skip `vectorizeMessage()` when the response was `forceApproved` (failed quality gate). Previously all bot responses were vectorized — including low-quality ones that could pollute RAG context.

---

## Phase 4 — Web Search Truncation (30min)

**Files:** `messageHandler.js`

- Reduced Tavily results from 5 → 3 per query
- Trimmed content from 300 → 200 chars per result
- Removed the planned LLM summarizer (main model already handles raw results well)

**Result:** ~60% fewer tokens injected into prompts from web search, zero latency cost.

---

## Phase 5 — Fix Correction Pipe (2-3h)

**Files:** `messageHandler.js`, `chatService.js`

### The bug
`storeLastBotResponse()` was exported but never called from `chatService.js`. The entire correction detection pipeline was dead code — `getLastBotResponse()` always returned null.

### The fix
1. Refactored `processMessage()` to return a result object `{response, personalityId, targetLanguage, ailogId, judgeScores, forceApproved}` instead of a plain string
2. Updated `chatService.js` to destructure the object and call `storeLastBotResponse()` after every bot response
3. Also passes `forceApproved` flag so Phase 3's selective vectorization works correctly

---

## Phase 6 — Conversation Memory (2h)

**Files:** `messageHandler.js`, `chatService.js`, `groqEngine.js`

In-memory conversation buffer (not MongoDB):
- **Key:** `${userId}::${groupName}`
- **TTL:** 15 minutes (sliding window)
- **Capacity:** max 6 exchanges (user + bot pairs)
- **Injection:** added `convContext` to context object in `processMessage()`, and injected into `generateResponse()` user prompt as "CONVERSACIÓN RECIENTE"

No infrastructure cost, no TTL indexes, zero latency — and context resets on server restart (acceptable for a chatbot).

---

## Phase 7 — Metrics Foundation (3h)

**Files:** `models/AILog.js`, `judgeService.js`, `transcreationService.js`, `messageHandler.js`, `routes/devDashboard.js`

### AILog schema changes
- Added `'judge'`, `'transcreation'`, `'correction_detection'` to `type` enum
- Added `callSource` (free-form string)

### Logging added
- **Judge calls** (`judgeService.js`): All LLM judge evaluations logged with `type: 'judge'`. Includes fast-path script contamination detections (logged as failed). Tokens, latency, scores captured.
- **Transcreation calls** (`transcreationService.js`): Each `transcreateMessage()` LLM call logged with `type: 'transcreation'`. Source and target language, tokens, latency captured.
- **Correction detection** (`messageHandler.js`): Every LLM classification call in `detectAndSaveCorrection` logged with `type: 'correction_detection'`. Both YES and NO results logged.

### Dashboard updates
- `/usage` endpoint now includes `auxiliaryCosts` breakdown (judge, transcreation, correction_detection) alongside main response metrics

---

## Summary

| # | Phase | Effort | Risk |
|---|-------|--------|------|
| 1 | Prompt Cleanup | 1h | Low |
| 2 | Personality Errors | 1h | Low |
| 3 | Selective RAG Vectorization | 15min | Low |
| 4 | Web Search Truncation | 30min | Low |
| 5 | Fix Correction Pipe | 2-3h | Medium |
| 6 | Conversation Memory | 2h | Low |
| 7 | Metrics Foundation | 3h | Medium |
| | **Total** | **~10-11h** | |

### Skipped (from original plan)
- **Adaptive Quality Gate** — over-engineered for traffic volume
- **Multi-Intent Detection** — phantom problem; regex is sufficient  
- **Feedback Cron / KnownFacts** — too speculative; existing ChatbotFeedback + HumanReview is enough
- **Emoji Reaction Analytics** — already covered by star rating system
