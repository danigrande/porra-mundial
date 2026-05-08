// ============================================
// TOURNAMENT STATE — Máquina de Estados (Opción B)
// ============================================

// Definición de las fases del Mundial 2026
// Usamos UTC para homogeneidad. 
// Las fechas reales del Mundial son del 11 de Junio al 19 de Julio de 2026.
export const TOURNAMENT_PHASES = [
  { id: 'PRE_TOURNAMENT', name: 'Pre-Mundial', start: '2026-01-01T00:00:00Z', end: '2026-06-11T19:00:00Z', unlocks: ['groups', 'honor'] },
  { id: 'GROUP_STAGE', name: 'Fase de Grupos', start: '2026-06-11T19:00:00Z', end: '2026-06-27T00:00:00Z', unlocks: [] }, // Grupos cierran el 26 por la noche
  { id: 'WAITING_R32', name: 'Ventana de 1/16 Final', start: '2026-06-27T00:00:00Z', end: '2026-06-28T19:00:00Z', unlocks: ['r32'] }, // 1er partido de 1/16
  { id: 'R32_ACTIVE', name: '1/16 Final', start: '2026-06-28T19:00:00Z', end: '2026-07-03T00:00:00Z', unlocks: [] },
  { id: 'WAITING_R16', name: 'Ventana de Octavos', start: '2026-07-03T00:00:00Z', end: '2026-07-04T19:00:00Z', unlocks: ['r16'] },
  { id: 'R16_ACTIVE', name: 'Octavos de Final', start: '2026-07-04T19:00:00Z', end: '2026-07-08T00:00:00Z', unlocks: [] },
  { id: 'WAITING_QF', name: 'Ventana de Cuartos', start: '2026-07-08T00:00:00Z', end: '2026-07-09T19:00:00Z', unlocks: ['qf'] },
  { id: 'QF_ACTIVE', name: 'Cuartos de Final', start: '2026-07-09T19:00:00Z', end: '2026-07-12T00:00:00Z', unlocks: [] },
  { id: 'WAITING_SF', name: 'Ventana de Semifinales', start: '2026-07-12T00:00:00Z', end: '2026-07-14T19:00:00Z', unlocks: ['sf'] },
  { id: 'SF_ACTIVE', name: 'Semifinales', start: '2026-07-14T19:00:00Z', end: '2026-07-16T00:00:00Z', unlocks: [] },
  { id: 'WAITING_FINALS', name: 'Ventana de Finales', start: '2026-07-16T00:00:00Z', end: '2026-07-18T19:00:00Z', unlocks: ['3rd', 'final'] }, // 3er puesto
  { id: 'FINALS_ACTIVE', name: 'Finales', start: '2026-07-18T19:00:00Z', end: '2026-07-20T00:00:00Z', unlocks: [] },
  { id: 'POST_TOURNAMENT', name: 'Torneo Finalizado', start: '2026-07-20T00:00:00Z', end: '2030-01-01T00:00:00Z', unlocks: [] },
];

// Motor de Tiempo (para Testing)
let simulatedTime = null;

export const setSimulatedTime = (isoString) => {
  if (isoString) {
    simulatedTime = new Date(isoString).getTime();
    console.log(`[STATE] ⏰ Tiempo simulado activado: ${new Date(simulatedTime).toISOString()}`);
  } else {
    simulatedTime = null;
    console.log(`[STATE] ⏰ Tiempo simulado DESACTIVADO (Usando tiempo real)`);
  }
};

export const getCurrentTime = () => {
  return simulatedTime ? simulatedTime : Date.now();
};

export const getTournamentState = () => {
  const now = getCurrentTime();
  
  // Encontrar la fase actual
  const currentPhaseIndex = TOURNAMENT_PHASES.findIndex(p => {
    const start = new Date(p.start).getTime();
    const end = new Date(p.end).getTime();
    return now >= start && now < end;
  });

  if (currentPhaseIndex === -1) {
    // Fuera de rango (muy pasado o muy futuro)
    return {
      phase: 'UNKNOWN',
      name: 'Desconocido',
      unlocks: [],
      nextDeadline: null,
      timeRemainingMs: 0,
      isPredictionWindow: false
    };
  }

  const currentPhase = TOURNAMENT_PHASES[currentPhaseIndex];
  const nextDeadline = new Date(currentPhase.end).getTime();
  const timeRemainingMs = Math.max(0, nextDeadline - now);
  const isPredictionWindow = currentPhase.id.startsWith('PRE_') || currentPhase.id.startsWith('WAITING_');

  // Determinar qué fases están abiertas (en este momento y en el pasado para visualización)
  let pastUnlocks = [];
  for (let i = 0; i <= currentPhaseIndex; i++) {
    pastUnlocks = pastUnlocks.concat(TOURNAMENT_PHASES[i].unlocks);
  }

  // Deduplicar
  const visiblePhases = [...new Set(pastUnlocks)];

  return {
    phase: currentPhase.id,
    name: currentPhase.name,
    unlocks: currentPhase.unlocks, // Fases editables AHORA
    visiblePhases: visiblePhases, // Fases visibles (aunque sean de solo lectura)
    nextDeadline: new Date(currentPhase.end).toISOString(),
    timeRemainingMs: timeRemainingMs,
    isPredictionWindow: isPredictionWindow,
    currentTime: new Date(now).toISOString()
  };
};
