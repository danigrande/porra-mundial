import { simulatePhaseResults } from './apiFootballService.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET } from './shared_data.js';

try {
  console.log("Iniciando simulacion...");
  const res = simulatePhaseResults('groups', {}, FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET);
  console.log("Simulacion exitosa. Goles del primer partido:", res['gA_m0_h']);
} catch (e) {
  console.log("ERROR CRASH:", e.message);
  console.log(e.stack);
}
