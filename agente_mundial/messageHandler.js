// ============================================
// MESSAGE HANDLER — Lógica de mensajes (SCALED)
// ============================================

import config from './config.js';
import * as dataFetcher from './dataFetcher.js';
import { calculateLeaderboard } from './scoringEngine.js';
import { generateResponse, generateDailySummary } from './groqEngine.js';

// Cache organizada por GroupName
const caches = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Identifica el nombre legible del grupo a partir del ID de WhatsApp.
 */
function resolveGroupName(groupId) {
  const name = config.groups[groupId];
  // Si el nombre existe, lo normalizamos a minúsculas o al formato que espera la DB
  // En este caso, parece que la DB tiene "Los amigos de Dani"
  return name || null;
}

/**
 * Refresca la cache de un grupo específico.
 */
export async function refreshCache(groupName) {
  if (!groupName) return;

  const now = Date.now();
  const cache = caches[groupName] || {};
  
  if (cache.leaderboard && (now - (cache.timestamp || 0)) < CACHE_TTL) {
    return; // Cache aún válida
  }

  console.log(`📊 Refrescando cache para grupo: ${groupName}...`);
  try {
    const [predictions, profiles, phoneMapping, rules, reality] = await Promise.all([
      dataFetcher.getAllPredictions(groupName),
      dataFetcher.getAllProfiles(groupName),
      dataFetcher.getPhoneMapping(groupName),
      dataFetcher.getRules(groupName),
      dataFetcher.getReality()
    ]);

    // Calcular el Ranking real con puntos
    const leaderboard = calculateLeaderboard(predictions, reality, rules);

    caches[groupName] = {
      predictions,
      profiles,
      phoneMapping,
      rules,
      leaderboard,
      reality,
      timestamp: now
    };

    console.log(`✅ Datos sincronizados para ${groupName}: ${leaderboard.length} jugadores con puntos calculados.`);
  } catch (error) {
    console.error(`Error refrescando cache para ${groupName}:`, error.message);
  }
}

/**
 * Identifica al jugador por su número de teléfono dentro de un grupo.
 */
export function identifyPlayer(phoneNumber, groupName) {
  const digits = phoneNumber.replace(/[^0-9]/g, '');
  const cache = caches[groupName];
  
  if (cache && cache.phoneMapping) {
    for (const [phone, name] of Object.entries(cache.phoneMapping)) {
      if (digits.includes(phone) || phone.includes(digits)) return name;
    }
  }

  // Fallback global
  for (const [phone, name] of Object.entries(config.phoneToPlayer)) {
    if (digits.includes(phone) || phone.includes(digits)) return name;
  }

  return null;
}

/**
 * Detecta la intención del mensaje (sin cambios).
 */
export function detectIntent(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/ranking|clasificacion|tabla|leaderboard|quien va|como vamos|posicion/.test(lower)) return 'ranking';
  if (/como voy|mis puntos|mi posicion|cuantos puntos|mi score|como estoy/.test(lower)) return 'my_status';
  if (/por ?que.*(pocos|muchos|tantos|tan pocos)|que me falta|donde pierdo|donde fallo/.test(lower)) return 'explain_score';
  if (/resumen|resume|summary|resena/.test(lower)) return 'summary';
  if (/ayuda|help|que puedes|comandos|que haces/.test(lower)) return 'help';
  if (/^(hola|hey|buenas|ey|hello|wenas|que tal)/i.test(lower)) return 'greeting';
  return 'general';
}

/**
 * Procesa un mensaje y genera una respuesta.
 */
