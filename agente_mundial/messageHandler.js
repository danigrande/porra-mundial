// ============================================
// MESSAGE HANDLER — Lógica de mensajes (SCALED)
// ============================================

import config from './config.js';
import * as dataFetcher from './dataFetcher.js';
import { calculateLeaderboard, resolveMatchName } from './scoringEngine.js';
import { generateResponse, generateWithQualityGate, getSystemPrompt } from './groqEngine.js';
import { generateDailySummary } from './groqEngine.js';
import { searchWeb } from './webSearchService.js';
import { getTournamentState, TOURNAMENT_PHASES } from './tournamentState.js';
import { detectTargetLanguage, isTranscreationNeeded } from './languageRouter.js';
import { getAnchors, getSourceLanguage } from './anchors.js';
import { transcreateWithQualityGate } from './transcreationService.js';

import { Group } from './models/Group.js';
import { Correction } from './models/Correction.js';
import { AILog } from './models/AILog.js';
import Groq from 'groq-sdk';

// Cache organizada por GroupName
const caches = {};
const CACHE_TTL = 30 * 1000; // 30 segundos — datos casi en tiempo real

// Memoria de últimas respuestas del bot por {userId, groupName} para detección de correcciones
const lastBotResponse = new Map();
const LAST_BOT_TTL = 5 * 60 * 1000; // 5 minutos

// Conversación reciente en memoria: {userId}::{groupName} → Exchange[]
const conversationBuffer = new Map();
const CONVERSATION_TTL = 15 * 60 * 1000; // 15 minutos
const MAX_EXCHANGES = 6;

function getConvKey(userId, groupName) {
  return `${userId}::${groupName}`;
}

function getLastBotKey(userId, groupName) {
  return `${userId}::${groupName}`;
}

export function storeLastBotResponse(userId, groupName, responseText, meta) {
  const key = getLastBotKey(userId, groupName);
  lastBotResponse.set(key, { response: responseText, meta, timestamp: Date.now() });
}

function getLastBotResponse(userId, groupName) {
  const key = getLastBotKey(userId, groupName);
  const entry = lastBotResponse.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > LAST_BOT_TTL) {
    lastBotResponse.delete(key);
    return null;
  }
  return entry;
}

function storeConversationExchange(userId, groupName, userText, botText) {
  const key = getConvKey(userId, groupName);
  const now = Date.now();
  let exchanges = conversationBuffer.get(key) || [];
  exchanges = exchanges.filter(e => now - e.timestamp < CONVERSATION_TTL);
  exchanges.push({ userText, botText, timestamp: now });
  if (exchanges.length > MAX_EXCHANGES) exchanges.shift();
  conversationBuffer.set(key, exchanges);
}

function getConversationContext(userId, groupName) {
  const key = getConvKey(userId, groupName);
  const now = Date.now();
  const exchanges = (conversationBuffer.get(key) || []).filter(e => now - e.timestamp < CONVERSATION_TTL);
  if (exchanges.length === 0) return '';
  return exchanges.map(e => `Usuario: ${e.userText}\nAgente: ${e.botText}`).join('\n\n');
}

// Pre-filter rápido: ¿el mensaje del usuario referencia la respuesta del bot?
function hasCorrectionSignal(userText, botResponse) {
  const lower = userText.toLowerCase();
  // Palabras clave de corrección en español
  const correctionMarkers = ['no es así', 'en realidad', 'deberías', 'no es correcto', 'te equivocas',
    'quiero decir', 'me refiero a', 'corrige', 'no eso', 'eso no', 'no me refiero',
    'mal', 'incorrecto', 'no tienes razón', 'no has entendido'];
  if (correctionMarkers.some(m => lower.includes(m))) return true;

  // Si el mensaje es muy corto (< 5 chars) podría ser "no", "mal" etc.
  if (lower.length <= 5 && ['no', 'mal', 'nop', 'nope', 'incorrecto'].includes(lower.trim())) return true;

  // Si el mensaje repite parte de la respuesta del bot con negación
  const words = lower.split(/\s+/).filter(w => w.length > 3);
  const botLower = botResponse.toLowerCase();
  const matchingWords = words.filter(w => botLower.includes(w));
  if (matchingWords.length >= 2 && lower.includes('no')) return true;

  return false;
}

