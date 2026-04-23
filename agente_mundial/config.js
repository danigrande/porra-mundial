// ============================================
// CONFIGURACIÓN DEL AGENTE MUNDIAL
// ============================================
// Todas las variables sensibles se leen de .env
// Las que no son sensibles tienen valores por defecto aquí.

import 'dotenv/config';

const config = {
  // --- Groq LLM ---
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.85,
    maxTokens: 500,
  },

  // --- Google Apps Script (tu backend de datos existente) ---
  googleScript: {
    url: process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwUG7NAswIhcLn90C6JkA_Dt-45HBz8Klvmwij2UO0ilh85KUs6tUTz05-wALfTulnN/exec',
  },

  // --- Mapeo de números de teléfono a nombres de jugador ---
  // Formato: "34612345678" (sin +, sin espacios)
  // Rellena esto con los números reales de tus amigos
  phoneToPlayer: {
    [process.env.PHONE_DANI || '34600000001']: 'Dani',
    [process.env.PHONE_JUDAS || '34600000002']: 'Judas',
    [process.env.PHONE_HARRY || '34600000003']: 'Harrry',
    [process.env.PHONE_DANI_GRANDE || '34600000004']: 'Dani Grande',
  },

  // --- Perfiles de personalidad (respaldo local) ---
  // Si no se encuentran en Google Sheets, se usan estos
  playerProfiles: {
    'Dani': {
      nickname: 'El Optimista',
      likes: ['Atacar siempre', 'Real Madrid', 'Goles de chilena'],
      dislikes: ['El VAR', 'Perder tiempo', 'Empates a cero'],
      humor_style: 'Sarcástico pero amigable',
    },
    'Judas': {
      nickname: 'El Traidor',
      likes: ['Resultados inesperados', 'Equipos pequeños', 'La emoción'],
      dislikes: ['Los favoritos', 'Aburrimiento'],
      humor_style: 'Cínico y mordaz',
    },
    'Harrry': {
      nickname: 'El Mago',
      likes: ['Estadísticas', 'Harry Kane', 'Táctica pura'],
      dislikes: ['Fallar penaltis', 'Suerte', 'Caos'],
      humor_style: 'Intelectual y serio',
    },
    'Dani Grande': {
      nickname: 'El Jefe',
      likes: ['Liderazgo', 'Ganar', 'Organización'],
      dislikes: ['Desorden', 'Excusa'],
      humor_style: 'Autoritario y divertido',
    },
  },

  // --- Configuración del bot ---
  bot: {
    name: 'Agente Mundial 🏆',
    // Si se define, el bot solo responde en este grupo
    // Formato: "120363XXXXXXXXX@g.us" (ID de grupo de WhatsApp)
    groupId: process.env.WHATSAPP_GROUP_ID || '',
    // Puerto para el servidor Express (keep-alive)
    port: process.env.PORT || 3000,
  },
};

export default config;
