// ============================================
// CHAT SERVICE — Socket.IO Real-Time Chat
// ============================================
// Servidor de chat propio basado en Socket.IO
// Maneja la comunicación en tiempo real entre los usuarios y el Agente Mundial.

import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import { User } from './models/User.js';
import { Group } from './models/Group.js';
import { Message } from './models/Message.js';
import { BlockedUser } from './models/BlockedUser.js';
import { processMessage, refreshCache, identifyPlayer, storeLastBotResponse, storeConversationExchange } from './messageHandler.js';
import { vectorizeMessage } from './ragService.js';
import * as pushService from './pushService.js';

let io = null;

// Throttle de eventos de escritura: evitar que el cliente reciba ~10 eventos/segundo
const typingThrottle = new Map();

// Lista básica de palabras prohibidas (Automatización de Moderación - Guideline 1.2)

/**
 * Inicializa el servidor Socket.IO sobre el servidor HTTP de Express.
 * @param {import('http').Server} httpServer - Servidor HTTP de Express
 */
export function initChatServer(httpServer) {
  const allowedOrigins = [
    'https://porra-mundial.onrender.com',
    'https://porra-mundial-frontend.onrender.com',
    'https://porra-mundial-six.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
  ];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('exp://') || origin.startsWith('file://')) {
          callback(null, true);
        } else {
          callback(new Error('Origen no permitido por CORS'));
        }
      },
      methods: ['GET', 'POST']
    },
    // Aumentados para móvil: evitar ping timeout cuando la app va al background
    pingInterval: 60000,   // 60s — menos frecuente para móvil
    pingTimeout: 40000,    // 40s — más tiempo para responder en background
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
      const { email, password } = socket.handshake.auth;
      
      if (!email || !password) {
        return next(new Error('Credenciales requeridas (email + password)'));
      }

      // Verificar usuario
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return next(new Error('Credenciales inválidas'));
      }

      // Verificar contraseña
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return next(new Error('Credenciales inválidas'));
      }

      // Guardar datos del usuario en el socket para uso posterior
      socket.data.user = {
        userId: user._id.toString(),
        userName: user.name,
        email: user.email,
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
    if (!socket.data.user) {
      console.warn(`⚠️ Conexión rechazada: data.user indefinido (socketId: ${socket.id})`);
      socket.disconnect(true);
      return;
    }

    const { userName, userId, groups } = socket.data.user;
    console.log(`💬 ${userName} conectado al chat (${groups?.length || 0} grupos)`);

    // Unir automáticamente a las salas de sus grupos
    for (const groupName of groups) {
      socket.join(`group:${groupName}`);
    }

    // --- UNIRSE A UN GRUPO ESPECÍFICO ---
    socket.on('join-group', async (groupName) => {
      const { userName, userId, groups } = socket.data.user;
      if (!groups.includes(groupName)) {
        socket.emit('error', { message: 'No eres miembro de este grupo' });
        return;
      }
      socket.join(`group:${groupName}`);
      console.log(`📥 ${userName} se unió a la sala: ${groupName}`);

      // Enviar historial de mensajes recientes
      try {
        const [messages, blockedByMe] = await Promise.all([
          Message.find({ chatId: groupName })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean(),
          BlockedUser.find({ blockerId: userId }).lean()
        ]);
        const blockedIds = blockedByMe.map(b => b.blockedId);

        // Filtrar mensajes de usuarios bloqueados
        const filteredMessages = messages
          .filter(m => !blockedIds.includes(m.senderId))
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
      const { groupName, text, type = 'text', mediaUrl, replyTo } = data;
      
      if (!groupName) return;
      if (type === 'text' && (!text || !text.trim())) return;

      const { userName, userId, email } = socket.data.user;
      const cleanGroupName = groupName.trim();

      try {
        // Cache refresh en background — no bloqueamos el envío del mensaje
        refreshCache(cleanGroupName).catch(e => console.error('[Chat] Error refreshCache:', e.message));
        const identifiedName = identifyPlayer(userId, cleanGroupName);
        const senderNameForDb = identifiedName || userName;

        // 1. Guardar mensaje del usuario en MongoDB
        const userMessage = await Message.create({
          chatId: cleanGroupName,
          senderId: userId,
          senderName: senderNameForDb,
          text: text?.trim(),
          type,
          mediaUrl,
          isBot: false,
          replyTo: replyTo || null,
        });

        // 1.1 Vectorizar mensaje para el RAG
        vectorizeMessage(userMessage._id, text?.trim());

        // 2. Emitir a todos los miembros del grupo (excepto a quienes hayan bloqueado al remitente)
        const messagePayload = {
          _id: userMessage._id.toString(),
          chatId: cleanGroupName,
          senderName: senderNameForDb,
          senderId: userId,
          text: text?.trim(),
          type,
          mediaUrl,
          isBot: false,
          replyTo: replyTo || null,
          timestamp: userMessage.timestamp
        };

        // En lugar de broadcast simple, filtramos destinatarios con una sola query
        const socketsInRoom = await io.in(`group:${groupName}`).fetchSockets();
        const roomUserIds = socketsInRoom.map(s => s.data.user.userId);
        const blockedEntries = await BlockedUser.find({ blockerId: { $in: roomUserIds }, blockedId: userId }).select('blockerId').lean();
        const blockedSet = new Set(blockedEntries.map(b => b.blockerId));
        for (const s of socketsInRoom) {
            if (!blockedSet.has(s.data.user.userId)) {
                s.emit('new-message', messagePayload);
            }
        }
        
        // 3. Notificación Push a los miembros desconectados
        const pushText = type === 'sticker' ? '🏷️ Sticker'
          : type === 'gif' ? '🎉 GIF'
          : type === 'image' ? '📸 Imagen'
          : type === 'audio' ? '🎤 Nota de voz'
          : text?.trim();
        pushService.sendToGroup(
          groupName,
          userName,
          pushText || '📎 Media',
          { screen: 'chat', groupName },
          userId,
          false // no es el agente
        );

        // 4. Detectar si el mensaje va dirigido al bot (solo para mensajes de texto)
        if (type !== 'text' || !text) {
          return; // Los stickers, gifs, imágenes y audios no se pasan al bot
        }

        const textLower = text.toLowerCase();
        const isBotMention = textLower.includes('@agente') || 
                            textLower.includes('@bot') ||
                            textLower.startsWith('agente') ||
                            textLower.startsWith('bot ');

        // En grupos: solo responder si se menciona al bot
        if (isBotMention) {
          // Emitir indicador de "escribiendo..."
          io.to(`group:${groupName}`).emit('bot-typing', { groupName });

          // 4. Procesar con el motor de IA (reutiliza messageHandler existente)
          const cleanText = text
            .replace(/@agente/gi, '')
            .replace(/@bot/gi, '')
            .trim();
          
          const botResult = await processMessage(
            cleanText, 
            userId,
            groupName
          );

          if (botResult) {
            // Pequeño delay para simular "pensando"
            await new Promise(r => setTimeout(r, 500));

            const botText = botResult.response;
            const ailogId = botResult.ailogId || null;

            // 4.1 Guardar en memoria para detección de correcciones
            storeLastBotResponse(userId, groupName, botText, {
              personalityId: botResult.personalityId,
              targetLanguage: botResult.targetLanguage,
              judgeScores: botResult.judgeScores,
              ailogId
            });

            // 4.2 Guardar intercambio en el buffer de conversación
            storeConversationExchange(userId, groupName, cleanText, botText);

            // 5. Guardar respuesta del bot
            const botMessage = await Message.create({
              chatId: groupName,
              senderId: 'agente-mundial',
              senderName: 'Agente Mundial 🏆',
              text: botText,
              type: 'text',
              isBot: true,
              aiLogId: ailogId
            });

            // 5.1 Vectorizar respuesta del bot para el RAG — solo si pasó quality gate
            if (!botResult.forceApproved) {
              vectorizeMessage(botMessage._id, botText);
            }

            const botPayload = {
              _id: botMessage._id.toString(),
              chatId: groupName,
              senderName: 'Agente Mundial 🏆',
              senderId: 'agente-mundial',
              text: botText,
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
              botText.substring(0, 100) + (botText.length > 100 ? '...' : ''),
              { screen: 'chat', groupName },
              userId,
              true // es el agente
            );
          }
        }

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
          messages: messages.reverse(),
          hasMore: messages.length === 30
        });
      } catch (e) {
        console.error('[Chat] Error cargando más mensajes:', e.message);
      }
    });

    // --- INDICADOR DE "ESCRIBIENDO" (con throttling) ---
    socket.on('typing', (data) => {
      const { groupName } = data;
      const userId = socket.data.user.userId;
      const now = Date.now();
      const last = typingThrottle.get(userId) || 0;
      // Emitir como máximo una vez por segundo
      if (now - last < 1000) return;
      typingThrottle.set(userId, now);

      socket.to(`group:${groupName}`).emit('user-typing', {
        groupName,
        userName: socket.data.user.userName
      });
    });

    socket.on('stop-typing', (data) => {
      const { groupName } = data;
      typingThrottle.delete(socket.data.user.userId);
      socket.to(`group:${groupName}`).emit('user-stopped-typing', {
        groupName,
        userName: socket.data.user.userName
      });
    });

    // --- REACCIONAR A MENSAJE ---
    socket.on('react-message', async (data) => {
      const { messageId, emoji, add } = data;
      if (!messageId || !emoji) return;
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const reactions = message.reactions || {};
        const users = reactions[emoji] || [];
        if (add) {
          if (!users.includes(userId)) {
            reactions[emoji] = [...users, userId];
          }
        } else {
          reactions[emoji] = users.filter(id => id !== userId);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        }
        message.reactions = reactions;
        await message.save();

        io.to(`group:${message.chatId}`).emit('message-reacted', {
          messageId,
          reactions: Object.fromEntries(message.reactions),
        });
      } catch (e) {
        console.error('[Chat] Error en react-message:', e.message);
      }
    });

    // --- EDITAR MENSAJE ---
    socket.on('edit-message', async (data) => {
      const { messageId, newText, groupName } = data;
      if (!messageId || !newText?.trim()) return;
      try {
        const message = await Message.findById(messageId);
        if (!message) return;
        if (message.senderId !== userId) return;
        if (Date.now() - new Date(message.timestamp).getTime() > 60 * 60 * 1000) {
          socket.emit('error', { message: 'Ya no puedes editar este mensaje (más de 1 hora)' });
          return;
        }
        message.text = newText.trim();
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        io.to(`group:${groupName}`).emit('message-edited', {
          messageId,
          newText: message.text,
          edited: true,
          editedAt: message.editedAt,
        });
      } catch (e) {
        console.error('[Chat] Error en edit-message:', e.message);
      }
    });

    // --- ELIMINAR MENSAJE ---
    socket.on('delete-message', async (data) => {
      const { messageId, deleteFor, groupName } = data;
      if (!messageId || !deleteFor) return;
      try {
        if (deleteFor === 'everyone') {
          const message = await Message.findById(messageId);
          if (!message) return;
          if (message.senderId !== userId) return;
          await Message.findByIdAndDelete(messageId);
          io.to(`group:${groupName}`).emit('message-deleted', { messageId, deleteFor: 'everyone' });
        } else if (deleteFor === 'me') {
          const message = await Message.findById(messageId);
          if (!message) return;
          if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
            await message.save();
          }
          socket.emit('message-deleted', { messageId, deleteFor: 'me', userId });
        }
      } catch (e) {
        console.error('[Chat] Error en delete-message:', e.message);
      }
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
export async function sendBotMessage(groupName, text, skipPush = false) {
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

    // Push notification a todos los miembros (se puede saltar si el caller ya lo maneja)
    if (!skipPush) {
      pushService.sendToGroup(
        groupName,
        'Agente Mundial 🏆',
        text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        { screen: 'chat', groupName },
        null,
        true // es el agente
      );
    }

    console.log(`[Chat] Mensaje del bot enviado a ${groupName}`);
  } catch (error) {
    console.error('[Chat] Error enviando mensaje del bot:', error.message);
  }
}
