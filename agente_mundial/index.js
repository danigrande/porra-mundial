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
import { processMessage, generateGroupSummary, forceRefresh, getBotConfig } from './messageHandler.js';

// Logger silencioso para Baileys (demasiado verboso por defecto)
const logger = pino({ level: 'warn' });

// ==========================================
// SERVIDOR EXPRESS (Keep-alive para Render)
// ==========================================
const app = express();
app.use(cors()); // Permitir llamadas desde la web

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
    const dynamicGroupId = getBotConfig().WHATSAPP_GROUP_ID || config.bot.groupId;
    const summary = await generateGroupSummary(dynamicGroupId);
    
    // Guardar también el resumen global
    const groupName = config.groups[dynamicGroupId] || null;
    if (groupName && summary) {
      const dataFetcher = await import('./dataFetcher.js');
      await dataFetcher.saveSummary("Global", groupName, summary);
    }
    
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NUEVO: API para la web (player_score.html)
app.get('/api/summary/:player', async (req, res) => {
  const { player } = req.params;
  const groupName = req.query.groupName; // Obtenemos el grupo desde la query url
  console.log(`🌐 Petición de resumen desde la web para: ${player} en grupo: ${groupName}`);
  try {
    // Forzamos un refresco de datos antes de generar el resumen
    await forceRefresh();
    // Reutilizamos la lógica del messageHandler
    const response = await processMessage(`resumen`, player, true, true, groupName);
    
    // Guardar el resumen en Google Sheets
    if (groupName && response) {
      console.log(`💾 Guardando resumen para ${player} en Google Sheets...`);
      // Import dynamic dataFetcher to save
      const dataFetcher = await import('./dataFetcher.js');
      await dataFetcher.saveSummary(player, groupName, response);
    }

    res.json({ summary: response });
  } catch (error) {
    console.error('Error en API summary:', error);
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

      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Sesión cerrada. Elimina la variable WA_SESSION_DATA y el código QR de nuevo.');
      } else {
        console.log(`⚠️ Reconectando en 7s...`);
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
        // Priorizar el ID de grupo del Excel, si no existe usar el del .env
        const dynamicGroupId = getBotConfig().WHATSAPP_GROUP_ID || config.bot.groupId;
        
        // Si hay un grupo configurado, solo responder en ese grupo (si el mensaje viene de un grupo)
        if (dynamicGroupId && isGroup && chatId !== dynamicGroupId) {
          console.log(`⏩ Mensaje de otro grupo ignorado (ID: ${chatId})`);
          continue;
        }

        // Procesar el mensaje
        const response = await processMessage(text, senderPhone, isGroup, isMentioned);

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

  // Resumen diario a las 23:00 (hora España)
  // Cron: "0 23 * * *" = a las 23:00 cada día
  // NOTA: El timezone depende del servidor. En Render (UTC), sería "0 21 * * *" para España (UTC+2)
  // Resumen diario a las 23:00 (hora España)
  schedule('0 21 * * *', async () => {
    const dynamicGroupId = getBotConfig().WHATSAPP_GROUP_ID || config.bot.groupId;
    if (!dynamicGroupId) return;

    console.log(`📢 Generando resumen programado para el grupo: ${dynamicGroupId}`);
    try {
      await forceRefresh();
      const summary = await generateGroupSummary(dynamicGroupId);

      if (summary) {
        await sock.sendMessage(dynamicGroupId, {
          text: `📊 *RESUMEN DE LA JORNADA* 📊\n\n${summary}`,
        });
        console.log('✅ Resumen publicado en el grupo');
        
        // Guardar el resumen global en la base de datos
        const groupName = config.groups[dynamicGroupId] || null;
        if (groupName) {
          const dataFetcher = await import('./dataFetcher.js');
          await dataFetcher.saveSummary("Global", groupName, summary);
        }
      }
    } catch (error) {
      console.error('Error publicando resumen:', error.message);
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
