// ============================================
// MESSAGE HANDLER — Lógica de mensajes
// ============================================
// Procesa mensajes entrantes, detecta intenciones,
// construye contexto y genera respuestas.
// Este módulo es AGNÓSTICO de la plataforma de mensajería.

import config from './config.js';
import { getAllPredictions, getAllProfiles, getPlayerProfile } from './dataFetcher.js';
import { calculateLeaderboard } from './scoringEngine.js';
import { generateResponse, generateDailySummary } from './groqEngine.js';

// Cache para evitar llamadas excesivas a Google Sheets
let cachedLeaderboard = null;
let cachedProfiles = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Refresca la cache de datos si ha expirado.
 */
async function refreshCache() {
  const now = Date.now();
  if (cachedLeaderboard && (now - cacheTimestamp) < CACHE_TTL) {
    return; // Cache aún válida
  }

  console.log('📊 Refrescando cache de datos...');
  try {
    const [predictions, profiles] = await Promise.all([
      getAllPredictions(),
      getAllProfiles(),
    ]);

    cachedProfiles = profiles;

    // Para el leaderboard necesitamos los resultados reales
    // En producción, estos vendrán de fixture_testing o de resultados reales
    // Por ahora, intentamos obtenerlos de las predicciones existentes
    // NOTA: El scoring real requiere "reality" data - que vendrá del fixture
    // Por ahora, construimos un leaderboard simplificado
    if (Object.keys(predictions).length > 0) {
      // Intentar obtener reality data del Google Script
      // (esto podría requerir un endpoint adicional en el futuro)
      cachedLeaderboard = Object.entries(predictions).map(([name, data], idx) => ({
        name,
        position: idx + 1,
        totalPts: 0,
        exactHits: 0,
        groupPts: 0,
        koPts: 0,
        honorPts: 0,
        hasPredictions: true,
      }));
    }

    cacheTimestamp = now;
    console.log(`✅ Cache refrescada: ${cachedLeaderboard?.length || 0} jugadores`);
  } catch (error) {
    console.error('Error refrescando cache:', error.message);
  }
}

/**
 * Identifica al jugador por su número de teléfono.
 * @param {string} phoneNumber - Número en formato "34612345678@s.whatsapp.net"
 * @returns {string|null} Nombre del jugador o null
 */
export function identifyPlayer(phoneNumber) {
  // Extraer solo los dígitos del número
  const digits = phoneNumber.replace(/[^0-9]/g, '');

  // Buscar en el mapeo
  for (const [phone, name] of Object.entries(config.phoneToPlayer)) {
    if (digits.includes(phone) || phone.includes(digits)) {
      return name;
    }
  }

  return null;
}

/**
 * Detecta la intención del mensaje.
 * @param {string} text - Texto del mensaje
 * @returns {string} Tipo de intención
 */
export function detectIntent(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Ranking / Clasificación
  if (/ranking|clasificacion|tabla|leaderboard|quien va|como vamos|posicion/.test(lower)) {
    return 'ranking';
  }

  // Estado personal
  if (/como voy|mis puntos|mi posicion|cuantos puntos|mi score|como estoy/.test(lower)) {
    return 'my_status';
  }

  // ¿Por qué pocos/muchos puntos?
  if (/por ?que.*(pocos|muchos|tantos|tan pocos)|que me falta|donde pierdo|donde fallo/.test(lower)) {
    return 'explain_score';
  }

  // Resumen
  if (/resumen|resume|summary|resena/.test(lower)) {
    return 'summary';
  }

  // Ayuda
  if (/ayuda|help|que puedes|comandos|que haces/.test(lower)) {
    return 'help';
  }

  // Saludo
  if (/^(hola|hey|buenas|ey|hello|wenas|que tal)/i.test(lower)) {
    return 'greeting';
  }

  // Pregunta general sobre fútbol/porra
  return 'general';
}

/**
 * Comprueba si el mensaje va dirigido al bot.
 * En un grupo, solo responde si le mencionan o usan trigger words.
 * @param {string} text - Texto del mensaje
 * @param {boolean} isGroup - Si el mensaje viene de un grupo
 * @param {boolean} isMentioned - Si el bot fue mencionado directamente
 * @returns {boolean}
 */
export function shouldRespond(text, isGroup, isMentioned) {
  if (!isGroup) return true; // En chat privado siempre responde
  return isMentioned; // En grupo SOLO si ha sido mencionado directamente con @
}

/**
 * Procesa un mensaje y genera una respuesta.
 * Esta es la función principal que orquesta todo el flujo.
 * 
 * @param {string} text - Texto del mensaje del usuario
 * @param {string} senderPhone - Número de teléfono del remitente
 * @param {boolean} isGroup - Si viene de un grupo
 * @param {boolean} isMentioned - Si el bot fue mencionado
 * @returns {string|null} Respuesta del bot, o null si no debe responder
 */
export async function processMessage(text, senderPhone, isGroup, isMentioned) {
  // ¿Debe responder?
  if (!shouldRespond(text, isGroup, isMentioned)) {
    return null;
  }

  // Refrescar datos
  await refreshCache();

  // Identificar al jugador
  const playerName = identifyPlayer(senderPhone);
  const intent = detectIntent(text);

  // Manejar ayuda directamente (sin LLM)
  if (intent === 'help') {
    return `🏆 *Agente Mundial* — Tu asistente de la Porra

Puedes preguntarme cosas como:
• "@Agente ¿Cómo voy?" — Tu posición y puntos
• "@Agente ¿Quién va primero?" — Ranking general
• "@Agente ¿Por qué tengo tan pocos puntos?" — Análisis
• "@Agente Resumen" — Resumen de la jornada

Solo escucho en el grupo cuando me mencionas con @ 👂`;
  }

  // Construir contexto para el LLM
  const profile = playerName
    ? (cachedProfiles?.[playerName] || config.playerProfiles[playerName] || null)
    : null;

  const playerStats = playerName && cachedLeaderboard
    ? cachedLeaderboard.find(p => p.name === playerName) || null
    : null;

  const context = {
    ranking: cachedLeaderboard,
    playerStats,
    profile,
    leaderboard: cachedLeaderboard,
  };

  // Ajustar la pregunta si el jugador no está identificado
  const effectiveName = playerName || 'Desconocido';
  let effectiveQuestion = text;

  if (!playerName) {
    effectiveQuestion = `[Usuario no identificado pregunta]: ${text}. ` +
      'No sé quién es este usuario, respóndele amablemente pero dile que no sé quién es ' +
      'y que el admin (Dani Grande) tiene que configurar su número de teléfono.';
  }

  // Generar respuesta con Groq
  const response = await generateResponse(effectiveName, effectiveQuestion, context);
  return response;
}

/**
 * Genera y devuelve un resumen completo de la jornada.
 * Para publicar en el grupo de forma programada.
 * @returns {string} Resumen de la jornada
 */
export async function generateGroupSummary() {
  await refreshCache();

  const profiles = { ...config.playerProfiles, ...(cachedProfiles || {}) };
  const leaderboard = cachedLeaderboard || [];

  if (leaderboard.length === 0) {
    return '📊 Aún no hay datos de la porra para generar un resumen. ¡Espera a que se jueguen partidos!';
  }

  return await generateDailySummary(leaderboard, profiles);
}

/**
 * Fuerza el refresco de la cache.
 */
export async function forceRefresh() {
  cacheTimestamp = 0;
  await refreshCache();
}
