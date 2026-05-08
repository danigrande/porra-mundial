/**
 * SCRIPT DE PRUEBA: VIAJE EN EL TIEMPO
 * Uso: node test_time_jump.js "2026-06-27T10:00:00Z"
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuración
const API_URL = 'http://localhost:3000/dev/simulate-time';
const DEV_KEY = 'tu_clave_aqui'; // Debes poner la clave que tengas en .env

async function jump(timeStr) {
  console.log(`🚀 Intentando saltar a: ${timeStr || 'Tiempo Real'}...`);
  
  try {
    const res = await fetch(`${API_URL}?key=${DEV_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeStr })
    });
    
    const data = await res.json();
    console.log('✅ Resultado:', data);
    
    if (data.newState) {
      console.log('\n--- NUEVO ESTADO DEL TORNEO ---');
      console.log(`Fase: ${data.newState.phase} (${data.newState.name})`);
      console.log(`¿Ventana Abierta?: ${data.newState.isPredictionWindow}`);
      console.log(`Cierre en: ${data.newState.nextDeadline}`);
      console.log('-------------------------------\n');
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

// Ejemplo: Saltar a la ventana de Octavos
// jump("2026-07-03T10:00:00Z");

// O resetear:
// jump(null);

const target = process.argv[2] || null;
jump(target);
