// ============================================
// AGENTE MUNDIAL — Bot Principal
// ============================================
// Servidor Express + Chat en tiempo real (Socket.IO).
// Ya no depende de WhatsApp.

import fs from 'fs';
import http from 'http';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { schedule } from 'node-cron';
import config from './config.js';
import { refreshCache, generateGroupSummary } from './messageHandler.js';
import { Group } from './models/Group.js';
import { Reality } from './models/Reality.js';
import { getTournamentState, getCurrentTime } from './tournamentState.js';
import * as apiFootballService from './apiFootballService.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET } from './shared_data.js';
import { connectDB } from './db.js';
import apiRoutes from './routes/api.js';
import devDashboardRoutes from './routes/devDashboard.js';
import { initChatServer, sendBotMessage } from './chatService.js';
import * as pushService from './pushService.js';

const logger = pino({ level: 'warn' });

// Conectar a MongoDB
connectDB();

// ==========================================
// SERVIDOR EXPRESS + HTTP
// ==========================================
const app = express();
const server = http.createServer(app);

app.use(cors()); // Permitir llamadas desde la web
app.use(express.json()); // Permitir body en JSON para la nueva API

// Usar nuestras rutas de Node.js
app.use('/api', apiRoutes);
app.use('/dev', devDashboardRoutes);

