import 'dotenv/config';
import { Group } from './models/Group.js';

// ============================================
// TOURNAMENT STATE — Máquina de Estados (Opción B)
// ============================================

const REAL_PHASES = [
  { id: 'PRE_TOURNAMENT', name: 'Pre-Mundial', start: '2026-01-01T00:00:00Z', end: '2026-06-11T19:00:00Z', unlocks: ['groups', 'honor'] },
  { id: 'GROUP_STAGE', name: 'Fase de Grupos', start: '2026-06-11T19:00:00Z', end: '2026-06-27T00:00:00Z', unlocks: [] },
  { id: 'WAITING_R32', name: 'Ventana de 1/16 Final', start: '2026-06-27T00:00:00Z', end: '2026-06-28T19:00:00Z', unlocks: ['r32'] },
  { id: 'R32_ACTIVE', name: '1/16 Final', start: '2026-06-28T19:00:00Z', end: '2026-07-03T00:00:00Z', unlocks: [] },
  { id: 'WAITING_R16', name: 'Ventana de Octavos', start: '2026-07-03T00:00:00Z', end: '2026-07-04T19:00:00Z', unlocks: ['r16'] },
  { id: 'R16_ACTIVE', name: 'Octavos de Final', start: '2026-07-04T19:00:00Z', end: '2026-07-08T00:00:00Z', unlocks: [] },
  { id: 'WAITING_QF', name: 'Ventana de Cuartos', start: '2026-07-08T00:00:00Z', end: '2026-07-09T19:00:00Z', unlocks: ['qf'] },
  { id: 'QF_ACTIVE', name: 'Cuartos de Final', start: '2026-07-09T19:00:00Z', end: '2026-07-12T00:00:00Z', unlocks: [] },
  { id: 'WAITING_SF', name: 'Ventana de Semifinales', start: '2026-07-12T00:00:00Z', end: '2026-07-14T19:00:00Z', unlocks: ['sf'] },
  { id: 'SF_ACTIVE', name: 'Semifinales', start: '2026-07-14T19:00:00Z', end: '2026-07-16T00:00:00Z', unlocks: [] },
  { id: 'WAITING_FINALS', name: 'Ventana de Finales', start: '2026-07-16T00:00:00Z', end: '2026-07-18T19:00:00Z', unlocks: ['3rd', 'final'] },
  { id: 'FINALS_ACTIVE', name: 'Finales', start: '2026-07-18T19:00:00Z', end: '2026-07-20T00:00:00Z', unlocks: [] },
  { id: 'POST_TOURNAMENT', name: 'Torneo Finalizado', start: '2026-07-20T00:00:00Z', end: '2030-01-01T00:00:00Z', unlocks: [] },
];

