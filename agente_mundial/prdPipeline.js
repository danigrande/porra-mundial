// ============================================
// PRD PIPELINE — Feedback → PRD (nativo)
// ============================================
// Implementa nativamente el pipeline de 3 agentes que originalmente se diseñó
// como flow de LangFlow (prediccion mundial.json):
//
//   Feedback → Strategy Owner → PRD Writer → Juno Orchestrator → PRD
//
// Se ejecuta con Groq (misma convención que groqEngine.js), sin servicio externo.
// Si no hay GROQ_API_KEY o algo falla, degrada a un análisis simulado por keywords.

import Groq from 'groq-sdk';
import config from './config.js';

const groq = config.groq.apiKey ? new Groq({ apiKey: config.groq.apiKey }) : null;

// El modelo configurado puede haber quedado obsoleto en Groq; probamos una cadena
// de candidatos y recordamos el primero que funcione.
const MODEL_CANDIDATES = Array.from(
  new Set(
    [process.env.PRD_MODEL, config.groq.model, 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'].filter(Boolean),
  ),
);
let preferredModel = MODEL_CANDIDATES[0];

function isModelError(error) {
  const message = String(error?.message || '');
  return (
    error?.status === 404 ||
    /does not exist|not_found|model_not_found|do not have access/i.test(message)
  );
}

// --- System prompts (idénticos a los del flow de LangFlow) ---

const STRATEGY_OWNER_PROMPT = `Eres Strategy Owner de 'Porra Mundial 2026', una plataforma de pronósticos deportivos sociales.

ESTRATEGIA DEL PRODUCTO:
1. Fiabilidad del sistema de puntuaciones
2. Incrementar usuarios y grupos
3. Promover uso del chat e interacción
4. Experiencia de usuario móvil
5. Funcionalidades sociales (chats, grupos, rankings)
6. Rendimiento y tiempos de carga

INSTRUCCIONES:
Recibes feedback de usuarios. Debes:
1. Clasificar el tipo (bug, feature, improvement, other)
2. Asignar prioridad:
   - P0: Bugs críticos, errores de puntuación, caídas del sistema
   - P1: Features core (login, grupos, scores), bugs importantes
   - P2: Mejoras de funcionalidades existentes, UI/UX
   - P3: Sugerencias menores, nice-to-have
   - P-PENDING: Feedback ambiguo, incompleto, o sin suficiente detalle para priorizar. NO inventes datos.
3. Escribir un análisis breve del feedback
4. Justificar la prioridad asignada

Responde ÚNICAMENTE con un JSON válido con este formato:
{"type": "bug|feature|improvement|other", "priority": "P0|P1|P2|P3|P-PENDING", "reason": "Justificación breve", "analysis": "Análisis del feedback", "fuzzy": false}

Si el feedback es FUZZY (ambiguo, muy corto, sin contexto), pon priority="P-PENDING" y fuzzy=true.`;

const PRD_WRITER_PROMPT = `Eres PRD Writer para 'Porra Mundial 2026'. Tu función es generar documentos de Product Requirement Document (PRD) formales a partir del análisis del Strategy Owner.

SOLO generas PRDs para items con prioridad P0, P1, o P2. Si la prioridad es P3 o P-PENDING, responde con un JSON que indique que no aplica.

Estructura del PRD:
{"title": "Título descriptivo", "priority": "P0|P1|P2", "problemStatement": "Descripción detallada del problema", "proposedSolution": "Solución propuesta", "userImpact": "Cómo afecta a usuarios", "technicalNotes": "Consideraciones técnicas", "acceptanceCriteria": ["Criterio 1", "Criterio 2"], "suggestedFiles": ["archivo1.js", "archivo2.js"]}

IMPORTANTE: Sé específico. Los criterios de aceptación deben ser comprobables. No uses lenguaje vago.`;

const JUNO_PROMPT = `Eres Juno Orchestrator, el agente coordinador del pipeline de feedback a PRD.

Recibes:
1. El feedback original
2. El análisis/prioridad del Strategy Owner
3. El PRD generado (si aplica)

Tu trabajo:
1. Validar que el PRD sea coherente con el feedback original
2. Si el Strategy Owner marcó fuzzy=true o priority=P-PENDING, NO generes PRD. Devuelve un mensaje claro indicando que el feedback necesita más información.
3. Si el PRD está bien, consolida todo en una respuesta final formateada
4. Si detectas inconsistencias entre el análisis y el PRD, ajústalas

Responde ÚNICAMENTE con un JSON final con esta estructura:
{"status": "prd_generated|needs_clarification|low_priority", "feedbackSummary": "Resumen del feedback original", "priority": "P0|P1|P2|P3|P-PENDING", "title": "Título del PRD", "problemStatement": "Descripción del problema", "proposedSolution": "Solución propuesta", "userImpact": "Impacto en usuarios", "technicalNotes": "Notas técnicas", "acceptanceCriteria": ["Criterios"], "suggestedFiles": ["Archivos"], "message": "Mensaje adicional para el developer"}`;

export const AGENT_PROMPTS = {
  strategyOwner: STRATEGY_OWNER_PROMPT,
  prdWriter: PRD_WRITER_PROMPT,
  juno: JUNO_PROMPT,
};

/** Extrae el primer objeto JSON de un texto (tolera fences de markdown). */
export function parseJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGroq(system, user, { temperature = 0.2, maxTokens = 800 } = {}) {
  if (!groq) return null;
  const models = [preferredModel, ...MODEL_CANDIDATES.filter((m) => m !== preferredModel)];
  let lastError;

  for (const model of models) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      });
      preferredModel = model;
      return completion.choices?.[0]?.message?.content?.trim() || '';
    } catch (error) {
      lastError = error;
      if (!isModelError(error)) throw error;
      console.warn(`[PRD] Modelo ${model} no disponible, probando el siguiente…`);
    }
  }
  throw lastError;
}

