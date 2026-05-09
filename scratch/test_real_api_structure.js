import { syncRealityFromApi } from '../agente_mundial/apiFootballService.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES } from '../agente_mundial/shared_data.js';

// Simulacro de respuesta real de API-Football (v3)
// Basado en la estructura oficial que devuelve la API para partidos finalizados
const mockApiResponse = {
  "response": [
    {
      "fixture": {
        "id": 857920,
        "date": "2026-06-11T19:00:00+00:00",
        "status": { "long": "Match Finished", "short": "FT" }
      },
      "teams": {
        "home": { "name": "México" },
        "away": { "name": "Sudáfrica" }
      },
      "goals": { "home": 2, "away": 1 },
      "score": {
        "fulltime": { "home": 2, "away": 1 },
        "penalty": { "home": null, "away": null }
      },
      "events": [
        { "time": { "elapsed": 12, "extra": null }, "team": { "name": "México" }, "player": { "name": "Raul J." }, "type": "Goal", "detail": "Normal Goal" },
        { "time": { "elapsed": 45, "extra": null }, "team": { "name": "Sudáfrica" }, "player": { "name": "Percy T." }, "type": "Goal", "detail": "Normal Goal" },
        { "time": { "elapsed": 88, "extra": null }, "team": { "name": "México" }, "player": { "name": "Chucky L." }, "type": "Goal", "detail": "Normal Goal" }
      ]
    }
  ]
};

console.log("🧪 Iniciando test de integración con estructura de API real...");

const currentReality = { events: {} };
const updated = syncRealityFromApi(mockApiResponse, currentReality, FIXTURE_GROUPS, BRACKET_MATCHES);

console.log("\n📊 Datos procesados en nuestro sistema:");
console.log(JSON.stringify(updated, null, 2));

// Verificación de éxito
if (updated['gA_m0_h'] === '2' && updated['gA_m0_a'] === '1' && updated.events['gA_m0'].length === 3) {
    console.log("\n✅ TEST EXITOSO: El sistema ha reconocido el partido de la API y ha extraído los goles y eventos correctamente.");
} else {
    console.log("\n❌ TEST FALLIDO: El mapeo no ha funcionado como se esperaba.");
    process.exit(1);
}
