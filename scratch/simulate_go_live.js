/**
 * SCRIPT DE AUTOMATIZACIÓN: Simulación Go-Live (Mayo 18-28)
 * 
 * Este script permite ejecutar toda la simulación en segundos para verificar
 * que las notificaciones y bloqueos funcionan correctamente.
 * 
 * Uso: node scratch/simulate_go_live.js [groupName]
 */

const axios = require('axios');
const API_URL = process.env.RENDER_URL || 'http://localhost:3000/api';

async function runSimulation(groupName) {
    console.log(`🚀 Iniciando simulación para el grupo: ${groupName}`);

    try {
        // 1. Resetear datos
        console.log('🧹 Reseteando datos de test...');
        await axios.post(`${API_URL}/dev/reset-test`, { groupName });

        const steps = [
            { date: '2026-05-17T10:00:00Z', phase: 'PRE_TOURNAMENT', label: 'Pre-Mundial' },
            { date: '2026-05-20T11:00:00Z', phase: 'groups', label: 'Fin de Grupos' },
            { date: '2026-05-22T11:00:00Z', phase: 'r32', label: 'Fin de 1/16' },
            { date: '2026-05-24T11:00:00Z', phase: 'r16', label: 'Fin de Octavos' },
            { date: '2026-05-26T11:00:00Z', phase: 'qf', label: 'Fin de Cuartos' },
            { date: '2026-05-28T11:00:00Z', phase: 'sf', label: 'Fin de Semis' },
            { date: '2026-05-30T11:00:00Z', phase: 'final', label: 'Fin de Final' },
        ];

        for (const step of steps) {
            console.log(`\n--- PASO: ${step.label} (${step.date}) ---`);
            
            // A. Saltar en el tiempo
            console.log(`⏰ Saltando al ${step.date}...`);
            await axios.post(`${API_URL}/dev/simulate-time`, { time: step.date });

            // B. Generar resultados si no es el inicio
            if (step.phase !== 'PRE_TOURNAMENT') {
                console.log(`⚽ Generando resultados para: ${step.phase}...`);
                await axios.post(`${API_URL}/dev/populate-reality`, { phaseId: step.phase });
            }

            console.log(`✅ Paso completado. El bot debería haber enviado notificaciones.`);
            // Esperar un poco para que el bot procese los intervalos
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('\n🏆 SIMULACIÓN COMPLETADA CON ÉXITO');
        
    } catch (error) {
        console.error('❌ Error en la simulación:', error.response ? error.response.data : error.message);
    }
}

const group = process.argv[2] || 'Grupo de Prueba';
runSimulation(group);
