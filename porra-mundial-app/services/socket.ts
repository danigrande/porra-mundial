// ============================================
// SOCKET SERVICE — Conexión en tiempo real
// ============================================

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './api';

let socket: Socket | null = null;

// Grupo activo al que hay que re-unirse tras reconexión
let currentGroup: string | null = null;

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
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket.IO conectado');
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
  });

  return socket;
}

/**
 * Desconecta del servidor de chat.
 */
export function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentGroup = null;
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
