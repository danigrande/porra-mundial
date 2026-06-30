// ============================================
// GROQ ENGINE — Motor de IA con Groq
// ============================================
// Reemplaza LM Studio local con Groq API (gratuito).
// API compatible con OpenAI, ultra-rápido (~500 tokens/s).

import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';
import config from './config.js';
import { HumanReview } from './models/HumanReview.js';
import { AILog } from './models/AILog.js';
import { User } from './models/User.js';
import { Group } from './models/Group.js';
import { getAnchors, buildAnchorBlock, getSourceLanguage, getErrorMessage } from './anchors.js';
import { buildLanguageInstruction } from './languageRouter.js';
import { judgeResponse } from './judgeService.js';

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
const SHARED_RULES_ES = `Reglas:
- Responde SIEMPRE en español
- Sé breve (máximo 3-4 frases) a menos que te pidan detalles
- VARIEDAD CRÍTICA: NO repitas las mismas frases hechas en todos los mensajes. Rotación natural de expresiones.
- Si no tienes datos suficientes, no te inventes nada.
- Usa emojis con moderación (1-2 por mensaje y solo si son útiles)
- No uses markdown complejo ni formateo especial, mantén un estilo limpio para el chat.`;

const SHARED_RULES_EN = `Rules:
- ALWAYS respond in English
- Be brief (max 3-4 sentences) unless asked for details
- CRITICAL VARIETY: DO NOT reuse the same catchphrases in every message. Rotate naturally.
- If you lack data, don't make anything up.
- Use emojis sparingly (1-2 per message and only when useful)
- No complex markdown, keep it clean for chat.`;

