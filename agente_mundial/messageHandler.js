// ============================================
// MESSAGE HANDLER — Lógica de mensajes (SCALED)
// ============================================

import config from './config.js';
import * as dataFetcher from './dataFetcher.js';
import { calculateLeaderboard, resolveMatchName } from './scoringEngine.js';
import { generateResponse, generateDailySummary } from './groqEngine.js';
import { searchWeb } from './webSearchService.js';
import { getTournamentState, TOURNAMENT_PHASES } from './tournamentState.js';

import { Group } from './models/Group.js';

// Cache organizada por GroupName
const caches = {};
const CACHE_TTL = 30 * 1000; // 30 segundos — datos casi en tiempo real

/**
 * Invalida el cache de todos los grupos (para forzar refresco tras cambios de realidad).
 */
export function invalidateAllCaches() {
  const keys = Object.keys(caches);
  keys.forEach(k => delete caches[k]);
  console.log(`🧹 Cache invalidado para ${keys.length} grupo(s)`);
}

// Cache de grupos (para no hacer query cada mensaje)
const groupCache = new Map();
const GROUP_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

/**
 * Identifica el nombre legible del grupo.
 */
async function resolveGroupName(groupName) {
  const cached = groupCache.get(groupName);
  if (cached && (Date.now() - cached.timestamp) < GROUP_CACHE_TTL) {
    return cached.name;
  }
  try {
    const group = await Group.findOne({ name: groupName });
    if (group) {
      groupCache.set(groupName, { name: group.name, timestamp: Date.now() });
      return group.name;
    }
  } catch (e) {
    console.error('Error buscando grupo en BD:', e.message);
  }
  return groupName;
}

/**
 * Builds a "match drama" context string from reality match events.
 * Highlights late goals (75'+), red cards, and penalty shootouts.
 */
function buildMatchDrama(reality) {
  if (!reality || !reality.events) return '';
  const dramaLines = [];

  for (const [matchKey, events] of Object.entries(reality.events)) {
    if (!Array.isArray(events) || events.length === 0) continue;

    const hKey = `${matchKey}_h`;
    const aKey = `${matchKey}_a`;
    const rH = reality[hKey];
    const rA = reality[aKey];
    const matchName = resolveMatchName(matchKey);
    const scoreStr = (rH !== undefined && rA !== undefined) ? ` (${rH}-${rA})` : '';

    // Check for penalty shootout in KO matches
    let penNote = '';
    if (matchKey.startsWith('ko_')) {
      const num = matchKey.replace('ko_', '');
      const penH = reality[`pen_${num}_h`];
      const penA = reality[`pen_${num}_a`];
      if (penH !== undefined && penA !== undefined) {
        penNote = ` → definido por penaltis (${penH}-${penA})`;
      }
    }

    // Filter late goals (75'+) and red cards
    const keyMoments = events.filter(e => {
      if (e.type === 'Goal' && e.time.elapsed >= 75) return true;
      if (e.type === 'Card' && e.detail === 'Red Card') return true;
      return false;
    });

    const lines = [];
    if (penNote) lines.push(`📊 ${matchName}${scoreStr}${penNote}`);
    keyMoments.forEach(e => {
      const min = e.time.elapsed + (e.time.extra ? `+${e.time.extra}` : '');
      if (e.type === 'Goal') lines.push(`⚽ ${e.team.name}: gol de ${e.player.name} (min ${min})`);
      else if (e.type === 'Card') lines.push(`🟥 ${e.team.name}: ${e.detail} a ${e.player.name} (min ${min})`);
    });
    if (lines.length > 0) dramaLines.push(lines.join('\n'));
  }

  return dramaLines.length > 0 ? 'MOMENTOS CLAVE DE LOS PARTIDOS:\n' + dramaLines.join('\n\n') : '';
}

/**
 * Builds a "rules context" string explaining tournament phases and scoring rules.
 */