async function detectAndSaveCorrection(userText, senderUserId, playerName, groupName, lastBotEntry) {
  // Pre-filter rápido — ahorra llamadas LLM
  if (!hasCorrectionSignal(userText, lastBotEntry.response)) return;

  // Rate limit: max correcciones por usuario en ventana
  const windowStart = new Date(Date.now() - (config.corrections?.dedupeWindowMinutes || 30) * 60 * 1000);
  const recentCount = await Correction.countDocuments({
    userId: senderUserId,
    createdAt: { $gte: windowStart }
  });
  if (recentCount >= (config.corrections?.maxPerUserWindow || 3)) return;

  // LLM-based classification
  const groq = new Groq({ apiKey: config.groq.apiKey });
  const detectionPrompt = `Eres un clasificador. Analiza si el usuario está CORRIGIENDO al bot.

BOT respondió: """${lastBotEntry.response.substring(0, 1000)}"""

USUARIO respondió: """${userText.substring(0, 500)}"""

Pregunta: ¿El usuario está corrigiendo al bot? (responde solo YES o NO)
Si YES, extrae el TEXTO_CORREGIDO (lo que el usuario sugiere que el bot debería haber dicho).
Si NO, responde solo NO.

Formato: YES|NO||texto_corregido`;

  let result;
  let startTime = Date.now();
  let usage = {};
  try {
    const completion = await groq.chat.completions.create({
      model: config.evals.judgeModel || 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: detectionPrompt }],
      temperature: 0.1,
      max_tokens: 200
    });
    result = completion.choices?.[0]?.message?.content?.trim() || 'NO';
    usage = completion.usage || {};
  } catch (e) {
    AILog.create({
      type: 'correction_detection',
      playerName: playerName || senderUserId,
      groupName,
      systemPrompt: '',
      userPrompt: detectionPrompt,
      groqResponse: '',
      model: config.evals.judgeModel || 'llama-3.1-8b-instant',
      temperature: 0.1,
      maxTokens: 200,
      latencyMs: Date.now() - startTime,
      source: 'chat',
      callSource: 'correctionDetection',
      success: false,
      errorMessage: e.message,
      anchorsUsed: lastBotEntry.meta?.personalityId || '',
      targetLanguage: lastBotEntry.meta?.targetLanguage || 'es',
    }).catch(() => {});
    return;
  }

  AILog.create({
    type: 'correction_detection',
    playerName: playerName || senderUserId,
    groupName,
    systemPrompt: '',
    userPrompt: detectionPrompt,
    groqResponse: result,
    model: config.evals.judgeModel || 'llama-3.1-8b-instant',
    temperature: 0.1,
    maxTokens: 200,
    tokensUsed: usage.total_tokens || 0,
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    latencyMs: Date.now() - startTime,
    source: 'chat',
    callSource: 'correctionDetection',
    success: true,
    evalPassed: result.startsWith('YES'),
    anchorsUsed: lastBotEntry.meta?.personalityId || '',
    targetLanguage: lastBotEntry.meta?.targetLanguage || 'es',
  }).catch(() => {});

  if (!result.startsWith('YES')) return;

  const correctedText = result.includes('||') ? result.split('||').slice(1).join('||').trim() : '';

  await Correction.create({
    originalResponse: lastBotEntry.response.substring(0, 2000),
    correctedText: correctedText || userText.substring(0, 500),
    userId: senderUserId,
    userName: playerName || senderUserId,
    groupName,
    personalityId: lastBotEntry.meta?.personalityId,
    targetLanguage: lastBotEntry.meta?.targetLanguage || 'es',
    context: userText.substring(0, 500),
    originalJudgeScores: lastBotEntry.meta?.judgeScores,
    detectorConfidence: result.includes('||') ? 0.9 : 0.7,
    status: 'pending'
  });

  console.log(`✏️ [Correction] Guardada corrección de ${playerName || senderUserId} en ${groupName}`);
}

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
    if (leaderboard.length > 0) {
      console.log(`🏆 Top 3: ${leaderboard.slice(0, 3).map(p => `${p.position}. ${p.name} (${p.totalPts})`).join(' | ')}`);
    }
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

  // Fire-and-forget: detección de corrección conversacional
  if (config.corrections?.enabled !== false && Math.random() < (config.corrections?.sampleRate || 1.0)) {
    const lastBotEntry = getLastBotResponse(senderUserId, groupName);
    if (lastBotEntry) {
      detectAndSaveCorrection(text, senderUserId, playerName, groupName, lastBotEntry).catch(e => {
        if (process.env.NODE_ENV !== 'production') console.error('[Correction] Detection error:', e.message);
      });
    }
  }

  if (intent === 'help') {
    return {
      response: `🏆 *Agente Mundial* — Asistente del grupo *${groupName || 'Privado'}*
\nPuedes preguntarme por la clasificación, tu posición, noticias del mundial o un resumen de la jornada.`,
      personalityId: null,
      targetLanguage: null,
      ailogId: null,
      judgeScores: null,
      forceApproved: false
    };
  }

  // --- Unificar: perfil, personalidad, idioma ---
  const profile = playerName
    ? (cache.profiles?.[playerName] || config.playerProfiles?.[playerName] || null)
    : null;
  const personalityId = profile?.ai_personality || 'andres_montes';
  const playerStats = playerName
    ? cache.leaderboard?.find(p => p.name.trim().toLowerCase() === playerName.trim().toLowerCase())
    : null;
  const fragName = playerName || 'Desconocido';
  const anchors = getAnchors(personalityId);
  const targetLang = detectTargetLanguage(text, personalityId);
  const needsTranscreation = isTranscreationNeeded(targetLang);
  const generationLang = needsTranscreation ? getSourceLanguage(personalityId) : targetLang;

  // --- 2. RAG context (siempre, excepto help ya retornó) ---
  let chatContext = "";
  try {
    const rag = await import('./ragService.js');
    const cleanGroupName = groupName ? groupName.trim() : "";
    const effectiveSearchName = playerName || 'Agente Mundial';
    chatContext = await rag.semanticSearchContextForPlayer(cleanGroupName, effectiveSearchName, text);
  } catch (e) {
    console.error("Error recuperando RAG context:", e);
  }

  // --- 3. Web Search (si factual O no hay datos locales) ---
  let webContext = "";
  if (config.webSearch?.enabled && (intent === 'factual' || !cache.leaderboard?.length)) {
    try {
      const webResults = await searchWeb(text, 3);
      if (webResults.length > 0) {
        webContext = webResults.map((r, i) =>
          `Fuente ${i + 1}: ${r.title}\n${r.content.substring(0, 200)}`
        ).join('\n\n');
        console.log(`🔍 Web search OK: ${webResults.length} resultados`);
      }
    } catch (e) {
      console.error("Error en web search:", e);
    }
  }

  // --- 4. Construir contexto unificado ---
  const convContext = getConversationContext(senderUserId, groupName);
  const context = {
    groupName,
    ranking: cache.leaderboard,
    playerStats,
    profile,
    leaderboard: cache.leaderboard,
    chatContext,
    webContext,
    convContext,
    rulesContext: buildRulesContext(groupName, cache.rules),
    matchDrama: buildMatchDrama(cache.reality),
  };

  // Usuario no identificado en intents que requieren identificación
  let effectiveQuestion = text;
  if (!playerName && intent !== 'general' && intent !== 'ranking') {
    effectiveQuestion = `[Usuario no identificado pregunta]: ${text}. Dile que no sé quién es y que debe registrarse en la web para el grupo ${groupName}.`;
  }

  console.log(`🤖 Generando respuesta para ${fragName} | lang=${targetLang} | transcreation=${needsTranscreation} | RAG=${chatContext.length > 50 ? 'OK' : 'sin datos'} | web=${webContext ? 'OK' : 'sin datos'}...`);

  // --- 5. Generar con Quality Gate ---
  const result = await generateWithQualityGate(fragName, effectiveQuestion, context, {
    personalityId,
    anchors,
    targetLanguage: generationLang,
    source: 'chat',
    maxAttempts: config.evals?.maxRetries || 3,
  });

  // --- 6. Transcreación si es necesaria ---
  if (needsTranscreation && (result.judgment?.passed || result.forceApproved)) {
    const systemPrompt = getSystemPrompt(personalityId);
    const transcreated = await transcreateWithQualityGate(
      result.response, getSourceLanguage(personalityId), targetLang,
      personalityId, anchors, context, systemPrompt
    );
    console.log(`🌐 [Transcreation] ${transcreated.usedFallback ? 'FALLBACK al original' : `OK en ${targetLang}`} (${transcreated.attempts} intentos)`);
    return {
      response: transcreated.text,
      personalityId,
      targetLanguage: targetLang,
      ailogId: result.ailogId,
      judgeScores: result.judgment?.scores,
      forceApproved: result.forceApproved
    };
  }

  return {
    response: result.response,
    personalityId,
    targetLanguage: generationLang,
    ailogId: result.ailogId,
    judgeScores: result.judgment?.scores,
    forceApproved: result.forceApproved
  };
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