const PERSONALITY_PROMPTS = {
  andres_montes: `Eres el "Agente Mundial" 🏆, un chatbot para varios grupos de amigos que participan en una "Predicción del Mundial 2026" (pronósticos de resultados de fútbol entre amigos, sin dinero real).
  
 Tu personalidad es como la del mítico ANDRÉS MONTES: excéntrico, divertido, carismático, con lenguaje callejero y frases épicas.
  
 ${SHARED_RULES_ES}
 - Destaca quien va primer y quien va ultimo y quienes estan cerca de ser el primero o el ultimo de una manera graciosa.  
 - Utiliza el termino "faroliyo" para referirte a el ultimo clasificado
 - Mantén un tono divertido pero respetuoso, sin groserías ni contenido ofensivo
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes para hacer bromas
 - Menciona el nombre del grupo cuando sea relevante para crear sentimiento de comunidad`,

  pedrerol: `Eres el "Agente Mundial" 🏆, un chatbot para varios grupos de amigos que participan en una "Predicción del Mundial 2026" (pronósticos de resultados de fútbol entre amigos, sin dinero real).
  
 Tu personalidad es como la de JOSEP PEDREROL, presentador de El Chiringuito de Jugones: dramático, intenso, siempre con exclusivas, creando expectación máxima.
  
 ${SHARED_RULES_ES}
 - Trata cada dato de la clasificación como si fuera una EXCLUSIVA del programa
 - Genera tensión dramática, con pausas tipo "Y el líder... es..."
 - Destaca al primero como un fichaje estrella y al último como alguien que necesita un "fichaje de invierno"
 - Mantén un tono intenso pero respetuoso, sin groserías ni contenido ofensivo
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes para hacer bromas
 - Menciona el nombre del grupo como si fuera el nombre de un programa de TV`,

  roncero: `Eres el "Agente Mundial" 🏆, un chatbot para varios grupos de amigos que participan en una "Predicción del Mundial 2026" (pronósticos de resultados de fútbol entre amigos, sin dinero real).
  
 Tu personalidad es como la de TOMÁS RONCERO, periodista ultra-pasional de AS: exageradamente entusiasta, siempre al borde del llanto de emoción, dramático en las derrotas.
  
 ${SHARED_RULES_ES}
 - Si alguien va primero, celébralo como si hubiera ganado un Mundial
 - Si alguien va último, llora por él como si hubiera descendido
 - Exagera TODO: una diferencia de 2 puntos es "un ABISMO insalvable"
 - Mantén un tono pasional pero respetuoso, sin groserías ni contenido ofensivo
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes para hacer bromas
 - Menciona el nombre del grupo cuando sea relevante`,

  darth_vader: `You are the "World Agent" 🏆, a chatbot for groups of friends participating in a "2026 World Cup Prediction Pool" (football score predictions among friends, no real money involved).
  
 Your personality is DARTH VADER from Star Wars: imperious, menacing but with dark humor, speaking in grandiose terms about the Force and the Dark Side.
  
 ${SHARED_RULES_EN}
 - Treat the leaderboard as the Galactic Empire hierarchy: the leader is the Emperor's chosen, the last place is "frozen in carbonite"
 - Refer to predictions as "sensing the future through the Force"
 - Make references to Star Wars lore when commenting on results
 - Keep a menacing but respectful tone, no actual offensive content
 - When talking about a player, use their nickname and reference their likes/dislikes with dark humor
 - Mention the group name as if it were a sector of the Galaxy`,

  trump: `You are the "World Agent" 🏆, a chatbot for groups of friends participating in a "2026 World Cup Prediction Pool" (football score predictions among friends, no real money involved).
  
 Your personality is a DONALD TRUMP parody: bombastic, self-congratulatory, everything is "the best" or "the worst", loves superlatives and dramatic declarations.
  
 ${SHARED_RULES_EN}
 - Treat the leader as "a winner, a real winner" and the last place as "a total disaster"
 - Rate everything: "This prediction? 10 out of 10. The best prediction in the history of predictions."
 - Keep a comedic tone, never mean-spirited or actually offensive
 - When talking about a player, use their nickname and reference their likes/dislikes with exaggerated commentary
 - Mention the group name as "the greatest group, possibly ever"`,

  fabrizio_romano: `Eres el "Agente Mundial" 🏆, un chatbot para grupos de amigos que participan en una "Predicción del Mundial 2026".

 Tu personalidad es FABRIZIO ROMANO, el periodista de fichajes más fiable del mundo. Das noticias de última hora sobre las predicciones y clasificaciones como si fueran fichajes de fútbol.

 - Responde SIEMPRE en español (excepto tus muletillas características)
 - Sé breve (máximo 3-4 frases) a menos que te pidan detalles
 - VARIEDAD CRÍTICA: NO repitas las mismas muletillas en todos los mensajes. Rotación natural.
 - Si no tienes datos suficientes, no te inventes nada
 - Usa emojis con moderación (1-2 por mensaje)
 - No uses markdown complejo, mantén un estilo limpio para el chat
 - Usa tus frases trademark con naturalidad:
   • "Here we go! ✅✅✅" — solo para momentos importantes (un acierto exacto, un nuevo líder)
   • "Understand..." / "🚨🔴 Exclusive" / "🛑🛑🛑 Breaking" — para anunciar algo nuevo
   • "Verbal agreement" / "Documents being prepared" / "Talks advancing" — según el contexto
   • "Medical scheduled" / "Contract until" — adaptado a predicciones
 - Las predicciones son como fichajes:
   • Un acierto exacto → "Done deal! ✅✅✅"
   • Subir posiciones → "closing in on the top spot"
   • Perder puntos → "talks have stalled"
   • Racha de aciertos → "incredible numbers"
 - Usa banderas: 🇮🇹 al inicio o final, y otras según el contexto
 - TONO: factual, de breaking news, sin celebración ni lamento — solo reporta los hechos
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes
 - Menciona el nombre del grupo como si fuera el club involucrado en el fichaje`,

  juez_dredd: `Eres el "Agente Mundial" 🏆, un chatbot para varios grupos de amigos que participan en una "Predicción del Mundial 2026" (pronósticos de resultados de fútbol entre amigos, sin dinero real).

 Tu personalidad es como la del JUEZ DREDD: autoritario, implacable, impartes justicia en esta porra como si fuera la ley en Mega-City One. Cada predicción es una declaración jurada, cada acierto un veredicto. Eres el juez, el jurado y, cuando hace falta, el verdugo humorístico.

 ${SHARED_RULES_ES}
 - El líder de la clasificación es un "ciudadano ejemplar", el último está "sentenciado a los ISO-Cubes" o "en libertad condicional revocada"
 - Trata los errores como "delitos", las malas rachas como "condenas", los aciertos como "indultos"
 - Usa terminología judicial: "veredicto", "sentencia", "apelación", "pruebas", "testigos", "tribunal"
 - Cuando hables de un jugador, usa su nickname y ten en cuenta sus gustos y dislikes
 - Menciona el grupo como "el tribunal" o "esta sala"
 - Tono: autoritario pero con humor negro bien dosificado, sin pasarse`
};

/**
 * Returns the system prompt for a given personality ID.
 * Defaults to Andrés Montes if the personality is unknown.
 */
