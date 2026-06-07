// ============================================
// GROQ ENGINE — Motor de IA con Groq
// ============================================
// Reemplaza LM Studio local con Groq API (gratuito).
// API compatible con OpenAI, ultra-rápido (~500 tokens/s).

import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';
import config from './config.js';
import { AILog } from './models/AILog.js';
import { User } from './models/User.js';
import { Group } from './models/Group.js';

const groq = new Groq({
  apiKey: config.groq.apiKey,
});

const hf = process.env.HUGGINGFACEHUB_API_KEY
  ? new HfInference(process.env.HUGGINGFACEHUB_API_KEY)
  : null;

// Track last N bot responses per personality to avoid catchphrase repetition
const recentBotOutputs = new Map();
const MAX_RECENT_OUTPUTS = 3;

function getRecentOutputs(personalityId) {
  return recentBotOutputs.get(personalityId) || [];
}

function addRecentOutput(personalityId, text) {
  const outputs = recentBotOutputs.get(personalityId) || [];
  outputs.push(text);
  if (outputs.length > MAX_RECENT_OUTPUTS) outputs.shift();
  recentBotOutputs.set(personalityId, outputs);
}

/**
 * Map of AI personality prompts.
 * Each personality has a unique speaking style and language.
 * The flag emoji determines the bot's response language.
 */
const PERSONALITY_PROMPTS = {
  andres_montes: `Eres el "Agente Mundial" 🏆, un chatbot para varios grupos de amigos que participan en una "Predicción del Mundial 2026" (pronósticos de resultados de fútbol entre amigos, sin dinero real).
 
 Tu personalidad es como la del mítico ANDRÉS MONTES: excéntrico, divertido, carismático, con lenguaje callejero y frases épicas.
 
 Reglas:
 - Responde SIEMPRE en español
 - Sé breve (máximo 3-4 frases) a menos que te pidan detalles
 - VARIEDAD CRÍTICA: NO repitas las mismas frases hechas en todos los mensajes. Tienes un repertorio amplio — rotación natural. Si usaste "¡Ráfaga!" o "¡Toma, toma, toma!" recientemente, elige expresiones diferentes esta vez.
 - Destaca quien va primer y quien va ultimo y quienes estan cerca de ser el primero o el ultimo de una manera graciosa.  
 - Utiliza el termino "faroliyo" para referirte a el
 - Mantén un tono divertido pero respetuoso, sin groserías ni contenido ofensivo
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes para hacer bromas
 - Menciona el nombre del grupo cuando sea relevante para crear sentimiento de comunidad
 - Si no tienes datos suficientes, improvisa algo divertido
 - Usa emojis con moderación (2-3 por mensaje)
 - No uses markdown complejo ni formateo especial, mantén un estilo limpio para el chat.`,

  pedrerol: `Eres el "Agente Mundial" 🏆, un chatbot para varios grupos de amigos que participan en una "Predicción del Mundial 2026" (pronósticos de resultados de fútbol entre amigos, sin dinero real).
  
 Tu personalidad es como la de JOSEP PEDREROL, presentador de El Chiringuito de Jugones: dramático, intenso, siempre con exclusivas, creando expectación máxima.
 
 Reglas:
 - Responde SIEMPRE en español
 - Sé breve (máximo 3-4 frases) a menos que te pidan detalles
 - VARIEDAD CRÍTICA: NO repitas las mismas frases hechas en todos los mensajes. Si ya soltaste un "¡ATENTOS!" o una "EXCLUSIVA" hace poco, cambia el registro — sé creativo con las transiciones.
 - Trata cada dato de la clasificación como si fuera una EXCLUSIVA del programa
 - Genera tensión dramática, con pausas tipo "Y el líder... es..."
 - Destaca al primero como un fichaje estrella y al último como alguien que necesita un "fichaje de invierno"
 - Mantén un tono intenso pero respetuoso, sin groserías ni contenido ofensivo
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes para hacer bromas
 - Menciona el nombre del grupo como si fuera el nombre de un programa de TV
 - Si no tienes datos suficientes, improvisa algo dramático
 - Usa emojis con moderación (2-3 por mensaje)
 - No uses markdown complejo ni formateo especial, mantén un estilo limpio para el chat.`,

  roncero: `Eres el "Agente Mundial" 🏆, un chatbot para varios grupos de amigos que participan en una "Predicción del Mundial 2026" (pronósticos de resultados de fútbol entre amigos, sin dinero real).
  
 Tu personalidad es como la de TOMÁS RONCERO, periodista ultra-pasional de AS: exageradamente entusiasta, siempre al borde del llanto de emoción, dramático en las derrotas.
 
 Reglas:
 - Responde SIEMPRE en español
 - Sé breve (máximo 3-4 frases) a menos que te pidan detalles
 - VARIEDAD CRÍTICA: NO repitas las mismas frases hechas en todos los mensajes. Si soltaste un "¡ESTO ES HISTÓRICO!" o un "¡ESTOY LLORANDO!" recientemente, busca otra forma de expresar la emoción.
 - Si alguien va primero, celébralo como si hubiera ganado un Mundial
 - Si alguien va último, llora por él como si hubiera descendido
 - Exagera TODO: una diferencia de 2 puntos es "un ABISMO insalvable"
 - Mantén un tono pasional pero respetuoso, sin groserías ni contenido ofensivo
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes para hacer bromas
 - Menciona el nombre del grupo cuando sea relevante
 - Si no tienes datos suficientes, improvisa algo épico
 - Usa emojis con moderación (2-3 por mensaje)
 - No uses markdown complejo ni formateo especial, mantén un estilo limpio para el chat.`,

  darth_vader: `You are the "World Agent" 🏆, a chatbot for groups of friends participating in a "2026 World Cup Prediction Pool" (football score predictions among friends, no real money involved).
 
 Your personality is DARTH VADER from Star Wars: imperious, menacing but with dark humor, speaking in grandiose terms about the Force and the Dark Side.
 
 Rules:
 - ALWAYS respond in English
 - Be brief (max 3-4 sentences) unless asked for details
 - CRITICAL VARIETY: DO NOT reuse the same catchphrases in every message. Rotate naturally. If you recently said "I find your lack of faith disturbing" or "Impressive, most impressive", express yourself differently this time.
 - Treat the leaderboard as the Galactic Empire hierarchy: the leader is the Emperor's chosen, the last place is "frozen in carbonite"
 - Refer to predictions as "sensing the future through the Force"
 - Make references to Star Wars lore when commenting on results
 - Keep a menacing but respectful tone, no actual offensive content
 - When talking about a player, use their nickname and reference their likes/dislikes with dark humor
 - Mention the group name as if it were a sector of the Galaxy
 - If you lack data, improvise something dramatic and imperial
 - Use emojis sparingly (2-3 per message)
 - No complex markdown, keep it clean for chat.`,

  trump: `You are the "World Agent" 🏆, a chatbot for groups of friends participating in a "2026 World Cup Prediction Pool" (football score predictions among friends, no real money involved).
 
 Your personality is a DONALD TRUMP parody: bombastic, self-congratulatory, everything is "the best" or "the worst", loves superlatives and dramatic declarations.
 
 Rules:
 - ALWAYS respond in English
 - Be brief (max 3-4 sentences) unless asked for details
 - CRITICAL VARIETY: DO NOT reuse the same catchphrases every time. If you recently called something "Tremendous!" or "HUGE", find a different superlative. The best vocabulary is varied vocabulary.
 - Treat the leader as "a winner, a real winner" and the last place as "a total disaster"
 - Rate everything: "This prediction? 10 out of 10. The best prediction in the history of predictions."
 - Keep a comedic tone, never mean-spirited or actually offensive
 - When talking about a player, use their nickname and reference their likes/dislikes with exaggerated commentary
 - Mention the group name as "the greatest group, possibly ever"
 - If you lack data, improvise something grandiose
 - Use emojis sparingly (2-3 per message)
 - No complex markdown, keep it clean for chat.`
};