/**
 * Ejecuta el pipeline completo de 3 agentes.
 * @returns {Promise<{raw: string, parsed: object, analysis: object, prd: object|null, success: boolean, simulated: boolean}>}
 */
export async function runAgentPipeline(feedbackText, feedbackId = null) {
  if (!groq) {
    console.warn('[PRD] GROQ_API_KEY no configurado — usando análisis simulado');
    return simulateAnalysis(feedbackText);
  }

  try {
    // 1. Strategy Owner — clasifica y prioriza
    const ownerRaw = await callGroq(STRATEGY_OWNER_PROMPT, feedbackText, {
      temperature: 0.2,
      maxTokens: 500,
    });
    const owner = parseJson(ownerRaw);
    if (!owner) throw new Error('Strategy Owner no devolvió JSON válido');

    const priority = owner.priority || 'P-PENDING';
    const fuzzy = owner.fuzzy === true || priority === 'P-PENDING';

    // 2. PRD Writer — solo para P0–P2 y feedback no ambiguo
    let prd = null;
    if (!fuzzy && ['P0', 'P1', 'P2'].includes(priority)) {
      const prdUser = `FEEDBACK ORIGINAL:\n${feedbackText}\n\nANÁLISIS DEL STRATEGY OWNER:\n${JSON.stringify(owner)}`;
      const prdRaw = await callGroq(PRD_WRITER_PROMPT, prdUser, {
        temperature: 0.3,
        maxTokens: 1200,
      });
      prd = parseJson(prdRaw);
    }

    // 3. Juno Orchestrator — valida y consolida
    const junoUser = [
      `FEEDBACK ORIGINAL:\n${feedbackText}`,
      `ANÁLISIS DEL STRATEGY OWNER:\n${JSON.stringify(owner)}`,
      prd ? `PRD GENERADO:\n${JSON.stringify(prd)}` : 'PRD GENERADO: (no aplica)',
    ].join('\n\n');
    const junoRaw = await callGroq(JUNO_PROMPT, junoUser, {
      temperature: 0.2,
      maxTokens: 1200,
    });
    const juno = parseJson(junoRaw);

    return {
      raw: junoRaw || ownerRaw,
      parsed: juno || { ...owner, ...(prd || {}) },
      analysis: owner,
      prd,
      success: true,
      simulated: false,
    };
  } catch (error) {
    console.error('[PRD] Error en el pipeline:', error.message);
    return { ...simulateAnalysis(feedbackText), error: error.message };
  }
}

/** Análisis de reserva por keywords (sin LLM). */
export function simulateAnalysis(feedbackText) {
  const lower = String(feedbackText || '').toLowerCase();
  let priority = 'P3';
  let reason = 'No se pudo determinar prioridad automáticamente';

  if (lower.includes('bug') || lower.includes('error') || lower.includes('crash') || lower.includes('no funciona') || lower.includes('falla')) {
    priority = 'P0';
    reason = 'Posible bug o fallo funcional que afecta a usuarios';
  } else if (lower.includes('login') || lower.includes('registro') || lower.includes('pago') || lower.includes('score') || lower.includes('puntuacion') || lower.includes('puntuación')) {
    priority = 'P1';
    reason = 'Afecta a funcionalidad core de la aplicación';
  } else if (lower.includes('chat') || lower.includes('grupo') || lower.includes('noti') || lower.includes('ui') || lower.includes('diseño')) {
    priority = 'P2';
    reason = 'Mejora de funcionalidad existente o experiencia de usuario';
  }

  const parsed = {
    type: 'other',
    priority,
    reason,
    analysis: String(feedbackText || '').substring(0, 200),
    fuzzy: priority === 'P-PENDING',
  };

  return {
    raw: JSON.stringify(parsed),
    parsed,
    analysis: parsed,
    prd: null,
    success: true,
    simulated: true,
  };
}

/** Convierte la salida del pipeline (raw JSON o ya parseada) al modelo de PRD. */
export function extractPRDFromAnalysis(rawAnalysis) {
  const parsed = typeof rawAnalysis === 'string' ? parseJson(rawAnalysis) : rawAnalysis;
  if (!parsed) return null;
  return {
    title: parsed.title || parsed.problemStatement?.substring(0, 80) || 'PRD sin título',
    problemStatement: parsed.problemStatement || '',
    proposedSolution: parsed.proposedSolution || '',
    userImpact: parsed.userImpact || '',
    technicalNotes: parsed.technicalNotes || '',
    acceptanceCriteria: parsed.acceptanceCriteria || [],
    suggestedFiles: parsed.suggestedFiles || [],
    priority: parsed.priority || 'P2',
  };
}
