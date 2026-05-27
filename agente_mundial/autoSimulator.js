import { Reality } from './models/Reality.js';
import { getTournamentState } from './tournamentState.js';
import * as apiFootballService from './apiFootballService.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET } from './shared_data.js';

export async function triggerAutoSimulationIfNeeded() {
  if (process.env.TEST_MODE !== 'true') return;
  
  try {
    const state = await getTournamentState();
    if (!state) return;

    const mapping = {
      'GROUP_STAGE': 'groups',
      'R32_ACTIVE': 'r32',
      'R16_ACTIVE': 'r16',
      'QF_ACTIVE': 'qf',
      'SF_ACTIVE': 'sf',
      'WAITING_FINALS': '3rd',
      'FINALS_ACTIVE': 'final'
    };

    const phaseToPopulate = mapping[state.id];
    if (!phaseToPopulate) return;

    const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
    const currentReality = realityDoc ? realityDoc.results : {};
    const autoPopulated = realityDoc ? (realityDoc.autoPopulatedPhases || []) : [];

    if (!autoPopulated.includes(phaseToPopulate)) {
      console.log(`🤖 [LAZY-SIM] Generando resultados para la fase: ${phaseToPopulate}`);
      
      const updatedResults = apiFootballService.simulatePhaseResults(
        phaseToPopulate,
        currentReality,
        FIXTURE_GROUPS,
        BRACKET_MATCHES,
        KNOCKOUT_BRACKET
      );

      await Reality.findOneAndUpdate(
        { tournament: 'worldcup2026' },
        { 
          results: updatedResults, 
          $addToSet: { autoPopulatedPhases: phaseToPopulate },
          updatedAt: new Date() 
        },
        { upsert: true }
      );
      
      console.log(`✅ [LAZY-SIM] Resultados de ${phaseToPopulate} inyectados correctamente.`);
    }

  } catch (error) {
    console.error('❌ Error en motor de auto-simulación perezosa:', error.message);
  }
}
