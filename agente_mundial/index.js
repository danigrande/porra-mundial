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
import { adminAuth } from './middleware.js';
import { Reality } from './models/Reality.js';
import { getTournamentState, getCurrentTime } from './tournamentState.js';
import { triggerAutoSimulationIfNeeded } from './autoSimulator.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET } from './shared_data.js';
import { connectDB } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import authRoutes from './routes/auth.js';
import groupsRoutes from './routes/groups.js';
import predictionsRoutes from './routes/predictions.js';
import adminRoutes from './routes/admin.js';
import feedbackRoutes from './routes/feedback.js';
import miscRoutes from './routes/misc.js';
import devDashboardRoutes from './routes/devDashboard.js';
import { initChatServer, sendBotMessage } from './chatService.js';
import { startRssService } from './rssFeedService.js';
import * as pushService from './pushService.js';
import { startRealitySync } from './realitySyncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: 'warn' });

// Asegurar carpeta de uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configurar Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/mp3', 'audio/m4a', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  },
});

// ==========================================
// SERVIDOR EXPRESS + HTTP
// ==========================================
const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === 'production' || process.env.TEST_MODE === 'false';

const allowedOrigins = isProduction
    ? ['https://porra-mundial.onrender.com', 'https://porra-mundial-frontend.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('exp://') || origin.startsWith('file://')) {
            callback(null, true);
        } else {
            callback(new Error('Origen no permitido por CORS'));
        }
    },
    credentials: true,
}));
app.use(express.json());

// Servir archivos estáticos
app.use('/uploads', express.static(uploadDir));

// Rutas públicas que responden inmediatamente (sin DB)
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

// ==========================================
// RUTAS LEGALES (Requisito App Store)
// ==========================================
const legalLayout = (title, content) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Predicción Mundial</title>
    <style>
      body { font-family: -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
      h1 { color: #1e40af; }
      h2 { color: #1e3a8a; margin-top: 30px; }
      .footer { margin-top: 50px; font-size: 0.8em; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    ${content}
    <div class="footer">
      &copy; 2026 Predicción Mundial. Esta aplicación es para fines de entretenimiento y no involucra apuestas con dinero real.
    </div>
  </body>
  </html>
`;

app.get('/legal/privacy', (req, res) => {
  const content = `
    <p>Última actualización: 12 de mayo de 2026</p>
    <h2>1. Datos que recopilamos</h2>
    <p>Recopilamos su dirección de correo electrónico únicamente para fines de autenticación y vinculación con su grupo de amigos. No compartimos estos datos con terceros.</p>
    <h2>2. Uso de la Información</h2>
    <p>Sus datos se utilizan para gestionar sus pronósticos, mostrar su posición en el ranking del grupo e interactuar en el chat del grupo.</p>
    <h2>3. Derechos del Usuario</h2>
    <p>Usted puede eliminar su cuenta y todos sus datos asociados en cualquier momento desde la sección de Perfil dentro de la aplicación.</p>
  `;
  res.send(legalLayout('Política de Privacidad', content));
});

app.get('/legal/terms', (req, res) => {
  const content = `
    <p>Última actualización: 12 de mayo de 2026</p>
    <h2>1. Naturaleza del Servicio</h2>
    <p>Predicción Mundial es una plataforma de entretenimiento para realizar pronósticos deportivos entre amigos. NO es una aplicación de apuestas y no se permite el intercambio de dinero real a través de la plataforma.</p>
    <h2>2. Comportamiento del Usuario (EULA)</h2>
    <p>No se tolerará contenido inapropiado, acoso o lenguaje ofensivo en el chat. Los usuarios pueden reportar contenido ofensivo y el equipo de moderación actuará en menos de 24 horas eliminando el contenido o bloqueando al usuario infractor.</p>
    <h2>3. Exención de Responsabilidad</h2>
    <p>Apple Inc. no es patrocinador ni está involucrado en las actividades de esta aplicación.</p>
  `;
  res.send(legalLayout('Términos de Uso (EULA)', content));
});

// Arrancar servidor ANTES de conectar DB para aceptar peticiones inmediatamente
const PORT = config.bot.port;
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP + Socket.IO en puerto ${PORT} (esperando BD...)`);
});

// ==========================================
// CONEXIÓN A MONGODB (bloqueante)
// ==========================================
await connectDB();
console.log('✅ Base de datos conectada');

// ==========================================
// MIDDLEWARE QUE DEPENDE DE DB
// ==========================================
import { dbCheck } from './routes/helpers.js';
app.use('/api', dbCheck);

// Servir dev dashboard solo en modo test/desarrollo
if (!isProduction) {
  const projectRoot = path.resolve(__dirname, '..');
  app.use('/dev-dashboard', express.static(projectRoot, {
    index: 'dev_dashboard.html',
    extensions: ['html', 'js', 'css']
  }));
}

// Endpoint de subida de archivos
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ status: 'error', message: 'El archivo excede el límite de 10 MB' });
      }
      return res.status(400).json({ status: 'error', message: err.message });
    }
    if (err) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
    if (!req.file) return res.status(400).json({ status: 'error', message: 'No se subió ningún archivo' });

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ status: 'success', data: { url: fileUrl } });
  });
});

// Usar nuestras rutas de Node.js (separadas por dominio)
app.use('/api', authRoutes);
app.use('/api', groupsRoutes);
app.use('/api', predictionsRoutes);
app.use('/api', adminRoutes);
app.use('/api', feedbackRoutes);
app.use('/api', miscRoutes);

// Rutas de desarrollo solo disponibles en modo test
if (!isProduction) {
  app.use('/api/dev', devDashboardRoutes);
}

// Endpoint para forzar un resumen (útil para testing)
app.get('/trigger-summary', adminAuth, async (req, res) => {
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
app.set('io', io);

// ==========================================
// INICIAR RSS BREAKING NEWS SERVICE
// ==========================================
startRssService(io);

// ==========================================
// RESÚMENES PROGRAMADOS
// ==========================================

// Resumen diario a las 08:45 (hora España) — Multi-grupo
schedule('45 8 * * *', async () => {
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
        const isEligible = group.predictionMode === 'B' || state.id === 'PRE_TOURNAMENT';

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
// SINCRONIZACIÓN DE RESULTADOS REALES (API-Football)
// ==========================================

async function initRealitySync() {
  console.log('📡 Iniciando sincronización de resultados reales (API-Football)...');
  await startRealitySync(io);
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
initRealitySync();
