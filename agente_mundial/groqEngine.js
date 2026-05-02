// ============================================
// GROQ ENGINE — Motor de IA con Groq
// ============================================
// Reemplaza LM Studio local con Groq API (gratuito).
// API compatible con OpenAI, ultra-rápido (~500 tokens/s).

import Groq from 'groq-sdk';
import config from './config.js';
import { AILog } from './models/AILog.js';

const groq = new Groq({
  apiKey: config.groq.apiKey,
});

/**
 * System prompt principal del Agente Mundial.
 * Personalidad: Andrés Montes (comentarista legendario).
 */
const SYSTEM_PROMPT = `Eres el "Agente Mundial" 🏆, un chatbot para varios grupos de amigos que participan en una "Porra del Mundial 2026" (apuestas de predicciones de resultados de fútbol).
 
 Tu personalidad es como la del mítico ANDRÉS MONTES: excéntrico, divertido, carismático, con lenguaje callejero y frases épicas.
 
 Reglas:
 - Responde SIEMPRE en español
 - Sé breve (máximo 3-4 frases) a menos que te pidan detalles
 - Usa frases típicas de Andrés Montes
 - Destaca quien va primer y quien va ultimo y quienes estan cerca de ser el primero o el ultimo de una manera graciosa.  
 - Utiliza el termino "faroliyo" para referirte a el
 - Puedes usar alguna grosería suave si encaja con el tono
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes para hacer bromas
 - Menciona el nombre del grupo cuando sea relevante para crear sentimiento de comunidad
 - Si no tienes datos suficientes, improvisa algo divertido
 - Usa emojis con moderación (2-3 por mensaje)
 - No uses markdown ni formateo especial, solo texto plano para WhatsApp`;

/**
 * Guarda un log de interacción con la IA (fire-and-forget).
 */
function saveAILog(logData) {
  AILog.create(logData).catch(err => {
    console.error('[AILog] Error guardando log:', err.message);
  });
}

/**
 * Genera una respuesta personalizada para un jugador.
 * @param {string} playerName - Nombre del jugador
 * @param {string} question - Pregunta del usuario
 * @param {Object} context - Datos contextuales (ranking, stats, perfil)
 * @param {Object} [meta] - Metadatos opcionales (source)
 * @returns {string} Respuesta del bot
 */
export async function generateResponse(playerName, question, context, meta = {}) {
  const { groupName, ranking, playerStats, profile, leaderboard } = context;

  // Construir el contexto del jugador
  const playerContext = playerStats
    ? `${playerName} (nickname: "${profile?.nickname || playerName}"):
- Posición: ${playerStats.position}º de ${leaderboard?.length || '?'}
- Puntos totales: ${playerStats.totalPts}
- Aciertos exactos (plenos): ${playerStats.exactHits}
- Puntos de grupos: ${playerStats.groupPts}
- Puntos de eliminatorias: ${playerStats.koPts}
- Puntos de honor: ${playerStats.honorPts}
- Le gusta: ${profile?.likes?.join(', ') || 'N/A'}
- No le gusta: ${profile?.dislikes?.join(', ') || 'N/A'}
- Estilo humor: ${profile?.humor_style || 'Normal'}`
    : `No tengo datos de ${playerName} todavía.`;

  // Contexto del ranking general
  const rankingContext = leaderboard
    ? `Clasificación actual:\n${leaderboard.slice(0, 10).map((p, i) => 
        `${i + 1}. ${p.name}: ${p.totalPts} pts`).join('\n')}`
    : 'No hay datos de clasificación disponibles todavía.';

  const userMessage = `DATOS DEL GRUPO: ${groupName || 'Privado'}
 
 DATOS DEL JUGADOR QUE PREGUNTA:
 ${playerContext}

CLASIFICACIÓN GENERAL:
${rankingContext}

${context.chatContext ? `HISTORIAL DE CHAT RECIENTE SOBRE EL JUGADOR (RAG):\n${context.chatContext}\n` : ''}
PREGUNTA: "${question}"

Responde como Andrés Montes, personaliza la respuesta para ${profile?.nickname || playerName}. Si hay historial de chat, úsalo para hacer una broma o referencia a algo que se haya dicho recientemente.`;

  const startTime = Date.now();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      model: config.groq.model,
      temperature: config.groq.temperature,
      max_tokens: config.groq.maxTokens,
    });

    const latencyMs = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '¡Jugón! Algo ha fallado en mi cabeza. Inténtalo de nuevo. 🤯';
    const usage = completion.usage || {};

    // 📊 Log de la interacción
    saveAILog({
      type: 'response',
      playerName,
      groupName: groupName || 'Privado',
      ragQuery: context.chatContext ? `Contexto de ${playerName}` : '',
      ragResultCount: context.chatContext ? context.chatContext.split('\n').filter(l => l.trim()).length : 0,
      ragContext: context.chatContext || '',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
      groqResponse: responseText,
      model: config.groq.model,
      temperature: config.groq.temperature,
      maxTokens: config.groq.maxTokens,
      tokensUsed: usage.total_tokens || 0,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      latencyMs,
      source: meta.source || 'whatsapp',
      success: true
    });

    return responseText;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('Error en Groq:', error.message);

    // 📊 Log del error
    saveAILog({
      type: 'response',
      playerName,
      groupName: groupName || 'Privado',
      ragContext: context.chatContext || '',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
      groqResponse: '',
      model: config.groq.model,
      temperature: config.groq.temperature,
      maxTokens: config.groq.maxTokens,
      latencyMs,
      source: meta.source || 'whatsapp',
      success: false,
      errorMessage: error.message
    });

    if (error.status === 429) {
      return '⚡ ¡Ratatatatata! He hablado demasiado rápido y me han mandado al banquillo. Espera un minutillo y vuelve a preguntar, ¡jugón! ⏳';
    }

    return '❌ ¡Uy! El Agente Mundial ha tenido un tropiezo técnico. Inténtalo en un momento.';
  }
}

