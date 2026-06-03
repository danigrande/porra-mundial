import config from './config.js';

const TAVILY_URL = 'https://api.tavily.com/search';

const stats = {
  searchCount: 0,
  totalResults: 0,
  lastQueryTime: null,
  lastQuery: null,
  errors: 0,
  recentQueries: [], // last 10
};

export async function searchWeb(query, maxResults = 5) {
  if (!config.webSearch.enabled || !config.webSearch.apiKey) {
    console.warn('[WebSearch] Deshabilitado o sin API key');
    return [];
  }

  stats.searchCount++;
  stats.lastQueryTime = new Date().toISOString();
  stats.lastQuery = query;

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
      stats.errors++;
      console.error(`[WebSearch] HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const results = (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
    }));

    stats.totalResults += results.length;
    stats.recentQueries.unshift({
      query: query.substring(0, 120),
      results: results.length,
      time: new Date().toISOString(),
    });
    if (stats.recentQueries.length > 10) stats.recentQueries.pop();

    console.log(`[WebSearch] ${results.length} resultados para: "${query.substring(0, 60)}"`);
    return results;
  } catch (error) {
    stats.errors++;
    console.error('[WebSearch] Error:', error.message);
    return [];
  }
}

export function getWebSearchStats() {
  return {
    enabled: config.webSearch.enabled,
    configured: !!config.webSearch.apiKey,
    maxResults: config.webSearch.maxResults,
    ...stats,
  };
}
