// ============================================
// SOCKET SERVICE — Conexión en tiempo real
// ============================================

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, API_URL } from './api';
import { AppState } from 'react-native';
import * as chatStore from '../stores/chatStore';
import { getAuth } from '../stores/authStore';

let socket: Socket | null = null;

// Grupo activo al que hay que re-unirse tras reconexión
let currentGroup: string | null = null;

// Keep-alive para evitar que Render duerma el servidor
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
const KEEP_ALIVE_INTERVAL = 4 * 60 * 1000; // cada 4 minutos

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(async () => {
    try {
      await fetch(`${API_URL}/health`, { method: 'GET' });
    } catch {
      // Silencioso — no importa si falla
    }
  }, KEEP_ALIVE_INTERVAL);
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

export type ChatMessage = {
  _id: string;
  chatId: string;
  senderName: string;
  senderId: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'sticker' | 'gif' | 'file';
  mediaUrl?: string;
  isBot: boolean;
  replyTo?: {
    messageId: string;
    senderName: string;
    text?: string;
    type?: string;
    mediaUrl?: string;
  };
  reactions?: { [emoji: string]: string[] };
  edited?: boolean;
  editedAt?: string;
  deletedFor?: string[];
  timestamp: string;
};

/**
 * Conecta al servidor de chat con las credenciales del usuario.
 */
// AppState listener to pause keep-alive when backgrounded
if (typeof AppState !== 'undefined') {
  AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      if (socket && socket.connected) {
        console.log('[Socket] AppState activa — Reanudando keep-alive');
        startKeepAlive();
      }
    } else {
      console.log('[Socket] AppState inactiva/background — Pausando keep-alive');
      stopKeepAlive();
    }
  });
}

/**
 * Conecta al servidor de chat con las credenciales del usuario.
 */
export function connect(email: string, password: string): Socket {
  // Si ya hay socket activo (conectado o en proceso de reconexión), reutilizarlo
  if (socket && (socket.connected || socket.active)) {
    return socket;
  }

  // Si hay un socket en estado inválido, limpiarlo antes de crear uno nuevo
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { email, password },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket.IO conectado');
    chatStore.setSocketConnected(true);
    startKeepAlive();
    // Bug fix: re-unirse al grupo automáticamente tras cada (re)conexión
    if (currentGroup) {
      console.log('[Socket] Re-uniéndose al grupo tras (re)conexión:', currentGroup);
      socket?.emit('join-group', currentGroup);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Error de conexión Socket.IO:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('👋 Socket.IO desconectado:', reason);
    chatStore.setSocketConnected(false);
  });

  // Global listeners forwarding to chatStore
  socket.on('new-message', (msg: ChatMessage) => {
    const auth = getAuth();
    const groupName = msg.chatId || currentGroup;
    if (groupName) {
      chatStore.addNewMessage(groupName, msg, auth?.userId || '');
    }
  });

  socket.on('chat-history', (data: { groupName: string; messages: ChatMessage[] }) => {
    if (data.groupName) {
      chatStore.setChatHistory(data.groupName, data.messages);
    }
  });

  socket.on('more-messages', (data: { groupName: string; messages: ChatMessage[]; hasMore?: boolean }) => {
    if (data.groupName) {
      chatStore.addOlderMessages(data.groupName, data.messages, data.hasMore !== false);
    }
  });

  socket.on('user-typing', (data: { groupName: string; userName: string }) => {
    const auth = getAuth();
    if (data.groupName && data.userName !== auth?.name) {
      chatStore.setUserTyping(data.groupName, data.userName, true);
    }
  });

  socket.on('user-stopped-typing', (data: { groupName: string; userName: string }) => {
    if (data.groupName) {
      chatStore.setUserTyping(data.groupName, data.userName, false);
    }
  });

  socket.on('bot-typing', (data: { groupName: string }) => {
    if (data.groupName) {
      chatStore.setUserTyping(data.groupName, 'Agente Mundial', true);
    }
  });

  socket.on('bot-stopped-typing', (data: { groupName: string }) => {
    if (data.groupName) {
      chatStore.setUserTyping(data.groupName, 'Agente Mundial', false);
    }
  });

  socket.on('message-reacted', (data: { messageId: string; reactions: { [emoji: string]: string[] } }) => {
    if (currentGroup) {
      chatStore.updateMessageReactions(currentGroup, data.messageId, data.reactions);
    }
  });

  socket.on('message-edited', (data: { messageId: string; newText: string; edited: boolean; editedAt: string }) => {
    if (currentGroup) {
      chatStore.editChatMessage(currentGroup, data.messageId, data.newText, data.editedAt);
    }
  });

  socket.on('message-deleted', (data: { messageId: string; deleteFor: string; userId?: string }) => {
    if (currentGroup) {
      chatStore.deleteChatMessage(currentGroup, data.messageId, data.deleteFor, data.userId);
    }
  });

  return socket;
}

/**
 * Desconecta del servidor de chat.
 */
export function disconnect() {
  stopKeepAlive();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentGroup = null;
  chatStore.clearCache();
}

/**
 * Obtiene la instancia actual del socket.
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Unirse a la sala de un grupo para recibir mensajes.
 * Guarda el grupo actual para poder re-unirse tras reconexiones.
 */
export function joinGroup(groupName: string) {
  currentGroup = groupName;
  socket?.emit('join-group', groupName);
}

/**
 * Enviar un mensaje al grupo (Texto, Imagen, Audio, Sticker o GIF).
 * Devuelve true si el mensaje se envió, false si el socket no estaba disponible.
 */
export function sendMessage(
  groupName: string,
  text?: string,
  type: 'text' | 'image' | 'audio' | 'sticker' | 'gif' | 'file' = 'text',
  mediaUrl?: string,
  replyTo?: ChatMessage['replyTo']
): boolean {
  if (!socket?.connected) {
    console.warn('[Socket] sendMessage: socket no conectado, mensaje descartado');
    return false;
  }
  socket.emit('send-message', { groupName, text, type, mediaUrl, replyTo });
  return true;
}

/**
 * Emitir reacción a un mensaje.
 */
export function reactToMessage(messageId: string, emoji: string, add: boolean) {
  socket?.emit('react-message', { messageId, emoji, add });
}

/**
 * Emitir edición de mensaje.
 */
export function editMessage(messageId: string, newText: string, groupName: string) {
  socket?.emit('edit-message', { messageId, newText, groupName });
}

/**
 * Emitir eliminación de mensaje.
 */
export function deleteMessage(messageId: string, deleteFor: 'me' | 'everyone', groupName: string) {
  socket?.emit('delete-message', { messageId, deleteFor, groupName });
}

/**
 * Emitir indicador de "escribiendo".
 */
export function sendTyping(groupName: string) {
  socket?.emit('typing', { groupName });
}

/**
 * Dejar de mostrar "escribiendo".
 */
export function sendStopTyping(groupName: string) {
  socket?.emit('stop-typing', { groupName });
}