function buildRulesContext(groupName, rules) {
  if (!rules) return '';

  const now = Date.now();
  const currentPhase = TOURNAMENT_PHASES.find(p => {
    const start = new Date(p.start).getTime();
    const end = new Date(p.end).getTime();
    return now >= start && now < end;
  });

  const phaseName = currentPhase ? currentPhase.name : 'Desconocida';

  const schedule = TOURNAMENT_PHASES.map(p => {
    const s = new Date(p.start);
    const e = new Date(p.end);
    const opts = { day: 'numeric', month: 'short' };
    return `- ${p.name}: ${s.toLocaleDateString('es-ES', opts)} → ${e.toLocaleDateString('es-ES', opts)}`;
  }).join('\n');

  return `FASE ACTUAL DEL TORNEO: ${phaseName}

CALENDARIO DE FASES:
${schedule}

PUNTUACIÓN VIGENTE:
• Grupos — Signo: ${rules.pts_group_sign || 1} pts | Diferencia: ${rules.pts_group_diff || 2} pts | Exacto: ${rules.pts_group_exact || 3} pts
• Posiciones de grupo: ${rules.pts_group_pos || 1} pts | Clasificado 1/16: ${rules.pts_group_qualify || 2} pts
• Eliminatorias — Signo: ${rules.pts_ko_sign || 2} pts | Diferencia: ${rules.pts_ko_diff || 4} pts | Exacto: ${rules.pts_ko_exact || 6} pts
• Clasificado eliminatorias: ${rules.pts_ko_qualify || 3} pts
• Honor — Campeón: ${rules.pts_honor_champ || 10} | Subcampeón: ${rules.pts_honor_runner || 7} | 3º: ${rules.pts_honor_third || 5} | Bota Oro: ${rules.pts_award_gold || 5}`;
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
    const [predictions, profiles, userMapping, rules, reality, tournamentState] = await Promise.all([
      dataFetcher.getAllPredictions(groupName),
      dataFetcher.getAllProfiles(groupName),
      dataFetcher.getUserMapping(groupName),
      dataFetcher.getRules(groupName),
      dataFetcher.getReality(),
      getTournamentState(groupName)
    ]);

    // Calcular el Ranking real con puntos
    const leaderboard = calculateLeaderboard(predictions, reality, rules);

    caches[groupName] = {
      predictions,
      profiles,
      userMapping,
      rules,
      leaderboard,
      reality,
      tournamentState,
      timestamp: now
    };

    console.log(`✅ Datos sincronizados para ${groupName}: ${leaderboard.length} jugadores con puntos calculados.`);
  } catch (error) {
    console.error(`Error refrescando cache para ${groupName}:`, error.message);
  }
}

/**
 * Identifica al jugador por su userId dentro de un grupo.
 */
