// ============================================
// JUDGE SERVICE — LLM-as-a-Judge
// ============================================
// Evalúa la calidad de las respuestas del agente en 2 ejes:
//   1. language_purity (0-10): ¿Está en el idioma correcto? No negociable.
//   2. quality (0-10): ¿Es el humor efectivo y fiel a la personalidad?
//
// Usa llama-3.1-8b-instant (rápido y barato) con temperatura baja.
// La lógica de language_purity tiene un fast-path por regex antes del LLM.

import Groq from 'groq-sdk';
import config from './config.js';
import { getLanguageName, TRANSCREATION_LANGUAGES } from './languageRouter.js';

const groq = new Groq({ apiKey: config.groq.apiKey });

// ──────────────────────────────────────────────
// Detectores de script ajeno al idioma esperado
// ──────────────────────────────────────────────
const SCRIPT_REGEXES = {
  ko: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/u,
  th: /[\u0E00-\u0E7F]/u,
  ar: /[\u0600-\u06FF]/u,
  ja: /[\u3040-\u30FF\u4E00-\u9FFF]/u,
  zh: /[\u4E00-\u9FFF]/u,
  ru: /[\u0400-\u04FF]/u,
  hi: /[\u0900-\u097F]/u,
  latin: /[a-zA-ZÀ-öø-ÿ]/u,
  arabic: /[\u0600-\u06FF]/u,
  hangul: /[\uAC00-\uD7AF]/u,
  thai: /[\u0E00-\u0E7F]/u,
  cyrillic: /[\u0400-\u04FF]/u,
  cjk: /[\u4E00-\u9FFF\u3040-\u30FF]/u,
  devanagari: /[\u0900-\u097F]/u,
};

/**
 * Fast-path: detecta mezcla de scripts sin llamar al LLM.
 * Si el texto contiene caracteres de un script diferente al esperado → score 0.
 * @returns {number|null} 0 si hay mezcla obvia, null si necesita LLM
 */
function detectScriptContamination(text, expectedLang) {
  if (!text) return 0;

  const isLatinLang = !TRANSCREATION_LANGUAGES.includes(expectedLang);

  if (isLatinLang) {
    // Esperamos texto latino (es/en/fr/etc.) — cualquier script asiático/árabe es error
    if (SCRIPT_REGEXES.hangul.test(text)) return 0;
    if (SCRIPT_REGEXES.thai.test(text)) return 0;
    if (SCRIPT_REGEXES.arabic.test(text)) return 0;
    if (SCRIPT_REGEXES.cjk.test(text)) return 0;
    if (SCRIPT_REGEXES.cyrillic.test(text)) return 0;
    if (SCRIPT_REGEXES.devanagari.test(text)) return 0;
    return null; // Sin contaminación obvia, delegar al LLM
  }

  // Para idiomas de transcreación, verificar que SÍ contienen el script esperado
  const expectedRegex = SCRIPT_REGEXES[expectedLang];
  if (expectedRegex && !expectedRegex.test(text)) {
    // El texto NO contiene caracteres del idioma esperado → posible problema
    // No penalizamos a 0 aquí porque el LLM puede darnos más contexto
    return null;
  }

  return null;
}

// ──────────────────────────────────────────────
// Rúbricas del Judge
// ──────────────────────────────────────────────
function buildJudgePrompt(response, systemPrompt, anchors, targetLanguage) {
  const langName = getLanguageName(targetLanguage);
  const isLatinLang = !TRANSCREATION_LANGUAGES.includes(targetLanguage);

  const langCheck = isLatinLang
    ? `¿Está el texto EXCLUSIVAMENTE en ${langName}? ¿Hay caracteres de árabe, coreano, tailandés, chino, japonés, ruso, hindi u otro script no-latino?`
    : `¿Está el texto principalmente en ${langName}? ¿Contiene suficientes caracteres del script de ${langName}?`;

  return `Eres un evaluador experto de calidad de chatbots deportivos. Evalúa la siguiente respuesta de un bot.

IDIOMA ESPERADO: ${langName}
PERSONALIDAD DEL BOT: ${anchors?.tone || 'desconocida'}
MECANISMO DE HUMOR ESPERADO: ${anchors?.primary_mechanism || 'desconocido'} + ${anchors?.secondary_mechanism || 'desconocido'}

INSTRUCCIÓN DEL SISTEMA (contexto del bot):
"""
${systemPrompt ? systemPrompt.substring(0, 400) : 'No disponible'}
"""

RESPUESTA A EVALUAR:
"""
${response}
"""

EVALÚA EN DOS EJES:

1. LANGUAGE_PURITY (0-10):
   - ${langCheck}
   - ¿La gramática y léxico son correctos en ${langName}?
   - ¿El registro lingüístico es apropiado (informal-deportivo)?
   - Penalización severa: cualquier carácter de un script diferente al esperado → máximo 2/10

2. QUALITY (0-10):
   - ¿El mecanismo de humor (${anchors?.primary_mechanism}) se usa claramente?
   - ¿La respuesta suena a la personalidad esperada (${anchors?.tone})?
   - ¿Evita ser "cringe" (forzado, demasiado genérico, robótico)?
   - ¿Es apropiada para un grupo de amigos haciendo predicciones del Mundial?
   - ¿Tiene energía y personalidad propias?

RESPONDE SOLO CON JSON VÁLIDO, SIN TEXTO ADICIONAL:
{"scores": {"language_purity": <0-10>, "quality": <0-10>}, "feedback": "<max 100 chars de feedback concreto>", "main_issue": "<language|humor|personality|none>"}`;
}

