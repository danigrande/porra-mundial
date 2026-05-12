// ============================================
// CHAT SERVICE — Socket.IO Real-Time Chat
// ============================================
// Servidor de chat propio basado en Socket.IO
// Maneja la comunicación en tiempo real entre los usuarios y el Agente Mundial.

import { Server } from 'socket.io';
import { User } from './models/User.js';
import { Group } from './models/Group.js';
import { Message } from './models/Message.js';
import { BlockedUser } from './models/BlockedUser.js';
import { processMessage, refreshCache, identifyPlayer } from './messageHandler.js';
import * as pushService from './pushService.js';

let io = null;

// Lista básica de palabras prohibidas (Automatización de Moderación - Guideline 1.2)
const PROFANITY_LIST = ['puto', 'puta', 'mierda', 'cabron', 'cabrón', 'maricon', 'maricón', 'zorra', 'joder']; 

function containsProfanity(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return PROFANITY_LIST.some(word => lower.includes(word));
}

/**
 * Inicializa el servidor Socket.IO sobre el servidor HTTP de Express.
 * @param {import('http').Server} httpServer - Servidor HTTP de Express
 */
export function initChatServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // En producción, restringir a tu dominio
      methods: ['GET', 'POST']
    },
    // Buffer de mensajes para reconexiones
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutos
    }
  });

  console.log('💬 Servidor de chat Socket.IO inicializado');

  // ==========================================
  // MIDDLEWARE DE AUTENTICACIÓN
  // ==========================================
  io.use(async (socket, next) => {
    try {
      const { phone, pin, groupName } = socket.handshake.auth;
      
      if (!phone || !pin) {
        return next(new Error('Credenciales requeridas (phone + pin)'));
      }

      // Verificar usuario
      const user = await User.findOne({ phone, pin });
      if (!user) {
        return next(new Error('Credenciales inválidas'));
      }

      // Guardar datos del usuario en el socket para uso posterior
      socket.userData = {
        userId: user._id.toString(),
        userName: user.name,
        phone: user.phone,
        groups: user.groups || []
      };

      next();
    } catch (error) {
      console.error('[Chat] Error en autenticación:', error.message);
      next(new Error('Error de autenticación'));
    }
  });

  // ==========================================
  // MANEJO DE CONEXIONES
  // ==========================================
  io.on('connection', (socket) => {
    if (!socket.userData) {
      console.warn('⚠️ Conexión rechazada: userData indefinido');
      socket.disconnect(true);
      return;
    }

    const { userName, userId, groups } = socket.userData;
    console.log(`💬 ${userName} conectado al chat (${groups?.length || 0} grupos)`);

    // Unir automáticamente a las salas de sus grupos
    for (const groupName of groups) {
      socket.join(`group:${groupName}`);
    }

    // --- UNIRSE A UN GRUPO ESPECÍFICO ---
    socket.on('join-group', async (groupName) => {
      if (!socket.userData.groups.includes(groupName)) {
        socket.emit('error', { message: 'No eres miembro de este grupo' });
        return;
      }
      socket.join(`group:${groupName}`);
      console.log(`📥 ${userName} se unió a la sala: ${groupName}`);

      // Enviar historial de mensajes recientes
      try {
        const messages = await Message.find({ chatId: groupName })
          .sort({ timestamp: -1 })
          .limit(50)
          .lean();
        
        // Obtener lista de usuarios que el usuario ha bloqueado
        const blockedByMe = await BlockedUser.find({ blockerPhone: phone }).lean();
        const blockedPhones = blockedByMe.map(b => b.blockedPhone);

        // Filtrar mensajes de usuarios bloqueados
        const filteredMessages = messages
          .filter(m => !blockedPhones.includes(m.senderId))
          .reverse(); // Orden cronológico
        
        socket.emit('chat-history', {
          groupName,
          messages: filteredMessages
        });
      } catch (e) {
        console.error('[Chat] Error cargando historial:', e.message);
      }
    });

    // --- ENVIAR MENSAJE ---
    socket.on('send-message', async (data) => {
      const { groupName, text, type = 'text', mediaUrl } = data;
      
      if (!groupName) return;
      if (type === 'text' && (!text || !text.trim())) return;

      // --- FILTRO AUTOMÁTICO (Apple Requirement) ---
      if (type === 'text' && containsProfanity(text)) {
          console.warn(`[Chat] 🚫 Mensaje bloqueado por filtro: "${text}"`);
          socket.emit('error', { message: 'Tu mensaje ha sido bloqueado por contener lenguaje inapropiado.' });
          return;
      }

      const { userName, userId, phone } = socket.userData;

      try {
        // 1. Guardar mensaje del usuario en MongoDB
        const userMessage = await Message.create({
          chatId: groupName,
          senderId: phone,
          senderName: userName,
          text: text?.trim(),
          type,
          mediaUrl,
          isBot: false
        });

        // 2. Emitir a todos los miembros del grupo (excepto a quienes hayan bloqueado al remitente)
        const messagePayload = {
          _id: userMessage._id.toString(),
          chatId: groupName,
          senderName: userName,
          senderId: phone,
          text: text?.trim(),
          type,
          mediaUrl,
          isBot: false,
          timestamp: userMessage.timestamp
        };

        // En lugar de broadcast simple, filtramos destinatarios
        const socketsInRoom = await io.in(`group:${groupName}`).fetchSockets();
        for (const s of socketsInRoom) {
            // No enviar si el destinatario ha bloqueado al remitente
            // Nota: Para optimizar, podríamos cachear los bloqueos en el socket
            const isBlocked = await BlockedUser.findOne({ blockerPhone: s.userData.phone, blockedPhone: phone });
            if (!isBlocked) {
                s.emit('new-message', messagePayload);
            }
        }
        
        // 3. Notificación Push a los miembros desconectados
        pushService.sendToGroup(
          groupName,
          userName, // Título: nombre de quien escribe
          text?.trim() || '📸 Imagen/Media',
          { screen: 'chat', groupName },
          userId // Excluir al que envía el mensaje
        );

        // 4. Detectar si el mensaje va dirigido al bot
        const textLower = text.toLowerCase();
        const isBotMention = textLower.includes('@agente') || 
                            textLower.includes('@bot') ||
                            textLower.startsWith('agente') ||
                            textLower.startsWith('bot ');

        // En grupos: solo responder si se menciona al bot
        // En chat directo (futuro): siempre responder
        if (isBotMention) {
          // Emitir indicador de "escribiendo..."
          io.to(`group:${groupName}`).emit('bot-typing', { groupName });

          // 4. Procesar con el motor de IA (reutiliza messageHandler existente)
          const cleanText = text
            .replace(/@agente/gi, '')
            .replace(/@bot/gi, '')
            .trim();
          
          const botResponse = await processMessage(
            cleanText, 
            phone,
            groupName
          );

          if (botResponse) {
            // Pequeño delay para simular "pensando"
            await new Promise(r => setTimeout(r, 1500));

            // 5. Guardar respuesta del bot
            const botMessage = await Message.create({
              chatId: groupName,
              senderId: 'agente-mundial',
              senderName: 'Agente Mundial 🏆',
              text: botResponse,
              type: 'text',
              isBot: true
            });

            const botPayload = {
              _id: botMessage._id.toString(),
              chatId: groupName,
              senderName: 'Agente Mundial 🏆',
              senderId: 'agente-mundial',
              text: botResponse,
              type: 'text',
              isBot: true,
              timestamp: botMessage.timestamp
            };

            // 6. Emitir respuesta del bot a todos
            io.to(`group:${groupName}`).emit('new-message', botPayload);
            io.to(`group:${groupName}`).emit('bot-stopped-typing', { groupName });

            // 7. Push notification a los que no están conectados
            pushService.sendToGroup(
              groupName,
              'Agente Mundial 🏆',
              botResponse.substring(0, 100) + (botResponse.length > 100 ? '...' : ''),
              { screen: 'chat', groupName },
              userId // Excluir al remitente
            );
          }
        }

        // 8. Guardar embedding para RAG (fire-and-forget)
        import('./ragService.js').then(rag => {
          rag.vectorizeMessage(userMessage._id, text.trim());
        }).catch(e => console.error('[Chat] Error RAG:', e.message));

      } catch (error) {
        console.error('[Chat] Error procesando mensaje:', error);
        socket.emit('error', { message: 'Error al enviar mensaje' });
      }
    });

    // --- CARGAR MÁS HISTORIAL ---
    socket.on('load-more', async (data) => {
      const { groupName, beforeTimestamp } = data;
      try {
        const messages = await Message.find({
          chatId: groupName,
          timestamp: { $lt: new Date(beforeTimestamp) }
        })
          .sort({ timestamp: -1 })
          .limit(30)
          .lean();

        socket.emit('more-messages', {
          groupName,
          messages: messages.reverse()
        });
      } catch (e) {
        console.error('[Chat] Error cargando más mensajes:', e.message);
      }
    });

    // --- INDICADOR DE "ESCRIBIENDO" ---
    socket.on('typing', (data) => {
      const { groupName } = data;
      socket.to(`group:${groupName}`).emit('user-typing', {
        groupName,
        userName: socket.userData.userName
      });
    });

    socket.on('stop-typing', (data) => {
      const { groupName } = data;
      socket.to(`group:${groupName}`).emit('user-stopped-typing', {
        groupName,
        userName: socket.userData.userName
      });
    });

    // --- DESCONEXIÓN ---
    socket.on('disconnect', (reason) => {
      console.log(`👋 ${userName} desconectado (${reason})`);
    });
  });

  return io;
}

