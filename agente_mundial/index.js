// ============================================
// AGENTE MUNDIAL — Bot Principal
// ============================================
// Conecta WhatsApp (Baileys) con el motor de IA.
// Incluye servidor Express para keep-alive en Render.

import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import qrcode from 'qrcode-terminal';
import cors from 'cors';
import { schedule } from 'node-cron';
import config from './config.js';
import { processMessage, generateGroupSummary, forceRefresh } from './messageHandler.js';

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
    const summary = await generateGroupSummary();
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NUEVO: API para la web (player_score.html)
app.get('/api/summary/:player', async (req, res) => {
  const { player } = req.params;
  console.log(`🌐 Petición de resumen desde la web para: ${player}`);
  try {
    // Forzamos un refresco de datos antes de generar el resumen
    await forceRefresh();
    // Reutilizamos la lógica del messageHandler
    const response = await processMessage(`resumen`, player, false, true);
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
  // Autenticación persistente (se guarda en ./auth_info)
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  // Obtener la última versión de WhatsApp Web
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(` usando WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    generateHighQualityLinkPreview: false,
  });

  // ==========================================
  // CÓDIGO DE EMPAREJAMIENTO (Pairing Code)
  // ==========================================
  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.BOT_PHONE || '34643429479';
    console.log(`\n🔑 Solicitando código de emparejamiento para: ${phoneNumber}...`);
    
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('\n******************************************');
        console.log(`*  TU CÓDIGO DE WHATSAPP ES:  ${code}  *`);
        console.log('******************************************\n');
      } catch (error) {
        console.error('Error solicitando código:', error.message);
      }
    }, 5000); // 5 segundos para asegurar que el socket está listo
  }

  // Guardar credenciales cuando se actualicen
  sock.ev.on('creds.update', saveCreds);

  // Manejar estado de conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log('❌ Error de conexión:', reason, lastDisconnect?.error?.message);

      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Sesión cerrada. Elimina ./auth_info y escanea QR de nuevo.');
      } else {
        console.log(`⚠️ Reconectando en 5s...`);
        setTimeout(startBot, 5000);
      }
    }

    if (connection === 'open') {
      console.log('\n✅ ¡Agente Mundial conectado a WhatsApp!\n');
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

        const chatId = msg.key.remoteJid;
        console.log(`📍 Chat ID detectado: ${chatId}`);
        
        // En grupos, el emisor real suele estar en participant o participantAlt
        const rawSender = msg.key.participantAlt || msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid || '';
        const senderPhone = rawSender.split('@')[0];

        console.log(`📥 Mensaje de ${senderPhone} (Nombre: ${msg.pushName || '?'}): "${text.substring(0, 50)}"`);
        console.log(`   Tipo: ${chatId.endsWith('@g.us') ? 'Grupo' : 'Privado'}`);

        if (!text.trim()) {
          console.log('⏩ Mensaje vacío o no es texto, ignorando.');
          continue;
        }

        // Determinar si es grupo o chat privado
        const isGroup = chatId?.endsWith('@g.us');

        // Si hay un grupo configurado, solo responder en ese grupo
        if (config.bot.groupId && isGroup && chatId !== config.bot.groupId) {
          console.log(`⏩ Mensaje de grupo ignorado (ID: ${chatId})`);
          continue;
        }

        // Comprobar si el bot fue mencionado (oficialmente o por texto)
        const botId = sock.user?.id.split(':')[0];
        const botLid = sock.authState.creds.me?.lid?.split(':')[0]?.split('@')[0];
        console.log(`🔍 DEBUG MENCIONES: Bot ID=${botId}, Bot LID=${botLid}, Texto="${text}"`);
        
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        // Es mencionado si su ID o su LID están en la lista de menciones oficiales
        const isMentionedOfficial = mentionedJids.some(jid => 
          (botId && jid.includes(botId)) || (botLid && jid.includes(botLid))
        );
        
        // O si el texto contiene @ seguido de cualquiera de sus IDs o palabras clave
        const textLower = text.toLowerCase();
        const isMentionedText = (botId && text.includes('@' + botId)) || 
                               (botLid && text.includes('@' + botLid)) ||
                               textLower.includes('@agente') || 
                               textLower.includes('@bot');
        
        const isMentioned = isMentionedOfficial || isMentionedText;
        if (isMentioned) console.log('✅ ¡Mención detectada!');

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
        } else {
          console.log('⏩ El bot decidió no responder (no activado por trigger word).');
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
  if (config.bot.groupId) {
    schedule('0 21 * * *', async () => {
      console.log('📢 Generando resumen programado de la jornada...');
      try {
        await forceRefresh();
        const summary = await generateGroupSummary();

        if (summary) {
          await sock.sendMessage(config.bot.groupId, {
            text: `📊 *RESUMEN DE LA JORNADA* 📊\n\n${summary}`,
          });
          console.log('✅ Resumen publicado en el grupo');
        }
      } catch (error) {
        console.error('Error publicando resumen:', error.message);
      }
    }, {
      timezone: 'Europe/Madrid',
    });

    console.log('⏰ Resumen programado: todos los días a las 23:00 (Madrid)');
  }

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