export function getSystemPrompt(personalityId) {
  return PERSONALITY_PROMPTS[personalityId] || PERSONALITY_PROMPTS.andres_montes;
}

/**
 * Builds an enhanced system prompt by injecting:
 *   1. Aggressive language instruction (prefix + suffix) to prevent language mixing
 *   2. Structured humor anchor block for the personality
 *
 * @param {string} personalityId
 * @param {string} targetLanguage - ISO code of expected output language
 * @param {string[]} [recentCatchphrases] - recently used catchphrases to avoid
 * @returns {string} Enhanced system prompt
 */
export function buildEnhancedSystemPrompt(personalityId, targetLanguage, recentCatchphrases = []) {
  const basePrompt = getSystemPrompt(personalityId);
  const { prefix: langPrefix, suffix: langSuffix } = buildLanguageInstruction(targetLanguage);
  const anchorBlock = buildAnchorBlock(personalityId, recentCatchphrases);

  return `${langPrefix}\n\n${basePrompt}\n${anchorBlock}\n\n${langSuffix}`;
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
    trump: 'Donald Trump',
    fabrizio_romano: 'Fabrizio Romano',
    juez_dredd: 'Juez Dredd'
  };
  return names[personalityId] || 'Andrés Montes';
}

/**
 * Guarda un log de interacción con la IA (fire-and-forget).
 */
function saveAILog(logData) {
  return AILog.create(logData).catch(err => {
    console.error('[AILog] Error guardando log:', err.message);
    return null;
  });
}

/**
 * Genera una respuesta personalizada para un jugador.
 * @param {string} playerName - Nombre del jugador
 * @param {string} question - Pregunta del usuario
 * @param {Object} context - Datos contextuales (ranking, stats, perfil)
 * @param {Object} [meta] - Metadatos opcionales (source, targetLanguage, judgesFeedback)
 * @returns {string} Respuesta del bot
 */
export async function generateResponse(playerName, question, context, meta = {}) {
  const { groupName, ranking, playerStats, profile, leaderboard } = context;

  const personalityId = profile?.ai_personality || meta.personalityId || 'andres_montes';
  const targetLanguage = meta.targetLanguage || getSourceLanguage(personalityId);
  const recentOutputs = getRecentOutputs(personalityId);

  // Usar el system prompt mejorado con anchors e instrucción de idioma agresiva
  const systemPrompt = buildEnhancedSystemPrompt(personalityId, targetLanguage, recentOutputs.slice(0, 2));
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

  // Feedback del Judge del intento anterior (si hay) — inyectado al final del user prompt
  const judgesFeedbackBlock = meta.judgesFeedback
    ? (lang === 'es'
      ? `\n\n⚠️ CORRECCIÓN REQUERIDA (intento anterior rechazado): ${meta.judgesFeedback}\nCorrige específicamente ese problema en esta respuesta.`
      : `\n\n⚠️ CORRECTION REQUIRED (previous attempt rejected): ${meta.judgesFeedback}\nSpecifically fix that issue in this response.`)
    : '';

  // Contexto de outputs recientes (ya gestionado en el system prompt via buildEnhancedSystemPrompt)
  const recentContext = '';

  const userMessage = `DATOS DEL GRUPO: ${groupName || 'Privado'}
  
 DATOS DEL JUGADOR QUE PREGUNTA:
 ${playerContext}

CLASIFICACIÓN GENERAL:
${rankingContext}

${recentContext}${context.rulesContext ? `CONTEXTO DEL TORNEO:\n${context.rulesContext}\n\n` : ''}${context.matchDrama ? `${context.matchDrama}\n\n` : ''}${context.chatContext ? `HISTORIAL DE CHAT RECIENTE SOBRE EL JUGADOR (RAG):\n${context.chatContext}\n` : ''}
${context.convContext ? `CONVERSACIÓN RECIENTE:\n${context.convContext}\n` : ''}
${context.webContext ? `INFORMACIÓN ACTUALIZADA DE INTERNET:\n${context.webContext}\n` : ''}
PREGUNTA: "${question}"

${instruction}${judgesFeedbackBlock}`;

  const startTime = Date.now();

  // Groq primary (mejor modelo, más fiable)
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
    const responseText = completion.choices[0]?.message?.content || getErrorMessage(personalityId, 'genericError');
    const usage = completion.usage || {};

    addRecentOutput(personalityId, responseText);

    const savedLog = await saveAILog({
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
      success: true,
      ...(meta._evalData || {})
    });
    if (meta._crossRef && savedLog) meta._crossRef.ailogId = savedLog._id;

    return responseText;
  } catch (groqError) {
    console.error('[Groq] Groq falló, intentando HF:', groqError.message);
  }

  // HF fallback (Qwen2.5-7B)
  if (hf) {
    try {
      const stream = hf.chatCompletionStream({
        model: 'Qwen/Qwen2.5-7B-Instruct',
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
        const savedLog = await saveAILog({
          type: 'response',
          playerName,
          groupName: groupName || 'Privado',
          ragContext: context.chatContext || '',
          systemPrompt: systemPrompt,
          userPrompt: userMessage,
          groqResponse: hfResponse,
          model: 'Qwen/Qwen2.5-7B-Instruct (HF)',
          temperature: config.groq.temperature,
          maxTokens: config.groq.maxTokens,
          latencyMs: Date.now() - startTime,
          source: meta.source || 'chat',
          success: true
        });
        if (meta._crossRef && savedLog) meta._crossRef.ailogId = savedLog._id;
        return hfResponse;
      }
    } catch (hfError) {
      console.error('[Groq] HF también falló:', hfError.message);
    }
  }

  // Ambos proveedores fallaron
  const latencyMs = Date.now() - startTime;
  const savedLog = await saveAILog({
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
    errorMessage: groqError?.message || 'Both providers failed'
  });
  if (meta._crossRef && savedLog) meta._crossRef.ailogId = savedLog._id;

  if (groqError?.status === 429) {
    return getErrorMessage(personalityId, 'rateLimited');
  }

  console.error('[Groq] Ambos proveedores fallaron:', groqError?.message);
  return getErrorMessage(personalityId, 'genericError');
}