export function identifyPlayer(userId, groupName) {
  if (!userId) return null;
  const cache = caches[groupName];
  
  if (cache && cache.userMapping) {
    return cache.userMapping[userId] || null;
  }

  // Fallback global
  if (config.userIdToPlayer) {
    return config.userIdToPlayer[userId] || null;
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
  if (/quien es|que es|donde esta|cuando es|como funciona|que significa|dime sobre|busca|investiga|sabes de|noticias|ultima hora|quien gano|quien juega|resultado|marcador|favoritos|sorprend|breaking|news|que opinas de|que sabes de/i.test(lower)) return 'factual';
  return 'general';
}

/**
 * Procesa un mensaje y genera una respuesta.
 */
export async function processMessage(text, senderUserId, groupName) {
  // 1. Refrescar datos del grupo
  await refreshCache(groupName);
  const cache = caches[groupName] || {};

  console.log(`🤖 [Identify] Intentando identificar: ${senderUserId} en ${groupName}`);
  let playerName = identifyPlayer(senderUserId, groupName);
  console.log(`🤖 [Identify] Resultado: ${playerName || 'No identificado'}`);
  
  const intent = detectIntent(text);

  if (intent === 'help') {
    return `🏆 *Agente Mundial* — Asistente del grupo *${groupName || 'Privado'}*
\nPuedes preguntarme por la clasificación, tu posición, noticias del mundial o un resumen de la jornada.`;
  }

  // 2a. Web Search para preguntas factuales
  if (intent === 'factual' && config.webSearch.enabled) {
    console.log(`🔍 Búsqueda web para: "${text.substring(0, 80)}"`);
    const webResults = await searchWeb(text, config.webSearch.maxResults);
    if (webResults.length > 0) {
      const webContext = webResults.map((r, i) =>
        `Fuente ${i + 1}: ${r.title}\n${r.content.substring(0, 300)}`
      ).join('\n\n');
      console.log(`🔍 Web search OK: ${webResults.length} resultados`);

      // Construir contexto con la información web
      const rulesContext = buildRulesContext(groupName, cache.rules);
      const matchDrama = buildMatchDrama(cache.reality);

      const context = {
        groupName,
        ranking: cache.leaderboard,
        playerStats: null,
        profile: playerName ? (cache.profiles?.[playerName] || config.playerProfiles?.[playerName]) : null,
        leaderboard: cache.leaderboard,
        chatContext: '',
        webContext,
        rulesContext,
        matchDrama
      };

      const response = await generateResponse(playerName || 'Desconocido', text, context);
      return response;
    }
    // Si no hay resultados web, cae al flujo 'general'
  }

  // 3. Si el usuario pide su estado, ranking o resumen
  if (intent === 'ranking' || intent === 'my_status' || intent === 'explain_score' || intent === 'summary' || intent === 'general') {
    if (!playerName) {
      // Permitir que 'general' y 'ranking' pasen aunque no estén identificados
      if (intent !== 'general' && intent !== 'ranking') {
        return "No tengo tu usuario registrado, ¡jugón! Dile al administrador que te añada a la porra.";
      }
    }

    const playerStats = cache.leaderboard?.find(p => 
        p.name.trim().toLowerCase() === playerName?.trim().toLowerCase()
    );
    const profile = cache.profiles ? (cache.profiles[playerName] || Object.values(cache.profiles).find(pr => pr.nickname === playerName)) : null;
    
    // --- RAG: Buscar contexto de este jugador ---
    let chatContext = "";
    try {
        const rag = await import('./ragService.js');
        const cleanGroupName = groupName ? groupName.trim() : "";
        const effectiveSearchName = playerName || 'Agente Mundial';
        chatContext = await rag.retrieveContextForPlayer(cleanGroupName, effectiveSearchName);
    } catch (e) {
        console.error("Error recuperando RAG context:", e);
    }

    const context = {
      groupName,
      ranking: cache.leaderboard,
      playerStats,
      profile,
      leaderboard: cache.leaderboard,
      chatContext,
      rulesContext: buildRulesContext(groupName, cache.rules),
      matchDrama: buildMatchDrama(cache.reality)
    };

    console.log(`🤖 Generando respuesta IA para ${playerName || 'Desconocido'} con ${chatContext.length > 50 ? 'contexto RAG' : 'sin RAG'}...`);
    const response = await generateResponse(playerName || 'Desconocido', text, context);
    return response;
  }

  // 4. Construir contexto (fallback para otros intents)
  const profile = playerName ? (cache.profiles?.[playerName] || config.playerProfiles?.[playerName]) : null;
  const playerStats = playerName ? (cache.leaderboard?.find(p => p.name === playerName)) : null;

  const context = {
    groupName,
    ranking: cache.leaderboard,
    leaderboard: cache.leaderboard,
    playerStats,
    profile,
    rules: cache.rules,
    rulesContext: buildRulesContext(groupName, cache.rules),
    matchDrama: buildMatchDrama(cache.reality)
  };

  const effectiveName = playerName || 'Desconocido';
  let effectiveQuestion = text;

  if (!playerName) {
    effectiveQuestion = `[Usuario no identificado pregunta]: ${text}. Dile que no sé quién es y que debe registrarse en la web para el grupo ${groupName}.`;
  }

  return await generateResponse(effectiveName, effectiveQuestion, context);
}

/**
 * Genera un resumen para un grupo.
 * @param {string} groupName - Nombre del grupo
 * @param {boolean} force - Si es true, ignora la comprobación de si hubo partidos hoy
 */
export async function generateGroupSummary(groupName, force = false) {
  const resolvedName = await resolveGroupName(groupName);
  if (!resolvedName) return "Error: Grupo no reconocido";

  await refreshCache(resolvedName);
  const cache = caches[resolvedName];

  if (!cache || !cache.leaderboard || cache.leaderboard.length === 0) {
    return '📊 No hay datos suficientes para el grupo ' + resolvedName;
  }

  // Comprobar si hubo partidos hoy (a menos que se force el resumen o estemos en TEST_MODE)
  const isTestMode = process.env.TEST_MODE === 'true';
  if (!force && !isTestMode) {
    const today = new Date().toISOString().split('T')[0];
    const reality = cache.reality || {};
    const hasMatchesToday = Object.entries(reality).some(([key, val]) => 
      key.endsWith('_date') && typeof val === 'string' && val.startsWith(today)
    );
    
    if (!hasMatchesToday) {
      console.log(`📭 No hubo partidos hoy (${today}) para el grupo ${resolvedName}. Saltando resumen.`);
      return null; 
    }
  }

  return await generateDailySummary(cache.leaderboard, cache.profiles || {}, resolvedName);
}
