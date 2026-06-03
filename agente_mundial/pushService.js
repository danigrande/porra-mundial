// ============================================
// PUSH SERVICE — Expo Push Notifications
// ============================================
// Envía notificaciones push a los dispositivos móviles.
// Usa la API gratuita de Expo Push Notifications.

import { PushToken } from './models/PushToken.js';
import { Group } from './models/Group.js';
import { User } from './models/User.js';
import { BlockedUser } from './models/BlockedUser.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envía una notificación push a un usuario específico.
 * @param {string} userId - ID del usuario en MongoDB
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo del mensaje
 * @param {Object} data - Datos adicionales (ej: groupName, screen)
 */
export async function sendToUser(userId, title, body, data = {}) {
  try {
    const tokens = await PushToken.find({ user: userId });
    if (tokens.length === 0) return;

    const messages = tokens.map(t => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data,
    }));

    await sendPushBatch(messages);
  } catch (error) {
    console.error('[Push] Error enviando a usuario:', error.message);
  }
}

/**
 * Envía una notificación push a TODOS los miembros de un grupo.
 * @param {string} groupName - Nombre del grupo
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo del mensaje
 * @param {Object} data - Datos adicionales
 * @param {string} excludeUserId - ID de usuario a excluir (ej: el que envió el mensaje)
 */
export async function sendToGroup(groupName, title, body, data = {}, excludeUserId = null, isAgent = false) {
  try {
    const group = await Group.findOne({ name: groupName }).populate('members');
    if (!group) return;

    const memberIds = group.members.map(m => m._id.toString());
    const tokens = await PushToken.find({ user: { $in: memberIds } }).populate('user');
    
    if (tokens.length === 0) {
      console.warn(`[Push] ⚠️ No hay tokens registrados para los miembros del grupo ${groupName}. No se enviarán notificaciones.`);
      return;
    }

    // --- BLOQUEOS ---
    let blockedMeIds = [];
    if (excludeUserId) {
        const blocks = await BlockedUser.find({ blockedId: excludeUserId }).select('blockerId');
        blockedMeIds = blocks.map(b => b.blockerId);
    }

    const messages = [];
    const textLower = body.toLowerCase();

    for (const t of tokens) {
      const user = t.user;
      if (!user || user._id.toString() === excludeUserId) continue;

      // No enviar si el destinatario ha bloqueado al remitente
      if (blockedMeIds.includes(user._id.toString())) {
          console.log(`[Push] 🚫 Saltando a ${user.name} (ha bloqueado al remitente)`);
          continue;
      }

      // Lógica de filtrado por preferencias
      const pref = user.notificationPreference || 'all';
      console.log(`[Push] Usuario: ${user.name} (${user._id}), Token: ${t.token.substring(0,10)}..., Pref: "${pref}"`);

      if (pref === 'none') {
        console.log(`[Push] 🔇 Silencio total para ${user.name}`);
        continue;
      }

      const nameMention = `@${user.name.toLowerCase()}`;
      const nickMention = user.nickname ? `@${user.nickname.toLowerCase()}` : null;
      const isMentioned = textLower.includes(nameMention) || 
                         (nickMention && textLower.includes(nickMention)) ||
                         textLower.includes('@todos') || 
                         textLower.includes('@all');

      if (pref === 'agent-mentions') {
        if (!isAgent && !isMentioned) {
          console.log(`[Push] 🔇 Saltando a ${user.name} (solo agente+menciones, no es agente ni mención)`);
          continue;
        }
      }

      if (pref === 'mentions') {
        if (!isMentioned) {
          console.log(`[Push] 🔇 Saltando a ${user.name} (solo menciones, no detectada)`);
          continue;
        }
      }

      messages.push({
        to: t.token,
        sound: 'default',
        title,
        body,
        data: { ...data, groupName },
      });
    }

    if (messages.length === 0) return;

    await sendPushBatch(messages);
    console.log(`[Push] Enviado a ${messages.length} dispositivos del grupo ${groupName}`);
  } catch (error) {
    console.error('[Push] Error enviando a grupo:', error.message);
  }
}

/**
 * Envía un lote de mensajes push a Expo.
 * Expo acepta hasta 100 mensajes por petición.
 */
async function sendPushBatch(messages) {
  // Dividir en chunks de 100
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      
      // Limpiar tokens inválidos
      if (result.data) {
        for (let i = 0; i < result.data.length; i++) {
          if (result.data[i].status === 'error' && 
              result.data[i].details?.error === 'DeviceNotRegistered') {
            await PushToken.deleteOne({ token: chunk[i].to });
            console.log(`[Push] Token inválido eliminado: ${chunk[i].to.substring(0, 20)}...`);
          }
        }
      }
    } catch (error) {
      console.error('[Push] Error en batch:', error.message);
    }
  }
}

/**
 * Registra o actualiza un token de push notification.
 * @param {string} userId - ID del usuario en MongoDB
 * @param {string} token - Expo push token
 * @param {string} platform - 'ios', 'android', o 'web'
 */
export async function registerToken(userId, token, platform = 'android') {
  try {
    await PushToken.findOneAndUpdate(
      { token },
      { user: userId, token, platform, updatedAt: new Date() },
      { upsert: true }
    );
    console.log(`[Push] ✅ TOKEN REGISTRADO: ${token.substring(0, 20)}... para usuario ${userId} (${platform})`);
  } catch (error) {
    console.error('[Push] Error registrando token:', error.message);
  }
}

/**
 * Elimina un token de push notification.
 */
export async function removeToken(token) {
  try {
    await PushToken.deleteOne({ token });
  } catch (error) {
    console.error('[Push] Error eliminando token:', error.message);
  }
}
