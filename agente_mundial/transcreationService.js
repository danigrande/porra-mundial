// ============================================
// TRANSCREATION SERVICE — Adaptación cultural
// ============================================
// Toma un mensaje generado en idioma fuente (es/en) y lo adapta
// culturalmente a un idioma destino culturalmente distante.
//
// NO hace traducción literal — hace TRANSCREACIÓN:
//   - Preserva el mecanismo de humor (anchors.primary_mechanism)
//   - Adapta referencias culturales al contexto del idioma destino
//   - Mantiene el tono y energía de la personalidad
//   - Si un chiste no funciona → lo sustituye por un equivalente cultural
//
// Pipeline:
//   sourceText (es/en) → transcreateMessage() → judgeResponse() → texto final
//   Si el Judge falla → retry (máx 2 veces) → fallback al original

import Groq from 'groq-sdk';
import config from './config.js';
import { judgeResponse } from './judgeService.js';
import { getLanguageName } from './languageRouter.js';
import { AILog } from './models/AILog.js';

const groq = new Groq({ apiKey: config.groq.apiKey });

// ──────────────────────────────────────────────
// Prompt de transcreación
// ──────────────────────────────────────────────

function buildTranscreationPrompt(sourceText, sourceLang, targetLang, personalityId, anchors, context) {
  const sourceLangName = getLanguageName(sourceLang);
  const targetLangName = getLanguageName(targetLang);

  return `Eres un EXPERTO EN LOCALIZACIÓN DE HUMOR DEPORTIVO. Tu trabajo es hacer TRANSCREACIÓN cultural, no traducción literal.

IDIOMA ORIGEN: ${sourceLangName}
IDIOMA DESTINO: ${targetLangName}

PERSONALIDAD DEL MENSAJE: ${personalityId}
- Mecanismo de humor principal: ${anchors.primary_mechanism}
- Mecanismo secundario: ${anchors.secondary_mechanism}
- Tono: ${anchors.tone}
- Nivel de energía: ${anchors.energy_level}/5
- Dominios culturales del original: ${anchors.cultural_domains.join(', ')}

CONTEXTO DEL GRUPO (para mantener la coherencia):
${context?.groupName ? `- Grupo: ${context.groupName}` : ''}
${context?.playerStats?.position ? `- Posición del jugador: ${context.playerStats.position}º` : ''}

TEXTO ORIGINAL EN ${sourceLangName}:
"""
${sourceText}
"""

INSTRUCCIONES DE TRANSCREACIÓN:
1. NO hagas traducción literal palabra por palabra
2. PRESERVA el mecanismo de humor: "${anchors.primary_mechanism}"
   → Encuentra el equivalente funcional en la cultura ${targetLangName}
3. ADAPTA las referencias culturales:
   → Si el original menciona "mercadillo" o "barrio", busca un equivalente en la cultura de ${targetLangName}
   → Si menciona un jugador o evento deportivo, mantenlo pero contextualízalo
4. MANTÉN el tono (${anchors.tone}) y la energía (${anchors.energy_level}/5)
5. Si un chiste NO funciona culturalmente en ${targetLangName}, sustitúyelo por uno que SÍ funcione con el mismo mecanismo
6. Mantén la longitud similar al original (no la alargues innecesariamente)
7. Usa emojis con moderación (1-2 máximo)

IMPORTANTE: Responde SOLO con el texto transcreado en ${targetLangName}. Sin explicaciones. Sin el texto original.`;
}

// ──────────────────────────────────────────────
// Función principal de transcreación (sin retry)
// ──────────────────────────────────────────────

/**
 * Transcrea un mensaje de idioma fuente a idioma destino.
 * @param {string} sourceText - Texto en idioma fuente (es/en)
 * @param {string} sourceLanguage - 'es' | 'en'
 * @param {string} targetLanguage - 'ko' | 'th' | 'ar' | etc.
 * @param {string} personalityId
 * @param {Object} anchors - HUMOR_ANCHORS de la personalidad
 * @param {Object} context - Contexto del grupo/jugador
 * @returns {Promise<string>} Texto transcreado
 */