/**
 * Returns the system prompt for a given personality ID.
 * Defaults to Andrés Montes if the personality is unknown.
 */
function getSystemPrompt(personalityId) {
  return PERSONALITY_PROMPTS[personalityId] || PERSONALITY_PROMPTS.andres_montes;
}

/**
 * Returns the language string for the user message template based on personality.
 */
function getPersonalityLang(personalityId) {
  const englishPersonalities = ['darth_vader', 'trump'];
  return englishPersonalities.includes(personalityId) ? 'en' : 'es';
}

/**
 * Returns the display name for a personality (used in user message template).
 */
function getPersonalityName(personalityId) {
  const names = {
    andres_montes: 'Andrés Montes',
    pedrerol: 'Josep Pedrerol',
    roncero: 'Tomás Roncero',
    darth_vader: 'Darth Vader',
    trump: 'Donald Trump'
  };
  return names[personalityId] || 'Andrés Montes';
}

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

  const personalityId = profile?.ai_personality || 'andres_montes';
  const systemPrompt = getSystemPrompt(personalityId);
  const personalityName = getPersonalityName(personalityId);
  const lang = getPersonalityLang(personalityId);

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

  const instruction = lang === 'es'
    ? `Responde como ${personalityName}, personaliza la respuesta para ${profile?.nickname || playerName}. Si hay historial de chat, úsalo para hacer una broma o referencia a algo que se haya dicho recientemente. Si se ha proporcionado 'INFORMACIÓN ACTUALIZADA DE INTERNET', úsala como fuente verídica y actual para responder.`
    : `Respond as ${personalityName}, personalize the response for ${profile?.nickname || playerName}. If there is recent chat history, use it to make a joke or reference to something said recently. If 'UPDATED INTERNET INFORMATION' is provided, use it as a truthful and current source to answer.`;

  // Retrieve recent bot messages for this personality to avoid catchphrase repetition
  const recentOutputs = getRecentOutputs(personalityId);
  const recentContext = recentOutputs.length > 0
    ? (lang === 'es'
        ? `TUS MENSAJES RECIENTES (no te repitas ni uses las mismas frases):\n${recentOutputs.map((t, i) => `[${i + 1}] ${t.substring(0, 200)}`).join('\n')}\n\n`
        : `YOUR RECENT MESSAGES (do not repeat yourself or reuse the same catchphrases):\n${recentOutputs.map((t, i) => `[${i + 1}] ${t.substring(0, 200)}`).join('\n')}\n\n`)
    : '';

  const userMessage = `DATOS DEL GRUPO: ${groupName || 'Privado'}
  
 DATOS DEL JUGADOR QUE PREGUNTA:
 ${playerContext}

CLASIFICACIÓN GENERAL:
${rankingContext}

${recentContext}${context.rulesContext ? `CONTEXTO DEL TORNEO:\n${context.rulesContext}\n\n` : ''}${context.matchDrama ? `${context.matchDrama}\n\n` : ''}${context.chatContext ? `HISTORIAL DE CHAT RECIENTE SOBRE EL JUGADOR (RAG):\n${context.chatContext}\n` : ''}
${context.webContext ? `INFORMACIÓN ACTUALIZADA DE INTERNET:\n${context.webContext}\n` : ''}
PREGUNTA: "${question}"

${instruction}`;

  const startTime = Date.now();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      model: config.groq.model,
      temperature: config.groq.temperature,
      max_tokens: config.groq.maxTokens,
    });

    const latencyMs = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '¡Jugón! Algo ha fallado en mi cabeza. Inténtalo de nuevo. 🤯';
    const usage = completion.usage || {};

    // Store this response to avoid catchphrase repetition on next call
    addRecentOutput(personalityId, responseText);

    // 📊 Log de la interacción
    saveAILog({
      type: 'response',
      playerName,
      groupName: groupName || 'Privado',
      ragQuery: context.chatContext ? `Contexto de ${playerName}` : '',
      ragResultCount: context.chatContext ? context.chatContext.split('\n').filter(l => l.trim()).length : 0,
      ragContext: context.chatContext || '',
      systemPrompt: systemPrompt,
      userPrompt: userMessage,
      groqResponse: responseText,
      model: config.groq.model,
      temperature: config.groq.temperature,
      maxTokens: config.groq.maxTokens,
      tokensUsed: usage.total_tokens || 0,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      latencyMs,
      source: meta.source || 'chat',
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
      systemPrompt: systemPrompt,
      userPrompt: userMessage,
      groqResponse: '',
      model: config.groq.model,
      temperature: config.groq.temperature,
      maxTokens: config.groq.maxTokens,
      latencyMs,
      source: meta.source || 'chat',
      success: false,
      errorMessage: error.message
    });

    if (error.status === 429) {
      return '⚡ ¡Ratatatatata! He hablado demasiado rápido y me han mandado al banquillo. Espera un minutillo y vuelve a preguntar, ¡jugón! ⏳';
    }

    // Fallback a HuggingFace cuando Groq bloquea por región (403)
    if ((error.status === 403 || error.status === 503) && hf) {
      try {
        console.log('[Groq] Fallback a HuggingFace Inference...');
        const stream = hf.chatCompletionStream({
          model: 'meta-llama/Llama-3.1-8B-Instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: config.groq.temperature,
          max_tokens: config.groq.maxTokens,
        });
        let hfResponse = '';
        for await (const chunk of stream) {
          if (chunk.choices?.[0]?.delta?.content) {
            hfResponse += chunk.choices[0].delta.content;
          }
        }
        if (hfResponse) {
          addRecentOutput(personalityId, hfResponse);
          saveAILog({
            type: 'response',
            playerName,
            groupName: groupName || 'Privado',
            ragContext: context.chatContext || '',
            systemPrompt: systemPrompt,
            userPrompt: userMessage,
            groqResponse: hfResponse,
            model: 'meta-llama/Llama-3.1-8B-Instruct (HF)',
            temperature: config.groq.temperature,
            maxTokens: config.groq.maxTokens,
            latencyMs: Date.now() - startTime,
            source: meta.source || 'chat',
            success: true
          });
          return hfResponse;
        }
      } catch (hfError) {
        console.error('[Groq] HF fallback también falló:', hfError.message);
      }
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
  let personalityId = 'andres_montes';
  try {
    const group = await Group.findOne({ name: groupName }).populate('admin');
    if (group && group.admin && group.admin.ai_personality) {
      personalityId = group.admin.ai_personality;
    }
  } catch (e) {
    console.warn('Could not retrieve group admin personality:', e.message);
  }

  const systemPrompt = getSystemPrompt(personalityId);
  const personalityName = getPersonalityName(personalityId);
  const lang = getPersonalityLang(personalityId);

  const rankingText = leaderboard.map((p, i) => {
    const profile = profiles[p.name] || {};
    return `${i + 1}. ${profile.nickname || p.name} (${p.name}): ${p.totalPts} pts - ${p.exactHits} plenos - Grupos: ${p.groupPts}, Eliminatorias: ${p.koPts}, Honor: ${p.honorPts}`;
  }).join('\n');

  const userMessage = lang === 'es'
    ? `Genera un RESUMEN DE JORNADA para el grupo "${groupName}" de la Porra Mundial 2026 para publicar en el chat de la app.

CLASIFICACIÓN ACTUAL:
${rankingText}

El resumen debe:
1. Anunciar quién lidera y por cuánto
2. Mencionar a todos los jugadores con alguna broma personalizada
3. Destacar datos curiosos (quién tiene más plenos, quién más puntos de honor, etc.)
4. Terminar con una frase épica motivacional al estilo ${personalityName}
5. Ser conciso (máximo 8-10 líneas)
6. NO usar markdown, solo texto plano con emojis`
    : `Generate a DAILY ROUND SUMMARY for the group "${groupName}" of the 2026 World Cup Prediction Pool to post in the app's chat.

CURRENT LEADERBOARD:
${rankingText}

The summary must:
1. Announce who is leading and by how much
2. Mention all players with a personalized joke
3. Highlight interesting facts (who has the most perfect scores, who has the most honor points, etc.)
4. End with a motivational epic phrase in the style of ${personalityName}
5. Be concise (max 8-10 lines)
6. DO NOT use markdown, only plain text with emojis`;

  const startTime = Date.now();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
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
      systemPrompt: systemPrompt,
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
      systemPrompt: systemPrompt,
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

  let personalityId = 'andres_montes';
  try {
    const user = await User.findOne({ name: playerName });
    if (user && user.ai_personality) {
      personalityId = user.ai_personality;
    }
  } catch (e) {
    console.warn('Could not retrieve player personality:', e.message);
  }

  const systemPrompt = getSystemPrompt(personalityId);
  const personalityName = getPersonalityName(personalityId);
  const lang = getPersonalityLang(personalityId);

  const playerContext = playerStats ? `
- Puntos Totales: ${playerStats.totalPts}
- Posición: ${playerStats.position}º de ${leaderboard?.length || '?'}
- Plenos (exactos): ${playerStats.exactHits}
- Rendimiento en Grupos: ${playerStats.groupPts} pts
- Rendimiento en Eliminatorias: ${playerStats.koPts} pts
` : 'No hay datos de rendimiento todavía.';

  const userMessage = lang === 'es'
    ? `Genera un RESUMEN DE PERSONALIDAD para el jugador "${playerName}" del grupo "${groupName}".
  
DATOS DE RENDIMIENTO ACTUAL:
${playerContext}

${chatContext ? `HISTORIAL DE CHAT RECIENTE SOBRE ÉL/ELLA:\n${chatContext}\n` : ''}

El resumen debe ser una descripción cómica y motivacional al estilo ${personalityName}. 
- Si va ganando, alábalo como un crack/lider/jugón.
- Si va perdiendo, dile que necesita mejorar o que está en los puestos bajos de forma graciosa.
- REGLA DE ORO: Si en el historial de chat se revelan gustos o comentarios suyos, MENCIONALOS con gracia.
- Usa 3-4 frases máximo.
- Menciona sus puntos y su posición de forma divertida.
- No uses markdown, solo texto plano con algún emoji.`
    : `Generate a PERSONALITY SUMMARY for the player "${playerName}" in the group "${groupName}".
  
CURRENT PERFORMANCE DATA:
${playerContext}

${chatContext ? `RECENT CHAT HISTORY ABOUT THEM:\n${chatContext}\n` : ''}

The summary must be a funny and motivational description in the style of ${personalityName}.
- If they are winning, praise them as a star/leader.
- If they are losing, tell them they need to improve or that they are in the lower ranks in a funny way.
- GOLDEN RULE: If the chat history reveals their tastes or comments, MENTION them gracefully.
- Use 3-4 sentences maximum.
- Mention their points and position in a fun way.
- DO NOT use markdown, only plain text with some emojis.`;

  const startTime = Date.now();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
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
      systemPrompt: systemPrompt,
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
      systemPrompt: systemPrompt,
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
