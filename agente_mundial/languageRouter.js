// ============================================
// LANGUAGE ROUTER — Detección y ruteo de idiomas
// ============================================
// Detecta el idioma destino del usuario usando análisis de codepoints Unicode.
// NO realiza llamadas a API — la detección es puramente local por regex.
//
// Tiers:
//   direct      → el generator produce directamente en el idioma destino
//   transcreate → el generator produce en idioma fuente (es/en) y luego
//                 transcreationService adapta al idioma destino

import { getSourceLanguage } from './anchors.js';

// Idiomas que el generator puede producir directamente (europeos y similares)
export const DIRECT_LANGUAGES = ['es', 'en', 'fr', 'pt', 'it', 'de', 'nl', 'pl'];

// Idiomas que requieren transcreación cultural
export const TRANSCREATION_LANGUAGES = ['ko', 'th', 'ar', 'ja', 'ru', 'zh', 'vi', 'hi'];

// Todos los idiomas soportados
export const ALL_SUPPORTED_LANGUAGES = [...DIRECT_LANGUAGES, ...TRANSCREATION_LANGUAGES];

/**
 * Detectores de scripts unicode por idioma.
 * Cada regex comprueba si el texto contiene caracteres del script.
 * Ordenados de más específico a más general para evitar false positives.
 */
const SCRIPT_DETECTORS = [
  { lang: 'ko', regex: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/u },   // Hangul
  { lang: 'th', regex: /[\u0E00-\u0E7F]/u },                              // Thai
  { lang: 'ar', regex: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u },   // Arabic
  { lang: 'ja', regex: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/u },   // Japanese (hiragana/katakana/kanji)
  { lang: 'zh', regex: /[\u4E00-\u9FFF\u3400-\u4DBF]/u },                 // Chinese (CJK)
  { lang: 'ru', regex: /[\u0400-\u04FF]/u },                              // Cyrillic (Russian, etc.)
  { lang: 'hi', regex: /[\u0900-\u097F]/u },                              // Devanagari (Hindi)
  { lang: 'vi', regex: /[\u1EA0-\u1EF9\u0102\u0103\u01A0\u01A1\u01AF\u01B0\u0300-\u0323]/u }, // Vietnamese (diacritics)
];

/**
 * Detecta el idioma del mensaje del usuario usando análisis de script unicode.
 * @param {string} userQuery - El mensaje del usuario
 * @param {string} personalityId - ID de la personalidad activa
 * @returns {string} Código ISO del idioma detectado ('es', 'ko', 'ar', etc.)
 */
export function detectTargetLanguage(userQuery, personalityId) {
  if (!userQuery || typeof userQuery !== 'string') {
    return getSourceLanguage(personalityId);
  }

  // Buscar script no-latino en el mensaje
  for (const { lang, regex } of SCRIPT_DETECTORS) {
    if (regex.test(userQuery)) {
      console.log(`🌐 [LanguageRouter] Script detectado: ${lang} en "${userQuery.substring(0, 40)}"`);
      return lang;
    }
  }

  // Texto latino — usar el idioma fuente de la personalidad (es o en)
  const sourceLang = getSourceLanguage(personalityId);
  return sourceLang;
}

/**
 * Determina si un idioma destino requiere transcreación cultural.
 * @param {string} targetLang - Código ISO del idioma destino
 * @returns {boolean}
 */
export function isTranscreationNeeded(targetLang) {
  return TRANSCREATION_LANGUAGES.includes(targetLang);
}

/**
 * Devuelve el nombre legible del idioma para logs y prompts.
 * @param {string} langCode - Código ISO
 * @returns {string}
 */
export function getLanguageName(langCode) {
  const names = {
    es: 'Español', en: 'English', fr: 'Français', pt: 'Português',
    it: 'Italiano', de: 'Deutsch', nl: 'Nederlands', pl: 'Polski',
    ko: '한국어 (Korean)', th: 'ภาษาไทย (Thai)', ar: 'العربية (Arabic)',
    ja: '日本語 (Japanese)', ru: 'Русский (Russian)', zh: '中文 (Chinese)',
    vi: 'Tiếng Việt (Vietnamese)', hi: 'हिन्दी (Hindi)'
  };
  return names[langCode] || langCode;
}

/**
 * Construye la instrucción de idioma agresiva para el system prompt.
 * Repetida al inicio Y al final para combatir la tendencia de Qwen/llama a mezclar idiomas.
 * @param {string} langCode
 * @returns {{ prefix: string, suffix: string }}
 */
export function buildLanguageInstruction(langCode) {
  const langName = getLanguageName(langCode);

  const prefix = `⚠️ IDIOMA OBLIGATORIO: Responde EXCLUSIVAMENTE en ${langName}. CERO caracteres de otros idiomas. Cualquier mezcla de idiomas es un ERROR CRÍTICO.`;
  const suffix = `⚠️ RECORDATORIO FINAL: Tu respuesta debe estar 100% en ${langName}. Sin excepciones. Sin mezclas.`;

  return { prefix, suffix };
}