export async function transcreateMessage(sourceText, sourceLanguage, targetLanguage, personalityId, anchors, context) {
  const transcreationConfig = config.transcreation;
  const model = transcreationConfig?.model ?? config.groq.model;
  const temperature = transcreationConfig?.temperature ?? 0.7;

  const prompt = buildTranscreationPrompt(
    sourceText, sourceLanguage, targetLanguage,
    personalityId, anchors, context
  );

  const startTime = Date.now();
  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model,
    temperature,
    max_tokens: config.groq.maxTokens,
  });

  const latencyMs = Date.now() - startTime;
  const usage = completion.usage || {};
  const resultText = completion.choices[0]?.message?.content?.trim() || sourceText;

  saveAILog({
    type: 'transcreation',
    targetLanguage,
    personalityId,
    sourceLanguage,
    sourceText,
    resultText,
    model,
    temperature,
    tokensUsed: usage.total_tokens || 0,
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    latencyMs,
    callSource: 'transcreationService',
    success: true
  });

  return resultText;
}

// ──────────────────────────────────────────────
// Quality Gate de transcreación (con retry)
// ──────────────────────────────────────────────

/**
 * Transcrea con quality gate propio — evalúa con Judge y reintenta si falla.
 * Fallback al texto fuente si se agotan los reintentos.
 *
 * @param {string} sourceText - Texto en idioma fuente ya aprobado por el Judge
 * @param {string} sourceLanguage - 'es' | 'en'
 * @param {string} targetLanguage - 'ko' | 'th' | 'ar' | etc.
 * @param {string} personalityId
 * @param {Object} anchors
 * @param {Object} context
 * @param {string} systemPrompt - System prompt de la personalidad (para el Judge)
 * @returns {Promise<{text: string, passed: boolean, attempts: number, usedFallback: boolean}>}
 */
export async function transcreateWithQualityGate(sourceText, sourceLanguage, targetLanguage, personalityId, anchors, context, systemPrompt) {
  const maxRetries = config.transcreation?.maxRetries ?? 2;
  let attempts = 0;
  let lastText = sourceText;
  let lastJudgment = null;

  console.log(`🌐 [Transcreation] ${sourceLanguage} → ${targetLanguage} para personalidad: ${personalityId}`);

  while (attempts < maxRetries) {
    attempts++;

    try {
      const transcreated = await transcreateMessage(
        sourceText, sourceLanguage, targetLanguage,
        personalityId, anchors, context
      );

      // Evaluar la transcreación con el Judge en idioma destino
      const judgment = await judgeResponse(transcreated, systemPrompt, anchors, targetLanguage, personalityId);
      lastJudgment = judgment;
      lastText = transcreated;

      console.log(`🌐 [Transcreation] Intento ${attempts}/${maxRetries}: lang=${judgment.scores.language_purity} quality=${judgment.scores.quality} → ${judgment.passed ? '✅' : '❌'}`);

      if (judgment.passed) {
        return {
          text: transcreated,
          passed: true,
          attempts,
          usedFallback: false,
          judgment
        };
      }

    } catch (error) {
      console.error(`[Transcreation] Error en intento ${attempts}:`, error.message);
      // Si hay error de API, salir del loop
      break;
    }
  }

  // Fallback: devolver el texto original (en idioma fuente) si todos los intentos fallaron
  console.warn(`⚠️ [Transcreation] Agotados ${maxRetries} intentos. Usando fallback al original (${sourceLanguage})`);
  return {
    text: sourceText,
    passed: false,
    attempts,
    usedFallback: true,
    judgment: lastJudgment
  };
}

function saveAILog(data) {
  AILog.create({
    type: 'transcreation',
    playerName: '',
    groupName: '',
    systemPrompt: '',
    userPrompt: `Transcreation: ${data.sourceLanguage || ''} → ${data.targetLanguage || ''}`,
    groqResponse: data.resultText || '',
    model: data.model || config.groq.model,
    temperature: data.temperature ?? 0.7,
    maxTokens: config.groq.maxTokens,
    tokensUsed: data.tokensUsed || 0,
    promptTokens: data.promptTokens || 0,
    completionTokens: data.completionTokens || 0,
    latencyMs: data.latencyMs || 0,
    source: 'chat',
    callSource: data.callSource || 'transcreationService',
    success: data.success !== false,
    targetLanguage: data.targetLanguage || '',
    anchorsUsed: data.personalityId || '',
    wasTranscreated: true,
  }).catch(err => console.error('[Transcreation] Error saving AILog:', err.message));
}