/**
 * Genera un resumen de la jornada para todo el grupo.
 * @param {Array} leaderboard - Ranking completo de jugadores
 * @param {Object} profiles - Perfiles de todos los jugadores
 * @returns {string} Resumen para publicar en el grupo
 */
export async function generateDailySummary(leaderboard, profiles, groupName) {
  const rankingText = leaderboard.map((p, i) => {
    const profile = profiles[p.name] || {};
    return `${i + 1}. ${profile.nickname || p.name} (${p.name}): ${p.totalPts} pts - ${p.exactHits} plenos - Grupos: ${p.groupPts}, Eliminatorias: ${p.koPts}, Honor: ${p.honorPts}`;
  }).join('\n');

  const userMessage = `Genera un RESUMEN DE JORNADA para el grupo "${groupName}" de la Porra Mundial 2026 para publicar en WhatsApp.

CLASIFICACIÓN ACTUAL:
${rankingText}

El resumen debe:
1. Anunciar quién lidera y por cuánto
2. Mencionar a todos los jugadores con alguna broma personalizada
3. Destacar datos curiosos (quién tiene más plenos, quién más puntos de honor, etc.)
4. Terminar con una frase épica motivacional al estilo Andrés Montes
5. Ser conciso (máximo 8-10 líneas)
6. NO usar markdown, solo texto plano con emojis`;

  const startTime = Date.now();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      model: config.groq.model,
      temperature: config.groq.temperature,
      max_tokens: 800,
    });

    const latencyMs = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '¡Jugón! No pude generar el resumen. ¡La tecnología también falla!';
    const usage = completion.usage || {};

    // 📊 Log de la interacción
    saveAILog({
      type: 'summary',
      playerName: 'Global',
      groupName: groupName || 'Unknown',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
      groqResponse: responseText,
      model: config.groq.model,
      temperature: config.groq.temperature,
      maxTokens: 800,
      tokensUsed: usage.total_tokens || 0,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      latencyMs,
      source: 'cron',
      success: true
    });

    return responseText;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('Error generando resumen:', error.message);

    saveAILog({
      type: 'summary',
      playerName: 'Global',
      groupName: groupName || 'Unknown',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
      groqResponse: '',
      model: config.groq.model,
      latencyMs,
      source: 'cron',
      success: false,
      errorMessage: error.message
    });

    return '❌ Error generando el resumen de la jornada. El Agente Mundial necesita un descanso.';
  }
}

/**
 * Genera un resumen cómico de la personalidad y rendimiento de un jugador.
 */
export async function generatePersonalitySummary(playerName, groupName, context) {
  const { playerStats, leaderboard, chatContext } = context;

  const playerContext = playerStats ? `
- Puntos Totales: ${playerStats.totalPts}
- Posición: ${playerStats.position}º de ${leaderboard?.length || '?'}
- Plenos (exactos): ${playerStats.exactHits}
- Rendimiento en Grupos: ${playerStats.groupPts} pts
- Rendimiento en Eliminatorias: ${playerStats.koPts} pts
` : 'No hay datos de rendimiento todavía.';

  const userMessage = `Genera un RESUMEN DE PERSONALIDAD para el jugador "${playerName}" del grupo "${groupName}".
  
DATOS DE RENDIMIENTO ACTUAL:
${playerContext}

${chatContext ? `HISTORIAL DE CHAT RECIENTE SOBRE ÉL/ELLA:\n${chatContext}\n` : ''}

El resumen debe ser una descripción cómica y motivacional al estilo ANDRÉS MONTES. 
- Si va ganando, alábalo como un "jugón".
- Si va perdiendo, dile que necesita "un café con sacarina" o que está "en el club de los modestos".
- REGLA DE ORO: Si en el historial de chat se revelan gustos o comentarios suyos, MENCIONALOS con gracia.
- Usa 3-4 frases máximo.
- Menciona sus puntos y su posición de forma divertida.
- No uses markdown, solo texto plano con algún emoji.`;

  const startTime = Date.now();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      model: config.groq.model,
      temperature: 0.8,
      max_tokens: 400,
    });

    const latencyMs = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '¡Algo falló en la cabina de retransmisión!';
    const usage = completion.usage || {};

    // 📊 Log de la interacción
    saveAILog({
      type: 'personality',
      playerName,
      groupName: groupName || 'Unknown',
      ragQuery: chatContext ? `Personalidad de ${playerName}` : '',
      ragResultCount: chatContext ? chatContext.split('\n').filter(l => l.trim()).length : 0,
      ragContext: chatContext || '',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
      groqResponse: responseText,
      model: config.groq.model,
      temperature: 0.8,
      maxTokens: 400,
      tokensUsed: usage.total_tokens || 0,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      latencyMs,
      source: 'web',
      success: true
    });

    return responseText;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('Error en resumen personalidad:', error);

    saveAILog({
      type: 'personality',
      playerName,
      groupName: groupName || 'Unknown',
      ragContext: chatContext || '',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
      groqResponse: '',
      model: config.groq.model,
      latencyMs,
      source: 'web',
      success: false,
      errorMessage: error.message
    });

    return '¡Uy! No puedo comentar tu jugada ahora mismo.';
  }
}