app.get('/', (req, res) => {
  res.json({
    status: '🏆 Agente Mundial activo',
    mode: 'Socket.IO Chat (sin WhatsApp)',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Endpoint para forzar un resumen (útil para testing)
app.get('/trigger-summary', async (req, res) => {
  try {
    const requestedGroup = req.query.groupName;
    
    if (requestedGroup) {
      await refreshCache(requestedGroup);
      const summary = await generateGroupSummary(requestedGroup, true);
      
      if (summary) {
        // Enviar por Socket.IO en vez de WhatsApp
        await sendBotMessage(requestedGroup, `📊 *RESUMEN FORZADO* 📊\n\n${summary}`);
        const dataFetcher = await import('./dataFetcher.js');
        await dataFetcher.saveSummary('Global', requestedGroup, summary);
      }
      return res.json({ summary });
    }
    
    // Sin grupo específico: intentar con el primer grupo de la BD
    const firstGroup = await Group.findOne();
    if (!firstGroup) return res.json({ error: 'No hay grupos registrados' });
    
    await refreshCache(firstGroup.name);
    const summary = await generateGroupSummary(firstGroup.name, true);
    
    if (summary) {
      await sendBotMessage(firstGroup.name, `📊 *RESUMEN FORZADO* 📊\n\n${summary}`);
      const dataFetcher = await import('./dataFetcher.js');
      await dataFetcher.saveSummary('Global', firstGroup.name, summary);
    }
    
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API para la web (player_score.html)
app.get('/api/summary/:player', async (req, res) => {
  const { player } = req.params;
  const groupNameFromUrl = req.query.groupName;
  console.log(`🌐 Peticion de resumen desde la web para: ${player} en grupo: ${groupNameFromUrl}`);

  if (!groupNameFromUrl) {
    return res.status(400).json({ error: 'groupName es requerido' });
  }

  try {
    const dataFetcher = await import('./dataFetcher.js');
    const { refreshCache } = await import('./messageHandler.js');
    const { generateResponse } = await import('./groqEngine.js');

    await refreshCache(groupNameFromUrl);

    const [predictions, profiles, rules] = await Promise.all([
      dataFetcher.getAllPredictions(groupNameFromUrl),
      dataFetcher.getAllProfiles(groupNameFromUrl),
      dataFetcher.getRules(groupNameFromUrl),
    ]);

    const leaderboard = Object.entries(predictions).map(([name, data]) => ({ name, ...data }));
    const profile = profiles[player] || null;
    const playerStats = leaderboard.find(p => p.name === player) || null;

    const context = {
      groupName: groupNameFromUrl,
      ranking: leaderboard,
      playerStats,
      profile,
      rules,
    };

    console.log(`🤖 Generando resumen IA para ${player} (grupo: ${groupNameFromUrl})...`);
    const summary = await generateResponse(player, 'resumen', context);

    if (summary) {
      console.log(`💾 Guardando resumen para ${player} en Google Sheets (Grupo: ${groupNameFromUrl})...`);
      await dataFetcher.saveSummary(player, groupNameFromUrl, summary);
      console.log(`✅ Resumen guardado correctamente`);
    }

    res.json({ summary });
  } catch (error) {
    console.error('❌ Error en API summary:', error);
    res.status(500).json({ error: 'Error al generar resumen' });
  }
});

// ==========================================
// INICIALIZAR SOCKET.IO CHAT
// ==========================================
const io = initChatServer(server);

// ==========================================
// ARRANCAR SERVIDOR
// ==========================================
const PORT = config.bot.port;
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP + Socket.IO en puerto ${PORT}`);
});

// ==========================================
// RESÚMENES PROGRAMADOS
// ==========================================

// Resumen diario a las 23:00 (hora España) — Multi-grupo
schedule('0 23 * * *', async () => {
  console.log(`📢 Generando resúmenes programados para TODOS los grupos...`);
  try {
    const allGroups = await Group.find();

    if (allGroups.length === 0) {
      console.log('⚠️ No hay grupos registrados. Saltando resúmenes.');
      return;
    }

    console.log(`📋 Grupos a procesar: ${allGroups.map(g => g.name).join(', ')}`);

    for (const group of allGroups) {
      try {
        console.log(`\n📢 Procesando grupo: ${group.name}`);
        await refreshCache(group.name);
        
        const summary = await generateGroupSummary(group.name);
        console.log(`📝 Resumen generado (longitud: ${summary?.length || 0})`);
   
        if (summary && summary.length > 50) {
          // Enviar por Socket.IO + Push
          await sendBotMessage(group.name, `📊 *RESUMEN DE LA JORNADA* 📊\n\n${summary}`);
          console.log(`✅ Resumen publicado en ${group.name}`);
          
          const dataFetcher = await import('./dataFetcher.js');
          await dataFetcher.saveSummary("Global", group.name, summary);
        } else {
          console.warn(`⚠️ Resumen vacío/corto para ${group.name}, no se envía.`);
        }
      } catch (groupError) {
        console.error(`❌ Error en resumen de ${group.name}:`, groupError.message);
      }
    }
    console.log('\n✅ Resúmenes programados completados.');
  } catch (error) {
    console.error('Error en resúmenes programados:', error.message);
  }
}, {
  timezone: 'Europe/Madrid',
});

// ==========================================
// NOTIFICACIONES PROACTIVAS
// ==========================================

async function initProactiveNotifications() {
  console.log('📢 Iniciando motor de notificaciones proactivas...');
  
  setInterval(async () => {
    try {
      const state = await getTournamentState();
      if (!state) return;

      const groups = await Group.find();
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

      for (const group of groups) {
        const rules = group.rules || {};
        const isEligible = rules.prediction_mode === 'B' || state.id === 'PRE_TOURNAMENT';

        if (!isEligible) continue;

        // 1. Detección de Apertura de Fase
        if (state.isPredictionWindow && group.lastAnnouncedPhase !== state.id) {
          console.log(`🔔 Notificando APERTURA de ${state.id} al grupo ${group.name}...`);
          
          const msg = `🚨 *¡FASE ABIERTA!* 🚨\n\nEl torneo ha entrado en la fase: *${state.name}*.\n\nYa podéis entrar a la app para completar vuestras predicciones. ¡Tenéis hasta el cierre de la ventana!`;
          await sendBotMessage(group.name, msg);

          group.lastAnnouncedPhase = state.id;
          await group.save();
        }

        // 2. Recordatorio de 2 horas
        if (state.isPredictionWindow && state.timeRemainingMs < TWO_HOURS_MS && group.lastReminderPhase !== state.id) {
          console.log(`⏰ Enviando RECORDATORIO de ${state.id} al grupo ${group.name}...`);
          
          const msg = `⏳ *¡ÚLTIMA LLAMADA!* ⏳\n\nQuedan menos de *2 horas* para que se cierren las predicciones de *${state.name}*.\n\n¡Entra ya si no quieres quedarte con 0 puntos en esta ronda!`;
          await sendBotMessage(group.name, msg);

          group.lastReminderPhase = state.id;
          await group.save();
        }
      }

    } catch (error) {
      console.error('❌ Error en motor de notificaciones:', error.message);
    }
  }, 60000); // Comprobar cada minuto
}

// ==========================================
// SIMULACIÓN AUTOMÁTICA (Solo en TEST_MODE)
// ==========================================

async function initAutoSimulation() {
  if (process.env.TEST_MODE !== 'true') return;
  
  console.log('🧪 MODO TEST: Iniciando motor de auto-simulación de resultados...');
  
  setInterval(async () => {
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

      const phaseToPopulate = mapping[state.phase];
      if (!phaseToPopulate) return;

      const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
      const currentReality = realityDoc ? realityDoc.results : {};
      const autoPopulated = realityDoc ? (realityDoc.autoPopulatedPhases || []) : [];

      if (!autoPopulated.includes(phaseToPopulate)) {
        console.log(`🤖 [AUTO-SIM] Generando resultados para la fase: ${phaseToPopulate}`);
        
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
        
        console.log(`✅ [AUTO-SIM] Resultados de ${phaseToPopulate} inyectados correctamente.`);
      }

    } catch (error) {
      console.error('❌ Error en motor de auto-simulación:', error.message);
    }
  }, 30000); // Comprobar cada 30 segundos
}


// ==========================================
// ARRANQUE Y CIERRE
// ==========================================

async function shutdown(signal) {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor...`);
  server.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log(`
╔══════════════════════════════════════╗
║     🏆 AGENTE MUNDIAL 🏆            ║
║     Porra Mundial 2026               ║
║     Chat Propio (Socket.IO)          ║
╚══════════════════════════════════════╝
`);

// Iniciar servicios
initProactiveNotifications();
initAutoSimulation();
