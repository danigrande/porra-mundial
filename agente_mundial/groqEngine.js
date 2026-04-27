// ============================================
// GROQ ENGINE — Motor de IA con Groq
// ============================================
// Reemplaza LM Studio local con Groq API (gratuito).
// API compatible con OpenAI, ultra-rápido (~500 tokens/s).

import Groq from 'groq-sdk';
import config from './config.js';

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
 - Usa frases típicas de Andrés Montes: 
 - Puedes usar alguna grosería suave si encaja con el tono
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes para hacer bromas
 - Menciona el nombre del grupo cuando sea relevante para crear sentimiento de comunidad
 - Si no tienes datos suficientes, improvisa algo divertido
 - Usa emojis con moderación (2-3 por mensaje)
 - No uses markdown ni formateo especial, solo texto plano para WhatsApp`;

/**
 * Genera una respuesta personalizada para un jugador.
 * @param {string} playerName - Nombre del jugador
 * @param {string} question - Pregunta del usuario
 * @param {Object} context - Datos contextuales (ranking, stats, perfil)
 * @returns {string} Respuesta del bot
 */
export async function generateResponse(playerName, question, context) {
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
    ? `Ranking actual:\n${leaderboard.slice(0, 10).map((p, i) =>
        `${i + 1}. ${p.name}: ${p.totalPts} pts (${p.exactHits} plenos)`
      ).join('\n')}`
    : 'No hay ranking disponible aún.';

  const userMessage = `DATOS DEL GRUPO: ${groupName || 'Privado'}
 
 DATOS DEL JUGADOR QUE PREGUNTA:
 ${playerContext}

RANKING GENERAL:
${rankingContext}

${context.chatContext ? `HISTORIAL DE CHAT RECIENTE SOBRE EL JUGADOR (RAG):\n${context.chatContext}\n` : ''}
PREGUNTA: "${question}"

Responde como Andrés Montes, personaliza la respuesta para ${profile?.nickname || playerName}. Si hay historial de chat, úsalo para hacer una broma o referencia a algo que se haya dicho recientemente.`;

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

    return completion.choices[0]?.message?.content || '¡Jugón! Algo ha fallado en mi cabeza. Inténtalo de nuevo. 🤯';
  } catch (error) {
    console.error('Error en Groq:', error.message);

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

RANKING ACTUAL:
${rankingText}

El resumen debe:
1. Anunciar quién lidera y por cuánto
2. Mencionar a todos los jugadores con alguna broma personalizada
3. Destacar datos curiosos (quién tiene más plenos, quién más puntos de honor, etc.)
4. Terminar con una frase épica motivacional al estilo Andrés Montes
5. Ser conciso (máximo 8-10 líneas)
6. NO usar markdown, solo texto plano con emojis`;

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

    return completion.choices[0]?.message?.content || '¡Jugón! No pude generar el resumen. ¡La tecnología también falla!';
  } catch (error) {
    console.error('Error generando resumen:', error.message);
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

    return completion.choices[0]?.message?.content || '¡Algo falló en la cabina de retransmisión!';
  } catch (error) {
    console.error('Error en resumen personalidad:', error);
    return '¡Uy! No puedo comentar tu jugada ahora mismo.';
  }
}
