# Plan: Chatbot Web Search + RSS Breaking News

## Goal
Make the chatbot smarter with two features:
1. **Web Search**: Answer real-time questions (e.g., "who are favorites to win the World Cup?") via Tavily API
2. **RSS Breaking News**: Poll sports RSS feeds, classify articles with LLM, broadcast breaking news to all group chats

## Cost Analysis
- **Tavily**: Free tier (1,000 credits/month = 1,000 basic searches). No credit card required.
- **RSS Polling**: Free. Two HTTP GET requests every 15 min. No external API cost.
- **Groq**: Negligible. Classification prompt is tiny (~100 tokens). Use free tier (14,400 requests/day).
- **Infrastructure**: No impact on Render, MongoDB, Vercel, or HuggingFace. RSS polling is a `setInterval` in the same Node process.

---

## Files to Create

### 1. `agente_mundial/webSearchService.js` (NEW)

Tavily API wrapper. Single exported function:

```js
export async function searchWeb(query, maxResults = 5)
```

- Uses `config.webSearch.apiKey`
- Calls Tavily `/search` endpoint with `search_depth="basic"` (1 credit)
- Returns structured array: `[{ title, url, content }]`
- Handles errors gracefully (returns empty array on failure)

### 2. `agente_mundial/rssFeedService.js` (NEW)

Full RSS polling + classification + broadcast service.

**Exports:**
- `startRssService(io)` — called on server boot

**Internal functions:**
- `pollFeeds()` — main loop, runs every `config.rss.pollIntervalMs`
  - For each feed URL → `parseRSS(feedUrl)` → filter new articles
- `parseRSS(url)` — uses `rss-parser` library to fetch and parse
- `preFilter(article)` — quick keyword match on title + content using `config.rss.worldCupKeywords`
- `classifyArticle(article)` — calls Groq with a tiny prompt to determine if article is "breaking/important" about the World Cup
- `broadcastBreakingNews(article)` — emits to all group chats via `sendBotMessage()` + push via `pushService.sendToGroup()`

**In-memory tracking:** `Map<guid, timestamp>` of seen articles (no MongoDB needed). Rotates out entries older than 7 days to avoid memory leak.

**Groq classification prompt:**
```
System: You are a sports news classifier. Respond with ONLY "YES" or "NO".
User: Is this news article about a breaking/important World Cup development that users of a World Cup prediction pool should know about?
Title: {title}
Content: {content.substring(0, 500)}
```

**Broadcast format:**
```
🚨 NOTICIA DE ÚLTIMA HORA 🚨
{title}
{url}
```

---

## Files to Modify

### 3. `agente_mundial/config.js`

Add three new config sections:

```js
// --- Web Search (Tavily) ---
webSearch: {
  enabled: true,
  apiKey: process.env.TAVILY_API_KEY || '',
  maxResults: 5,
},

// --- RSS Breaking News ---
rss: {
  enabled: true,
  pollIntervalMs: 15 * 60 * 1000, // 15 minutos
  feeds: [
    'https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30&tags=soccer/wc/league/12',
    'https://feeds.as.com/mrss-p/pages/as/site/as.com/section/futbol/subsection/mundial/',
  ],
  worldCupKeywords: [
    'mundial', 'world cup', 'fifa', 'selección', '2026', 'gol',
    'lesión', 'favorito', 'semifinal', 'final', 'campeón', ...
  ],
},
```

### 4. `agente_mundial/groqEngine.js`

**`generateResponse()` — accept new `webContext` field in `context` param.**

Current signature: `(playerName, question, context, meta = {})`

Add after `chatContext` injection (around line 199):
```js
${context.webContext ? `INFORMACIÓN ACTUALIZADA DE INTERNET:\n${context.webContext}\n` : ''}
```

Also append to the system-level instruction:
```
(en ES) "Si se ha proporcionado 'INFORMACIÓN ACTUALIZADA DE INTERNET', úsala como fuente verídica y actual para responder. Si no hay información de internet, usa tus conocimientos."
```

### 5. `agente_mundial/messageHandler.js`

**`detectIntent()` — add new intent pattern for factual questions.**

Insert before the `return 'general'` fallback (line 112):
```js
if (/quien es|que es|donde esta|cuando es|como funciona|que significa|dime|busca|investiga|sabes de|noticias|última hora|ultima hora|quien ganó|quien gano|quien juega|resultado|marcador|favoritos|sorprend|breaking|news/i.test(lower)) return 'factual';
```

**`processMessage()` — add handling for `'factual'` intent.**
- After the existing intent checks (after `greeting` at line 132), add:
```js
if (intent === 'factual' && config.webSearch.enabled) {
  const webResults = await searchWeb(text, config.webSearch.maxResults);
  if (webResults.length > 0) {
    context.webContext = webResults.map(r => `• ${r.title}: ${r.content.substring(0, 300)}`).join('\n\n');
  }
}
```

This adds `webContext` to the context object that gets passed to `generateResponse()`.

### 6. `agente_mundial/index.js`

Import and start RSS service after initializing Socket.IO.

After `const io = initChatServer(httpServer);` (around line 50), add:
```js
import { startRssService } from './rssFeedService.js';
if (config.rss.enabled) startRssService(io);
```

### 7. `package.json`

Add `rss-parser` dependency:
```json
"rss-parser": "^3.13.6"
```

Run: `npm install rss-parser` (or `pnpm add rss-parser`)

---

## Implementation Order

1. Install `rss-parser` dependency
2. `config.js` — add new config sections
3. `webSearchService.js` — create Tavily wrapper
4. `groqEngine.js` — modify to inject webContext
5. `messageHandler.js` — add `'factual'` intent + web search call
6. `rssFeedService.js` — create RSS polling service
7. `index.js` — start RSS service on boot

---

## Verification

**Web Search:**
- Set `TAVILY_API_KEY` in `.env`
- Send message: "quien es el favorito para ganar el mundial" → should respond with search results
- Send message: "como voy en la porra" → should NOT trigger web search (uses existing ranking intent)

**RSS Breaking News:**
- Start server, check logs for "📡 RSS Service started"
- Wait for polling cycle, check for "📰 X new articles from {feed}"
- If a breaking article is detected: "🚨 BREAKING NEWS broadcast to N groups"
- Check chat and push notifications arrive in all groups