export async function processMessage(text, senderPhone, isGroup, isMentioned, whatsappGroupId) {
  // 1. Identificar Grupo
  const groupName = isGroup ? resolveGroupName(whatsappGroupId) : null;
  
  if (isGroup && !isMentioned) return null;
  if (isGroup && !groupName) {
    return "⚠️ Este grupo no está registrado en mi configuración. Dile al administrador que añada el ID " + whatsappGroupId + " a config.js";
  }

  // 2. Refrescar datos del grupo
  await refreshCache(groupName);
  const cache = caches[groupName] || {};

  // 3. Identificar al jugador
  let playerName = identifyPlayer(senderPhone, groupName);
  
  const intent = detectIntent(text);

  if (intent === 'help') {
    return `🏆 *Agente Mundial* — Asistente del grupo *${groupName || 'Privado'}*
\nPuedes preguntarme por el ranking, tu posición o un resumen de la jornada.`;
  }

  // 4. Si el usuario pide su estado o ranking
  if (intent === 'my_status' || intent === 'explain_score' || intent === 'summary') {
    if (!playerName) {
      return "No tengo tu teléfono registrado, ¡jugón! Dile al administrador que te añada a la porra.";
    }

    const playerStats = cache.leaderboard?.find(p => 
        p.name.trim().toLowerCase() === playerName?.trim().toLowerCase()
    );
    const profile = cache.profiles ? (cache.profiles[playerName] || Object.values(cache.profiles).find(pr => pr.nickname === playerName)) : null;
    
    // --- RAG: Buscar contexto de este jugador en WhatsApp ---
    let chatContext = "";
    try {
        const rag = await import('./ragService.js');
        chatContext = await rag.retrieveContextForPlayer(whatsappGroupId || process.env.WHATSAPP_GROUP_ID, playerName);
    } catch (e) {
        console.error("Error recuperando RAG context:", e);
    }

    const context = {
      groupName,
      ranking: cache.leaderboard,
      playerStats,
      profile,
      leaderboard: cache.leaderboard,
      chatContext // NUEVO
    };

    console.log(`🤖 Generando respuesta IA para ${playerName} con ${chatContext.length > 50 ? 'contexto RAG' : 'sin RAG'}...`);
    const response = await generateResponse(playerName, text, context);
    return response;
  }

  // 4. Construir contexto (fallback para otros intents)
  const profile = playerName ? (cache.profiles?.[playerName] || config.playerProfiles[playerName]) : null;
  const playerStats = playerName ? (cache.leaderboard?.find(p => p.name === playerName)) : null;

  const context = {
    groupName,
    ranking: cache.leaderboard,
    playerStats,
    profile,
    rules: cache.rules
  };

  const effectiveName = playerName || 'Desconocido';
  let effectiveQuestion = text;

  if (!playerName && isGroup) {
    effectiveQuestion = `[Usuario no identificado pregunta]: ${text}. Dile que no sé quién es y que debe registrar su número en la web para el grupo ${groupName}.`;
  }

  return await generateResponse(effectiveName, effectiveQuestion, context);
}

/**
 * Genera un resumen para un grupo.
 * @param {string} whatsappGroupId - ID del grupo en WhatsApp
 * @param {boolean} force - Si es true, ignora la comprobación de si hubo partidos hoy
 */
export async function generateGroupSummary(whatsappGroupId, force = false) {
  const groupName = resolveGroupName(whatsappGroupId);
  if (!groupName) return "Error: Grupo no reconocido";

  await refreshCache(groupName);
  const cache = caches[groupName];

  if (!cache || !cache.leaderboard || cache.leaderboard.length === 0) {
    return '📊 No hay datos suficientes para el grupo ' + groupName;
  }

  // Comprobar si hubo partidos hoy (a menos que se force el resumen)
  if (!force) {
    const today = new Date().toISOString().split('T')[0];
    const reality = cache.reality || {};
    const hasMatchesToday = Object.entries(reality).some(([key, val]) => 
      key.endsWith('_date') && typeof val === 'string' && val.startsWith(today)
    );
    
    if (!hasMatchesToday) {
      console.log(`📭 No hubo partidos hoy (${today}) para el grupo ${groupName}. Saltando resumen.`);
      return null; 
    }
  }

  return await generateDailySummary(cache.leaderboard, cache.profiles || {}, groupName);
}