// ──────────────────────────────────────────────────────────────────────────────
// QUALITY GATE — Genera respuesta + evalúa con Judge + reintenta si falla
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Genera una respuesta pasando por el Quality Gate:
 *   1. Genera respuesta con generateResponse()
 *   2. Evalúa con judgeResponse() (LLM-as-a-Judge)
 *   3. Si falla, regenera con el feedback del Judge inyectado
 *   4. Máximo meta.maxAttempts intentos (default 3)
 *   5. Si agota intentos, devuelve el último resultado con forceApproved=true
 *
 * @param {string} playerName
 * @param {string} question
 * @param {Object} context
 * @param {Object} meta - { personalityId, anchors, targetLanguage, maxAttempts, source }
 * @returns {Promise<{response: string, judgment: Object, attempts: number, forceApproved: boolean}>}
 */
export async function generateWithQualityGate(playerName, question, context, meta = {}) {
  // Si los evals están deshabilitados, pasar directamente
  if (!config.evals?.enabled) {
    const response = await generateResponse(playerName, question, context, meta);
    return { response, judgment: { passed: true, scores: {}, feedback: 'evals disabled' }, attempts: 1, forceApproved: false, ailogId: null };
  }

  const personalityId = meta.personalityId || context.profile?.ai_personality || 'andres_montes';
  const anchors = meta.anchors || getAnchors(personalityId);
  const targetLanguage = meta.targetLanguage || getSourceLanguage(personalityId);
  const maxAttempts = meta.maxAttempts || config.evals.maxRetries || 3;

  let attempts = 0;
  let lastFeedback = '';
  let lastResponse = '';
  let lastJudgment = null;
  let ailogId = null;

  while (attempts < maxAttempts) {
    attempts++;
    const crossRef = {};

    const response = await generateResponse(playerName, question, context, {
      ...meta,
      personalityId,
      targetLanguage,
      judgesFeedback: lastFeedback,
      _evalData: null,
      _crossRef: crossRef
    });

    ailogId = crossRef.ailogId || null;
    lastResponse = response;

    // Evaluar con el Judge
    const systemPrompt = buildEnhancedSystemPrompt(personalityId, targetLanguage);
    const judgment = await judgeResponse(response, systemPrompt, anchors, targetLanguage, personalityId);
    lastJudgment = judgment;

    // Persistir resultados del judge en el AILog
    if (ailogId) {
      await AILog.findByIdAndUpdate(ailogId, {
        evalScores: judgment.scores,
        evalPassed: judgment.passed,
        evalFeedback: judgment.feedback || '',
        evalMainIssue: judgment.main_issue || '',
        evalAttempts: attempts,
        targetLanguage,
        anchorsUsed: personalityId,
      }).catch(err => console.error('[QualityGate] Error updating AILog:', err.message));
    }

    console.log(`⚖️ [QualityGate] Intento ${attempts}/${maxAttempts}: lang=${judgment.scores?.language_purity} quality=${judgment.scores?.quality} → ${judgment.passed ? '✅ PASS' : '❌ FAIL'}`);

    if (judgment.passed) {
      return { response, judgment, attempts, forceApproved: false, ailogId };
    }

    lastFeedback = judgment.feedback;
    console.log(`🔄 [QualityGate] Regenerando. Feedback: ${judgment.feedback}`);
  }

  // Agotados los intentos — devolver el último resultado con flag
  console.warn(`⚠️ [QualityGate] Agotados ${maxAttempts} intentos. Forzando aprobación.`);

  // Auto-queue forceApproved for human review
  if (ailogId) {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayCount = await HumanReview.countDocuments({ createdAt: { $gte: todayStart } });
      if (todayCount < (config.hitl?.maxDailyReviews || 20)) {
        await HumanReview.create({
          source: 'force_approved',
          aiLogId: ailogId,
          query: question,
          response: lastResponse,
          personalityId,
          targetLanguage,
          judgeScores: lastJudgment?.scores,
          judgePassed: false,
          status: 'pending'
        });
      }
    } catch (e) {
      console.error('[QualityGate] Error creating HumanReview:', e.message);
    }
  }

  return { response: lastResponse, judgment: lastJudgment, attempts, forceApproved: true, ailogId };
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

  const systemPrompt = buildEnhancedSystemPrompt(personalityId, 'es');
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

  // Groq primary
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
    const responseText = completion.choices[0]?.message?.content || getErrorMessage(personalityId, 'genericError');
    const usage = completion.usage || {};

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
      latencyMs,
      source: 'cron',
      success: true
    });
    return responseText;
  } catch (groqError) {
    console.error('[Groq] Groq falló en resumen, intentando HF:', groqError.message);
  }

  // HF fallback
  if (hf) {
    try {
      const stream = hf.chatCompletionStream({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: config.groq.temperature,
        max_tokens: 800,
      });
      let hfResponse = '';
      for await (const chunk of stream) {
        if (chunk.choices?.[0]?.delta?.content) {
          hfResponse += chunk.choices[0].delta.content;
        }
      }
      if (hfResponse) {
        saveAILog({
          type: 'summary',
          playerName: 'Global',
          groupName: groupName || 'Unknown',
          systemPrompt: systemPrompt,
          userPrompt: userMessage,
          groqResponse: hfResponse,
          model: 'Qwen/Qwen2.5-7B-Instruct (HF)',
          temperature: config.groq.temperature,
          maxTokens: 800,
          latencyMs: Date.now() - startTime,
          source: 'cron',
          success: true
        });
        return hfResponse;
      }
    } catch (hfError) {
      console.error('[Groq] HF también falló en resumen:', hfError.message);
    }
  }

  return getErrorMessage(personalityId, 'genericError');
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

  const systemPrompt = buildEnhancedSystemPrompt(personalityId, 'es');
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

  // Groq primary
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
    const responseText = completion.choices[0]?.message?.content || getErrorMessage(personalityId, 'genericError');
    const usage = completion.usage || {};

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
  } catch (groqError) {
    console.error('[Groq] Groq falló en personalidad, intentando HF:', groqError.message);
  }

  // HF fallback
  if (hf) {
    try {
      const stream = hf.chatCompletionStream({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 400,
      });
      let hfResponse = '';
      for await (const chunk of stream) {
        if (chunk.choices?.[0]?.delta?.content) {
          hfResponse += chunk.choices[0].delta.content;
        }
      }
      if (hfResponse) {
        saveAILog({
          type: 'personality',
          playerName,
          groupName: groupName || 'Unknown',
          ragContext: chatContext || '',
          systemPrompt: systemPrompt,
          userPrompt: userMessage,
          groqResponse: hfResponse,
          model: 'Qwen/Qwen2.5-7B-Instruct (HF)',
          temperature: 0.8,
          maxTokens: 400,
          latencyMs: Date.now() - startTime,
          source: 'web',
          success: true
        });
        return hfResponse;
      }
    } catch (hfError) {
      console.error('[Groq] HF también falló en personalidad:', hfError.message);
    }
  }

  // Ambos fallaron
  const latencyMs = Date.now() - startTime;
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
    errorMessage: groqError?.message || 'Both providers failed'
  });

  return getErrorMessage(personalityId, 'genericError');
}
