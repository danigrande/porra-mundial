// ============================================
// SOCKET SERVICE — Conexión en tiempo real
// ============================================

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './api';

let socket: Socket | null = null;

export type ChatMessage = {
  _id: string;
  chatId: string;
  senderName: string;
  senderId: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'sticker' | 'gif';
  mediaUrl?: string;
  isBot: boolean;
  timestamp: string;
};

/**
 * Conecta al servidor de chat con las credenciales del usuario.
 */
export function connect(phone: string, pin: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { phone, pin },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket.IO conectado');
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
    socket.disconnect();
    socket = null;
  }
}

/**
 * Obtiene la instancia actual del socket.
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Unirse a la sala de un grupo para recibir mensajes.
 */
export function joinGroup(groupName: string) {
  socket?.emit('join-group', groupName);
}

/**
 * Enviar un mensaje al grupo (Texto, Imagen, Audio, Sticker o GIF).
 */
export function sendMessage(groupName: string, text?: string, type: 'text' | 'image' | 'audio' | 'sticker' | 'gif' = 'text', mediaUrl?: string) {
  socket?.emit('send-message', { groupName, text, type, mediaUrl });
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
