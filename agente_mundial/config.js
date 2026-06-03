// ============================================
// CONFIGURACIÓN DEL AGENTE MUNDIAL (SCALED)
// ============================================
// Todas las variables sensibles se leen de .env

import 'dotenv/config';

const config = {
  // --- Groq LLM ---
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.85,
    maxTokens: 500,
  },

  // --- Google Apps Script ---
  googleScript: {
    url: process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbx1_NLJukiXGHYzcWv52zjr_F-0g3pfHc1AaP6CyqStT3YUHHSQC5ctdzHx81m4Lsmp/exec',
  },

  // --- Mapeo de IDs de usuario a nombres de jugador (Global fallback) ---
  userIdToPlayer: {
    // Se puede mapear aquí si es necesario
  },

  // --- Perfiles de personalidad (respaldo local) ---
  playerProfiles: {
    'Dani': { nickname: 'El Optimista', likes: ['Fútbol'], dislikes: ['El VAR'], humor_style: 'Sarcástico' },
    'Dani Grande': { nickname: 'El Jefe', likes: ['Ganar'], dislikes: ['Derrotas'], humor_style: 'Autoritario' },
  },

  // --- Configuración del bot ---
  bot: {
    name: 'Agente Mundial 🏆',
    port: process.env.PORT || 3000,
  },

  // --- Web Search (Tavily) ---
  webSearch: {
    enabled: true,
    apiKey: process.env.TAVILY_API_KEY || '',
    maxResults: 5,
  },

  // --- RSS Breaking News ---
  rss: {
    enabled: true,
    pollIntervalMs: 15 * 60 * 1000,
    feeds: [
      'https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30&tags=soccer/wc/league/12',
      'https://feeds.as.com/mrss-p/pages/as/site/as.com/section/futbol/subsection/mundial/',
    ],
    worldCupKeywords: [
      'mundial', 'world cup', 'fifa', 'selección', 'seleccion', 'mundo',
      'worldcup', '2026', 'clasificación', 'clasificacion',
      'partido', 'gol', 'lesión', 'lesion', 'favorito', 'sorpresa',
      'torneo', 'eliminatorias', 'group', 'grupo', 'bracket',
      'knockout', 'playoff', 'semifinal', 'final', 'champion',
      'campeón', 'campeon', 'mundialista', 'nómina', 'nomina',
      'convocatoria', 'entrenador', 'seleccionador',
    ],
  },
};

export default config;
