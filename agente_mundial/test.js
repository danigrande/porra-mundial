// ============================================
// TEST RÁPIDO — Verifica Groq + Data + Scoring
// ============================================
// Ejecutar: node test.js

import { getAllPredictions, getAllProfiles, getPlayerList } from './dataFetcher.js';
import { generateResponse, generateDailySummary } from './groqEngine.js';
import { processMessage, generateGroupSummary } from './messageHandler.js';
import config from './config.js';

async function runTests() {
  console.log('🧪 Iniciando tests del Agente Mundial...\n');

  // Test 1: Verificar conexión con Google Sheets
  console.log('═══ TEST 1: Google Sheets ═══');
  try {
    const players = await getPlayerList();
    console.log(`✅ Jugadores registrados: ${JSON.stringify(players)}`);
    
    const predictions = await getAllPredictions();
    const playerNames = Object.keys(predictions);
    console.log(`✅ Predicciones encontradas para: ${playerNames.join(', ') || 'ninguno'}`);
    
    const profiles = await getAllProfiles();
    console.log(`✅ Perfiles remotos: ${Object.keys(profiles).join(', ') || 'ninguno (usaremos locales)'}`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }

  // Test 2: Verificar Groq LLM
  console.log('\n═══ TEST 2: Groq LLM ═══');
  try {
    console.log('⏳ Enviando pregunta a Groq...');
    const response = await generateResponse('Dani', '¿Cómo voy en la porra?', {
      ranking: null,
      playerStats: {
        position: 2,
        totalPts: 145,
        exactHits: 5,
        groupPts: 90,
        koPts: 35,
        honorPts: 20,
      },
      profile: config.playerProfiles['Dani'],
      leaderboard: [
        { name: 'Judas', totalPts: 180, exactHits: 8 },
        { name: 'Dani', totalPts: 145, exactHits: 5 },
        { name: 'Harrry', totalPts: 130, exactHits: 4 },
        { name: 'Dani Grande', totalPts: 110, exactHits: 3 },
      ],
    });
    console.log(`✅ Respuesta de Groq:\n\n"${response}"\n`);
  } catch (e) {
    console.log(`❌ Error Groq: ${e.message}`);
  }

  // Test 3: Verificar processMessage (flujo completo)
  console.log('═══ TEST 3: Flujo completo (processMessage) ═══');
  try {
    console.log('⏳ Simulando mensaje de un usuario...');
    const reply = await processMessage(
      'agente, ¿quién va primero?',
      '34600000001@s.whatsapp.net', // Simula el número de Dani
      true,  // es grupo
      false  // no mencionado directamente
    );
    console.log(`✅ Respuesta del bot:\n\n"${reply}"\n`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }

  // Test 4: Generar resumen de jornada
  console.log('═══ TEST 4: Resumen de jornada ═══');
  try {
    console.log('⏳ Generando resumen...');
    const summary = await generateGroupSummary();
    console.log(`✅ Resumen:\n\n"${summary}"\n`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }

  console.log('🏁 Tests completados.');
}

runTests();
