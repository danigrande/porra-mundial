// ============================================
// AGENTE MUNDIAL — Bot Principal
// ============================================
// Conecta WhatsApp (Baileys) con el motor de IA.
// Incluye servidor Express para keep-alive en Render.

import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import { schedule } from 'node-cron';
import config from './config.js';
import { processMessage, generateGroupSummary, forceRefresh } from './messageHandler.js';

// Logger silencioso para Baileys (demasiado verboso por defecto)
const logger = pino({ level: 'warn' });

// Store en memoria para manejar reintentos de mensajes
const store = makeInMemoryStore({ logger });

// ==========================================
// SERVIDOR EXPRESS (Keep-alive para Render)
// ==========================================
const app = express();

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

app.listen(config.bot.port, () => {
  console.log(`🌐 Servidor keep-alive en puerto ${config.bot.port}`);
});

// ==========================================
// CONEXIÓN WHATSAPP (Baileys)
// ==========================================

async function startBot() {
  // Autenticación persistente (se guarda en ./auth_info)
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true, // Muestra QR en la consola para escanear
    browser: ['Agente Mundial', 'Chrome', '120.0.0'],
    // Generar link de pairing si no hay QR disponible
    // (útil para Render donde no ves la consola)
    generateHighQualityLinkPreview: false,
  });

  // Guardar credenciales cuando se actualicen
  sock.ev.on('creds.update', saveCreds);

  // Manejar estado de conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escanea este QR con WhatsApp:');
      console.log('   (Abre WhatsApp > Ajustes > Dispositivos vinculados > Vincular dispositivo)\n');
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Sesión cerrada. Elimina ./auth_info y escanea QR de nuevo.');
      } else {
        console.log(`⚠️ Conexión perdida (razón: ${reason}). Reconectando en 5s...`);
        setTimeout(startBot, 5000);
      }
    }

    if (connection === 'open') {
      console.log('\n✅ ¡Agente Mundial conectado a WhatsApp!\n');
      console.log(`📋 Escuchando mensajes${config.bot.groupId ? ' en grupo: ' + config.bot.groupId : ' (todos los chats)'}...`);
    }
  });

  // ==========================================
  // LISTENER DE MENSAJES
  // ==========================================

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return; // Solo mensajes nuevos

    for (const msg of messages) {
      try {
        // Ignorar mensajes propios
        if (msg.key.fromMe) continue;

        // Extraer texto del mensaje
        const text = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || '';

        if (!text.trim()) continue; // Ignorar mensajes sin texto

        // Determinar si es grupo o chat privado
        const isGroup = msg.key.remoteJid?.endsWith('@g.us');
        const chatId = msg.key.remoteJid;

        // Si hay un grupo configurado, solo responder en ese grupo
        if (config.bot.groupId && isGroup && chatId !== config.bot.groupId) {
          continue;
        }

        // Extraer número del remitente
        const senderPhone = isGroup
          ? msg.key.participant || ''
          : msg.key.remoteJid || '';

        // Comprobar si el bot fue mencionado
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isMentioned = mentionedJids.some(jid => jid === sock.user?.id);

        // Procesar el mensaje
        const response = await processMessage(text, senderPhone, isGroup, isMentioned);

        if (response) {
          console.log(`💬 ${senderPhone.split('@')[0]}: "${text.substring(0, 50)}..."`);
          console.log(`🤖 Respondiendo: "${response.substring(0, 80)}..."`);

          // Simular "escribiendo..." para parecer más natural
          await sock.presenceSubscribe(chatId);
          await sock.sendPresenceUpdate('composing', chatId);

          // Esperar un poco (más natural, menos riesgo)
          const typingDelay = Math.min(response.length * 30, 3000);
          await new Promise(r => setTimeout(r, typingDelay));

          // Enviar respuesta
          await sock.sendMessage(chatId, { text: response });
        }
      } catch (error) {
        console.error('Error procesando mensaje:', error.message);
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