const TEST_PHASES = [
  { id: 'PRE_TOURNAMENT', name: 'Pre-Mundial (TEST)', start: '2026-01-03T00:00:00Z', end: '2026-05-27T10:00:00Z', unlocks: ['groups', 'honor'] },
  { id: 'GROUP_STAGE', name: 'Fase de Grupos (TEST)', start: '2026-05-27T10:00:00Z', end: '2026-05-28T10:00:00Z', unlocks: [] },
  { id: 'WAITING_R32', name: 'Ventana 1/16 (TEST)', start: '2026-05-28T10:00:00Z', end: '2026-05-29T10:00:00Z', unlocks: ['r32'] },
  { id: 'R32_ACTIVE', name: '1/16 Final (TEST)', start: '2026-05-29T10:00:00Z', end: '2026-05-30T10:00:00Z', unlocks: [] },
  { id: 'WAITING_R16', name: 'Ventana Octavos (TEST)', start: '2026-05-30T10:00:00Z', end: '2026-05-31T10:00:00Z', unlocks: ['r16'] },
  { id: 'R16_ACTIVE', name: 'Octavos Final (TEST)', start: '2026-05-31T10:00:00Z', end: '2026-06-01T10:00:00Z', unlocks: [] },
  { id: 'WAITING_QF', name: 'Ventana Cuartos (TEST)', start: '2026-06-01T10:00:00Z', end: '2026-06-02T10:00:00Z', unlocks: ['qf'] },
  { id: 'QF_ACTIVE', name: 'Cuartos Final (TEST)', start: '2026-06-02T10:00:00Z', end: '2026-06-03T10:00:00Z', unlocks: [] },
  { id: 'WAITING_SF', name: 'Ventana Semis (TEST)', start: '2026-06-03T10:00:00Z', end: '2026-06-04T10:00:00Z', unlocks: ['sf'] },
  { id: 'SF_ACTIVE', name: 'Semifinales (TEST)', start: '2026-06-04T10:00:00Z', end: '2026-06-04T22:00:00Z', unlocks: [] },
  { id: 'WAITING_FINALS', name: 'Ventana Finales (TEST)', start: '2026-06-04T22:00:00Z', end: '2026-06-06T10:00:00Z', unlocks: ['3rd', 'final'] },
  { id: 'FINALS_ACTIVE', name: 'Final (TEST)', start: '2026-06-06T10:00:00Z', end: '2026-06-07T10:00:00Z', unlocks: [] },
  { id: 'POST_TOURNAMENT', name: 'Finalizado (TEST)', start: '2026-06-05T10:00:00Z', end: '2030-01-01T00:00:00Z', unlocks: [] },
];

export const TOURNAMENT_PHASES = process.env.TEST_MODE === 'true' ? TEST_PHASES : REAL_PHASES;

let simulatedTime = null;
export const setSimulatedTime = (isoString) => {
  simulatedTime = isoString ? new Date(isoString).getTime() : null;
};
export const getCurrentTime = () => simulatedTime || Date.now();

export const getTournamentState = async (groupName = 'Mundial 2026') => {
  const now = getCurrentTime();
  const currentPhaseIndex = TOURNAMENT_PHASES.findIndex(p => {
    const start = new Date(p.start).getTime();
    const end = new Date(p.end).getTime();
    return now >= start && now < end;
  });

  if (currentPhaseIndex === -1) {
    return { id: 'UNKNOWN', name: 'Fuera de Rango', isPredictionWindow: false };
  }

  const currentPhase = TOURNAMENT_PHASES[currentPhaseIndex];
  const nextPhase = TOURNAMENT_PHASES[currentPhaseIndex + 1] || null;
  
  // Determinar qué fases están abiertas (en este momento y en el pasado para visualización)
  let pastUnlocks = [];
  for (let i = 0; i <= currentPhaseIndex; i++) {
    pastUnlocks = pastUnlocks.concat(TOURNAMENT_PHASES[i].unlocks || []);
  }
  const visiblePhases = [...new Set(pastUnlocks)];

  // Es ventana de predicción si la fase actual tiene 'unlocks' definidos
  const isPredictionWindow = currentPhase.unlocks && currentPhase.unlocks.length > 0;
  
  const nextDeadline = new Date(currentPhase.end).getTime();
  const timeRemainingMs = Math.max(0, nextDeadline - now);

  let predictionMode = 'A';
  try {
    const group = await Group.findOne({ name: groupName });
    if (group) predictionMode = group.predictionMode || 'A';
  } catch (e) {
    console.error(`Error fetching predictionMode for ${groupName}:`, e.message);
  }

  return {
    id: currentPhase.id,
    name: currentPhase.name,
    unlocks: currentPhase.unlocks || [], // CRÍTICO: Para habilitar inputs
    visiblePhases: visiblePhases,       // CRÍTICO: Para mostrar rondas
    deadline: currentPhase.end,
    nextDeadline: nextPhase ? nextPhase.end : null,
    timeRemainingMs,
    isPredictionWindow,
    hasStarted: currentPhase.id !== 'PRE_TOURNAMENT',
    isTestMode: process.env.TEST_MODE === 'true',
    predictionMode,
    currentTime: new Date(now).toISOString()
  };
};
