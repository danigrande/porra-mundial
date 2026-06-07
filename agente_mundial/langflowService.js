import axios from 'axios';
import config from './config.js';

const LANGBASE_URL = process.env.LANGBASE_URL || 'http://localhost:7860';
const FLOW_ID = process.env.LANGFLOW_FLOW_ID || '';

export async function runLangFlow(feedbackText, feedbackId) {
  if (!FLOW_ID) {
    console.warn('[LangFlow] FLOW_ID no configurado — retornando análisis simulado');
    return simulateAnalysis(feedbackText);
  }

  try {
    const payload = {
      input_value: feedbackText,
      twi: {},
      output_component: '',
    };

    const res = await axios.post(`${LANGBASE_URL}/api/v1/run/${FLOW_ID}`, payload, {
      timeout: 120000,
    });

    const outputs = res.data?.outputs || [];
    const raw = outputs.map(o => o.outputs?.map(out => out.results?.text?.text || out.artifacts?.message || '')).flat().filter(Boolean).join('\n');

    return { raw, success: true };
  } catch (error) {
    console.error('[LangFlow] Error calling LangFlow:', error.message);
    return { raw: '', success: false, error: error.message };
  }
}

function simulateAnalysis(feedbackText) {
  const lower = feedbackText.toLowerCase();
  let priority = 'P3';
  let reason = 'No se pudo determinar prioridad automáticamente';

  if (lower.includes('bug') || lower.includes('error') || lower.includes('crash') || lower.includes('no funciona') || lower.includes('falla')) {
    priority = 'P0';
    reason = 'Posible bug o fallo funcional que afecta a usuarios';
  } else if (lower.includes('login') || lower.includes('registro') || lower.includes('pago') || lower.includes('score') || lower.includes('puntuacion') || lower.includes('puntuación')) {
    priority = 'P1';
    reason = 'Afecta a funcionalidad core de la aplicación';
  } else if (lower.includes('chat') || lower.includes('grupo') || lower.includes('noti') || lower.includes('ui') || lower.includes('diseño') || lower.includes('diseño')) {
    priority = 'P2';
    reason = 'Mejora de funcionalidad existente o experiencia de usuario';
  } else {
    priority = 'P3';
    reason = 'Sugerencia o mejora menor, requiere revisión para priorizar';
  }

  return {
    raw: JSON.stringify({ priority, reason, analysis: feedbackText.substring(0, 200) }),
    success: true,
    simulated: true,
    parsed: { priority, reason, analysis: feedbackText.substring(0, 200) }
  };
}

export async function extractPRDFromAnalysis(rawAnalysis) {
  try {
    const parsed = JSON.parse(rawAnalysis);
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
  } catch {
    return null;
  }
}