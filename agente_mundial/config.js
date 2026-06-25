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

  playerProfiles: {},

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

  // --- Eval System (LLM-as-a-Judge) ---
  evals: {
    enabled: process.env.EVALS_ENABLED !== 'false',
    judgeModel: process.env.JUDGE_MODEL || 'llama-3.1-8b-instant',
    judgeTemperature: 0.1,
    minLanguagePurity: 8,  // threshold no negociable — detecta mezcla de idiomas
    minQuality: 6,          // threshold de humor + personalidad
    maxRetries: 3,          // max intentos de regeneración
    // sampleRate: 1.0 = evalúa todas las respuestas | 0.5 = evalúa 50% (para producción)
    sampleRate: parseFloat(process.env.EVAL_SAMPLE_RATE || '1.0'),
    thresholds: {
      // Valores por defecto (coinciden con minLanguagePurity / minQuality arriba)
      minLanguagePurity: 8,
      minQuality: 6,
      // Overrides por (personalityId) y opcionalmente (personalityId::targetLanguage)
      // La clave `__transcreation__` aplica a todos los idiomas de transcreación.
      overrides: {
        'roncero::es': { minQuality: 5 },
        'fabrizio_romano::es': { minQuality: 7 },
        '__transcreation__': { minLanguagePurity: 7 },
      },
    },
  },

  // --- Transcreation (ES/EN → idiomas culturalmente distantes) ---
  transcreation: {
    enabled: process.env.TRANSCREATION_ENABLED !== 'false',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.7,
    maxRetries: 2,  // max reintentos de transcreación antes de fallback al original
    distantLanguages: ['ko', 'th', 'ar', 'ja', 'ru', 'zh', 'vi', 'hi'],
  },

  // --- Multilingual Support ---
  multilingual: {
    supportedLanguages: ['es', 'en', 'fr', 'pt', 'it', 'de', 'ko', 'th', 'ar', 'ja', 'ru', 'zh', 'vi', 'hi'],
    defaultLanguage: 'es',
  },

  // --- Conversational Corrections ---
  corrections: {
    enabled: process.env.CORRECTIONS_ENABLED !== 'false',
    sampleRate: parseFloat(process.env.CORRECTIONS_SAMPLE_RATE || '1.0'),
    maxPerUserWindow: 3,      // max correcciones por usuario en ventana de tiempo
    dedupeWindowMinutes: 30,  // ventana de tiempo para dedup
  },

  // --- Human-in-the-Loop (HITL) ---
  hitl: {
    maxDailyReviews: parseInt(process.env.HITL_MAX_DAILY || '20'),
    dedupeWindow: parseInt(process.env.HITL_DEDUPE_WINDOW_DAYS || '7'),
    priorityOrder: ['force_approved', 'user_downvote', 'judge_disagree'],
  },

  // --- RSS Breaking News ---
  rss: {
    enabled: true,
    pollIntervalMs: 15 * 60 * 1000,
    feeds: [
      'https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30&tags=soccer/wc/league/12',
      'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/mundial/',
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
