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

  // --- Mapeo de Grupos ---
  // WhatsApp Group ID -> Group Name (human readable in the web app)
  groups: {
    [process.env.WHATSAPP_GROUP_ID || '120363XXXXXXXXX@g.us']: 'Los Amigos de Dani',
    // 'another_id@g.us': 'Grupo Secundario',
  },

  // --- Mapeo de números de teléfono a nombres de jugador (Global fallback) ---
  phoneToPlayer: {
    [process.env.PHONE_DANI || '34600000001']: 'Dani',
    [process.env.PHONE_JUDAS || '34600000002']: 'Judas',
    [process.env.PHONE_HARRY || '34600000003']: 'Harrry',
    [process.env.PHONE_DANI_GRANDE || '34600000004']: 'Dani Grande',
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
};

export default config;