/**
 * Obtiene la instancia de Socket.IO (para enviar mensajes desde otros módulos).
 */
export function getIO() {
  return io;
}

/**
 * Envía un mensaje del bot a un grupo específico (para resúmenes programados, notificaciones, etc.)
 * @param {string} groupName - Nombre del grupo
 * @param {string} text - Texto del mensaje
 */
export async function sendBotMessage(groupName, text) {
  if (!io) {
    console.warn('[Chat] Socket.IO no inicializado, no se puede enviar mensaje');
    return;
  }

  try {
    // Guardar en BD
    const botMessage = await Message.create({
      chatId: groupName,
      senderId: 'agente-mundial',
      senderName: 'Agente Mundial 🏆',
      text,
      isBot: true
    });

    // Emitir a la sala del grupo
    io.to(`group:${groupName}`).emit('new-message', {
      _id: botMessage._id.toString(),
      chatId: groupName,
      senderName: 'Agente Mundial 🏆',
      senderId: 'agente-mundial',
      text,
      isBot: true,
      timestamp: botMessage.timestamp
    });

    // Push notification a todos los miembros
    pushService.sendToGroup(
      groupName,
      'Agente Mundial 🏆',
      text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      { screen: 'chat', groupName }
    );

    console.log(`[Chat] Mensaje del bot enviado a ${groupName}`);
  } catch (error) {
    console.error('[Chat] Error enviando mensaje del bot:', error.message);
  }
}
