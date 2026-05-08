// ============================================
// AGENTE MUNDIAL — Bot Principal
// ============================================
// Conecta WhatsApp (Baileys) con el motor de IA.
// Incluye servidor Express para keep-alive en Render.

import fs from 'fs';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import qrcode from 'qrcode-terminal';
import cors from 'cors';
import { schedule } from 'node-cron';
import config from './config.js';
import { processMessage, generateGroupSummary, refreshCache, identifyPlayer } from './messageHandler.js';
import { Group } from './models/Group.js';

// Logger silencioso para Baileys (demasiado verboso por defecto)
const logger = pino({ level: 'warn' });

import { connectDB } from './db.js';
import apiRoutes from './routes/api.js';
import devDashboardRoutes from './routes/devDashboard.js';

// Conectar a MongoDB
connectDB();

// ==========================================
// SERVIDOR EXPRESS (Keep-alive para Render y API Frontend)
// ==========================================
const app = express();
app.use(cors()); // Permitir llamadas desde la web
app.use(express.json()); // Permitir body en JSON para la nueva API

// Usar nuestras nuevas rutas de Node.js
app.use('/api', apiRoutes);
app.use('/dev', devDashboardRoutes);

app.get('/', (req, res) => {
  res.json({
    status: '🏆 Agente Mundial activo',
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
    
    // Si se pide un grupo específico, buscar su WhatsApp ID
    if (requestedGroup) {
      const dbGroup = await Group.findOne({ name: requestedGroup });
      const waId = dbGroup?.whatsappGroupId || (config.groups && Object.entries(config.groups).find(([id, name]) => name === requestedGroup)?.[0]);
      
      if (!waId) return res.json({ error: 'Grupo sin WhatsApp vinculado' });
      
      await refreshCache(requestedGroup);
      const summary = await generateGroupSummary(waId, true);
      
      if (summary && global.whatsappSock) {
        await global.whatsappSock.sendMessage(waId, { text: `📊 *RESUMEN FORZADO* 📊\n\n${summary}` });
        const dataFetcher = await import('./dataFetcher.js');
        await dataFetcher.saveSummary('Global', requestedGroup, summary);
      }
      return res.json({ summary });
    }
    
    // Sin grupo específico: procesar el de config.js (compatibilidad)
    const dynamicGroupId = process.env.WHATSAPP_GROUP_ID || config.bot.groupId;
    const groupName = config.groups[dynamicGroupId] || null;
    if (groupName) await refreshCache(groupName);
    const summary = await generateGroupSummary(dynamicGroupId, true);
    
    if (groupName && summary && global.whatsappSock) {
      await global.whatsappSock.sendMessage(dynamicGroupId, { text: `📊 *RESUMEN FORZADO* 📊\n\n${summary}` });
      const dataFetcher = await import('./dataFetcher.js');
      await dataFetcher.saveSummary('Global', groupName, summary);
    }
    
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NUEVO: API para la web (player_score.html)
app.get('/api/summary/:player', async (req, res) => {
  const { player } = req.params;
  const groupNameFromUrl = req.query.groupName;
  console.log(`🌐 Peticion de resumen desde la web para: ${player} en grupo: ${groupNameFromUrl}`);

  if (!groupNameFromUrl) {
    return res.status(400).json({ error: 'groupName es requerido' });
  }

  try {
    // Importar módulos necesarios
    const dataFetcher = await import('./dataFetcher.js');
    const { refreshCache } = await import('./messageHandler.js');
    const { generateResponse } = await import('./groqEngine.js');

    // Refrescar datos del grupo directamente por nombre (no por WhatsApp ID)
    await refreshCache(groupNameFromUrl);

    // Obtener datos frescos
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

app.listen(config.bot.port, () => {
  console.log(`🌐 Servidor keep-alive en puerto ${config.bot.port}`);
});

// ==========================================
// CONEXIÓN WHATSAPP (Baileys)
// ==========================================

async function startBot() {
  // ==========================================
  // GESTIÓN DE SESIÓN (Variable de Entorno o Carpeta)
  // ==========================================
  const AUTH_FOLDER = './auth_info';
  
  if (process.env.WA_SESSION_DATA) {
    console.log('📦 Cargando sesión desde variable de entorno...');
    if (!fs.existsSync(AUTH_FOLDER)) fs.mkdirSync(AUTH_FOLDER);
    const credsJson = Buffer.from(process.env.WA_SESSION_DATA, 'base64').toString('utf-8');
    fs.writeFileSync(`${AUTH_FOLDER}/creds.json`, credsJson);
  } else {
    // Si no hay variable de entorno y NO estamos registrados, limpiamos para evitar conflictos
    if (fs.existsSync(AUTH_FOLDER) && !fs.existsSync(`${AUTH_FOLDER}/creds.json`)) {
      console.log('🧹 Limpiando archivos de sesión antiguos...');
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  // Obtener la última versión de WhatsApp Web
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(` usando WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    generateHighQualityLinkPreview: false,
  });

  // ==========================================
  // CÓDIGO DE EMPAREJAMIENTO (Pairing Code)
  // ==========================================
  let isPairing = false;
  if (!sock.authState.creds.registered) {
    isPairing = true;
    const phoneNumber = process.env.BOT_PHONE || '34643429479';
    console.log(`\n🔑 Solicitando código para: ${phoneNumber}...`);
    
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('\n******************************************');
        console.log(`*  TU CÓDIGO DE WHATSAPP ES:  ${code}  *`);
        console.log('******************************************');
        console.log('⚠️  Tienes 2 minutos para meterlo en tu móvil.\n');
      } catch (error) {
        console.error('Error solicitando código:', error.message);
        isPairing = false;
      }
    }, 5000); 
  }

  // Guardar credenciales cuando se actualicen
  sock.ev.on('creds.update', saveCreds);

  // Guardar el socket globalmente para el endpoint trigger-summary
  global.whatsappSock = sock;

  // Manejar estado de conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log('❌ Error de conexión:', reason, lastDisconnect?.error?.message);

      // Si estamos en medio de un emparejamiento, NO REINICIAMOS automáticamente
      // para no invalidar el código que el usuario está escribiendo.
      if (isPairing && reason === 408) {
        console.log('⏳ Timeout de espera (408). Mantén la calma, el código sigue activo o se generará uno nuevo pronto.');
        return;
      }

      if (reason === DisconnectReason.loggedOut || reason === 440) {
        const msg = reason === 440 
          ? '❌ Conflicto de conexión: Otra instancia del bot ha iniciado sesión. Deteniendo reconexión automática para evitar bucle.'
          : '❌ Sesión cerrada. Elimina la variable WA_SESSION_DATA y vincula de nuevo.';
        console.log(msg);
      } else {
        console.log(`⚠️ Reconectando en 7s... (Razón: ${reason})`);
        setTimeout(startBot, 7000);
      }
    }

    if (connection === 'open') {
      console.log('\n✅ ¡Agente Mundial conectado a WhatsApp!\n');
      
      // Imprimir el string de la sesión para que el usuario pueda copiarlo a Render
      if (!process.env.WA_SESSION_DATA) {
        try {
          const creds = fs.readFileSync(`${AUTH_FOLDER}/creds.json`);
          const sessionString = creds.toString('base64');
          console.log('\n------------------ COPIA ESTA SESIÓN PARA RENDER ------------------');
          console.log(sessionString);
          console.log('-------------------------------------------------------------------\n');
          console.log('💡 Pega este texto largo en Render con el nombre: WA_SESSION_DATA\n');
        } catch (e) {
          console.error('Error al generar session string:', e.message);
        }
      }

      console.log(`📋 Escuchando mensajes${config.bot.groupId ? ' en grupo: ' + config.bot.groupId : ' (todos los chats)'}...`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        // Ignorar mensajes propios
        if (msg.key.fromMe) continue;

        // Extraer texto del mensaje
        const text = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.buttonsResponseMessage?.selectedButtonId
          || msg.message?.listResponseMessage?.title
          || '';

        if (!text.trim()) continue;

        const chatId = msg.key.remoteJid;
        const isGroup = chatId?.endsWith('@g.us');
        
        // --- IDENTIFICACIÓN DE MENCIONES ---
        const botId = sock.user?.id.split(':')[0];
        const botLid = sock.authState.creds.me?.lid?.split(':')[0]?.split('@')[0];
        
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isMentionedOfficial = mentionedJids.some(jid => 
          (botId && jid.includes(botId)) || (botLid && jid.includes(botLid))
        );
        
        const textLower = text.toLowerCase();
        const isMentionedText = (botId && text.includes('@' + botId)) || 
                               (botLid && text.includes('@' + botLid)) ||
                               textLower.includes('@agente') || 
                               textLower.includes('@bot');
        
        const isMentioned = isMentionedOfficial || isMentionedText;

        // --- IDENTIFICACIÓN DEL REMITENTE ---
        const rawSender = msg.key.participantAlt || msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid || '';
        const senderPhone = rawSender.split('@')[0];

        console.log(`📥 Mensaje de ${senderPhone} (Nombre: ${msg.pushName || '?'}): "${text.substring(0, 50)}"`);
        if (isMentioned) console.log('   ✅ Mención detectada');

        // --- FILTRO DE GRUPO ---
        // Aceptar mensajes de cualquier grupo registrado (config.js o MongoDB)
        // Los grupos no registrados se manejan en processMessage (devuelve mensaje de error)
        // No filtramos aquí para que processMessage pueda informar al usuario

        // Procesar el mensaje
        const response = await processMessage(text, senderPhone, isGroup, isMentioned, chatId);

        // --- SISTEMA RAG ---
        // Guardar TODOS los mensajes en la BD para contexto de la IA
        import('./ragService.js').then(rag => {
           const senderNameDB = msg.pushName || identifyPlayer(senderPhone, chatId) || senderPhone;
           rag.saveChatMessage(chatId, senderPhone, senderNameDB, text);
        }).catch(e => console.error("Error cargando RAG:", e));

        if (response) {
          console.log(`🤖 Respondiendo a ${senderPhone}: "${response.substring(0, 80)}..."`);

          // Simular "escribiendo..."
          await sock.presenceSubscribe(chatId);
          await sock.sendPresenceUpdate('composing', chatId);
          await new Promise(r => setTimeout(r, 2000));

          // Enviar respuesta
          await sock.sendMessage(chatId, { text: response });
        } else if (isGroup) {
          console.log('⏩ El bot decidió no responder (no mencionado en grupo).');
        }
      } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
      }
    }
  });

  // ==========================================
  // RESÚMENES PROGRAMADOS
  // ==========================================

  // Resumen diario a las 23:00 (hora España) — Multi-grupo
  schedule('0 23 * * *', async () => {
    console.log(`📢 Generando resúmenes programados para TODOS los grupos...`);
    try {
      // 1. Obtener todos los grupos con WhatsApp vinculado desde MongoDB
      const dbGroups = await Group.find({ whatsappGroupId: { $ne: null } });
      
      // 2. Añadir también el grupo de config.js (compatibilidad)
      const configGroupId = process.env.WHATSAPP_GROUP_ID || config.bot.groupId;
      const allGroups = [];
      
      if (configGroupId && config.groups[configGroupId]) {
        allGroups.push({ whatsappGroupId: configGroupId, name: config.groups[configGroupId] });
      }
      dbGroups.forEach(g => {
        // Evitar duplicados si el grupo de config también está en la BD
        if (!allGroups.find(ag => ag.whatsappGroupId === g.whatsappGroupId)) {
          allGroups.push({ whatsappGroupId: g.whatsappGroupId, name: g.name });
        }
      });

      if (allGroups.length === 0) {
        console.log('⚠️ No hay grupos con WhatsApp vinculado. Saltando resúmenes.');
        return;
      }

      console.log(`📋 Grupos a procesar: ${allGroups.map(g => g.name).join(', ')}`);

      for (const group of allGroups) {
        try {
          console.log(`\n📢 Procesando grupo: ${group.name} (${group.whatsappGroupId})`);
          await refreshCache(group.name);
          
          const summary = await generateGroupSummary(group.whatsappGroupId);
          console.log(`📝 Resumen generado (longitud: ${summary?.length || 0})`);
     
          if (summary && summary.length > 50) {
            await sock.sendMessage(group.whatsappGroupId, {
              text: `📊 *RESUMEN DE LA JORNADA* 📊\n\n${summary}`,
            });
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

  return sock;
}

// ==========================================
// ARRANQUE
// ==========================================

console.log(`
╔══════════════════════════════════════╗
║     🏆 AGENTE MUNDIAL 🏆            ║
║     Porra Mundial 2026               ║
║     Bot de WhatsApp                  ║
╚══════════════════════════════════════╝
`);

startBot().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
