import config from './config.js';

const TAVILY_URL = 'https://api.tavily.com/search';

export async function searchWeb(query, maxResults = 5) {
  if (!config.webSearch.enabled || !config.webSearch.apiKey) {
    console.warn('[WebSearch] Deshabilitado o sin API key');
    return [];
  }

  try {
    const response = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.webSearch.apiKey,
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
      }),
    });

    if (!response.ok) {
      console.error(`[WebSearch] HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const results = (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
    }));

    console.log(`[WebSearch] ${results.length} resultados para: "${query.substring(0, 60)}"`);
    return results;
  } catch (error) {
    console.error('[WebSearch] Error:', error.message);
    return [];
  }
}
