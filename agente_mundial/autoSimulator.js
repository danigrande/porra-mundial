export async function triggerAutoSimulationIfNeeded() {
  if (process.env.TEST_MODE !== 'true') return;
  console.log('[AutoSim] TEST_MODE activo pero simulación deshabilitada — usando openfootball como fuente real');
}