// ──────────────────────────────────────────────
// Judge principal
// ──────────────────────────────────────────────

/**
 * Evalúa una respuesta con el LLM-as-a-Judge.
 * Primero hace un fast-path de detección de script contaminado.
 * Si no hay contaminación obvia, llama al LLM juez.
 * Los thresholds se resuelven con overriding por (personalityId, targetLanguage).
 *
 * @param {string} response - La respuesta a evaluar
 * @param {string} systemPrompt - El system prompt usado para generarla
 * @param {Object} anchors - Los HUMOR_ANCHORS de la personalidad
 * @param {string} targetLanguage - Código ISO del idioma esperado
 * @param {string} [personalityId] - ID de la personalidad (para threshold overrides)
 * @returns {Promise<{scores: Object, feedback: string, passed: boolean, fastPath: boolean}>}
 */
export async function judgeResponse(response, systemPrompt, anchors, targetLanguage, personalityId) {
  const tc = config.evals?.thresholds;
  let minLang = tc?.minLanguagePurity ?? config.evals?.minLanguagePurity ?? 8;
  let minQuality = tc?.minQuality ?? config.evals?.minQuality ?? 6;

  // Resolver override por (personalityId, targetLanguage)
  if (tc?.overrides && personalityId) {
    const exactKey = `${personalityId}::${targetLanguage}`;
    const override = tc.overrides[exactKey] ?? tc.overrides[personalityId];

    if (override) {
      minLang = override.minLanguagePurity ?? minLang;
      minQuality = override.minQuality ?? minQuality;
    }

    // Si es un idioma de transcreación, aplicar override de transcreación
    if (TRANSCREATION_LANGUAGES.includes(targetLanguage) && tc.overrides.__transcreation__) {
      const tx = tc.overrides.__transcreation__;
      minLang = tx.minLanguagePurity ?? minLang;
      minQuality = tx.minQuality ?? minQuality;
    }
  }

  // Fast-path: detección de contaminación de script
  const contamination = detectScriptContamination(response, targetLanguage);
  if (contamination === 0) {
    console.log(`⚖️ [Judge] Fast-path: script contaminado detectado en respuesta para lang=${targetLanguage}`);
    return {
      scores: { language_purity: 0, quality: 5 },
      feedback: 'Script contaminado: caracteres de idioma incorrecto detectados automáticamente',
      main_issue: 'language',
      passed: false,
      fastPath: true
    };
  }

  const evalConfig = config.evals;

  // Sample rate: si no evaluamos esta respuesta, aprobar por defecto
  const sampleRate = evalConfig?.sampleRate ?? 1.0;
  if (Math.random() > sampleRate) {
    return {
      scores: { language_purity: 10, quality: 8 },
      feedback: 'Evaluación saltada por sample rate',
      main_issue: 'none',
      passed: true,
      skipped: true
    };
  }

  const prompt = buildJudgePrompt(response, systemPrompt, anchors, targetLanguage);

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: evalConfig?.judgeModel ?? 'llama-3.1-8b-instant',
      temperature: evalConfig?.judgeTemperature ?? 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(raw);

    const langScore = result.scores?.language_purity ?? 5;
    const qualScore = result.scores?.quality ?? 5;
    const passed = langScore >= minLang && qualScore >= minQuality;

    console.log(`⚖️ [Judge] lang=${langScore} quality=${qualScore} → ${passed ? '✅ PASS' : '❌ FAIL'} (${result.feedback?.substring(0, 60)})`);

    return {
      scores: { language_purity: langScore, quality: qualScore },
      feedback: result.feedback || '',
      main_issue: result.main_issue || 'none',
      passed,
      fastPath: false
    };

  } catch (error) {
    console.error('[Judge] Error llamando al LLM juez:', error.message);
    // En caso de error del Judge, aprobar por defecto para no bloquear al usuario
    return {
      scores: { language_purity: 7, quality: 7 },
      feedback: 'Judge falló — aprobado por defecto',
      main_issue: 'none',
      passed: true,
      judgeError: true
    };
  }
}
