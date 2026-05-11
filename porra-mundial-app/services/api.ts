import { Platform } from 'react-native';

// Cambia esta URL a tu servidor en Render cuando despliegues
const LOCAL_IP = '192.168.1.10';
const API_BASE = __DEV__ 
  ? (Platform.OS === 'web' ? 'http://localhost:3000' : `http://${LOCAL_IP}:3000`)
  : 'https://tu-app.onrender.com'; 

export const API_URL = API_BASE;
export const SOCKET_URL = API_BASE;

/**
 * Subir un archivo al servidor.
 */
export async function uploadFile(fileUri: string, type: 'image' | 'audio') {
  const formData = new FormData();
  const filename = fileUri.split('/').pop() || (type === 'image' ? 'photo.jpg' : 'voice.m4a');
  
  formData.append('file', {
    uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
    name: filename,
    type: type === 'image' ? 'image/jpeg' : 'audio/m4a',
  } as any);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message);
  
  // Devolver URL completa
  return `${API_URL}${data.data.url}`;
}

/**
 * Wrapper para fetch con manejo de errores.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}/api${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || 'Error del servidor');
    }
    
    return data.data;
  } catch (error) {
    console.error(`[API] Error en ${endpoint}:`, error.message);
    throw error;
  }
}

// ==========================================
// AUTENTICACIÓN
// ==========================================

export async function login(phone, pin, groupName) {
  return apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ phone, playerPin: pin, groupName }),
  });
}

export async function register(playerName, phone, pin, groupName, isNewGroup = false) {
  return apiFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ playerName, phone, playerPin: pin, groupName, isNewGroup }),
  });
}

export async function getUserByPhone(phone) {
  return apiFetch(`/user/by-phone/${phone}`);
}

export async function getUserGroups(phone) {
  return apiFetch(`/groups?phone=${phone}`);
}

// ==========================================
// GRUPOS Y JUGADORES
// ==========================================

export async function getPlayers(groupName) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players`);
}

export async function addPlayer(groupName, playerName, phone) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players`, {
    method: 'POST',
    body: JSON.stringify({ playerName, phone }),
  });
}

export async function removePlayer(groupName, playerName) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players/${encodeURIComponent(playerName)}`, {
    method: 'DELETE',
  });
}

export async function getGroupRules(groupName) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/rules`);
}

export async function saveGroupRules(groupName, data, predictionMode) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/rules`, {
    method: 'POST',
    body: JSON.stringify({ data, predictionMode }),
  });
}

export async function getLeaderboard(groupName) {
  return apiFetch(`/leaderboard?groupName=${encodeURIComponent(groupName)}`);
}

export async function resetGroup(groupName) {
  return apiFetch('/dev/reset-test', {
    method: 'POST',
    body: JSON.stringify({ groupName }),
  });
}

// ==========================================
// PREDICCIONES
// ==========================================

export async function getPredictions(groupName) {
  return apiFetch(`/predictions?groupName=${encodeURIComponent(groupName)}`);
}

export async function getMyPredictions(groupName, phone) {
  return apiFetch(`/predictions?groupName=${encodeURIComponent(groupName)}&phone=${encodeURIComponent(phone)}`);
}

export async function savePredictions(playerName, groupName, predictions) {
  return apiFetch('/predictions', {
    method: 'POST',
    body: JSON.stringify({ playerName, groupName, predictions }),
  });
}

export async function registerPushToken(phone: string, token: string, platform: string) {
  return apiFetch('/push-token', {
    method: 'POST',
    body: JSON.stringify({ phone, token, platform }),
  });
}

// ==========================================
// RANKING Y REALIDAD
// ==========================================

export async function getReality() {
  return apiFetch('/reality');
}

export async function getTournamentState(groupName) {
  const params = groupName ? `?groupName=${encodeURIComponent(groupName)}` : '';
  return apiFetch(`/tournament-state${params}`);
}

export async function saveReality(results) {
  return apiFetch('/reality', {
    method: 'POST',
    body: JSON.stringify({ results }),
  });
}

export async function simulateMatch(matchId, homeTeam, awayTeam) {
  return apiFetch('/admin/simulate-match', {
    method: 'POST',
    body: JSON.stringify({ matchId, homeTeam, awayTeam }),
  });
}

// ==========================================
// RESÚMENES
// ==========================================

export async function getSummaries(groupName) {
  return apiFetch(`/summaries?groupName=${encodeURIComponent(groupName)}`);
}

export async function getPlayerSummary(player, groupName) {
  return apiFetch(`/summary/${encodeURIComponent(player)}?groupName=${encodeURIComponent(groupName)}`);
}

// ==========================================
// CHAT
// ==========================================

export async function getChatHistory(groupName, before = null, limit = 50) {
  let url = `/chat/${encodeURIComponent(groupName)}/messages?limit=${limit}`;
  if (before) url += `&before=${before}`;
  return apiFetch(url);
}

// ==========================================

// ==========================================
// PERFIL
// ==========================================

export async function getProfile(phone) {
  return apiFetch(`/profile?phone=${phone}`);
}

export async function updateProfile(phone, groupName, profile) {
  return apiFetch('/profile', {
    method: 'POST',
    body: JSON.stringify({ phone, groupName, profile }),
  });
}

export async function changePin(phone, groupName, oldPin, newPin) {
  return apiFetch('/profile/change-pin', {
    method: 'POST',
    body: JSON.stringify({ phone, groupName, oldPin, newPin }),
  });
}

export async function deleteAccount(phone: string) {
  return apiFetch(`/profile?phone=${encodeURIComponent(phone)}`, {
    method: 'DELETE',
  });
}

export async function reportContent(data: { reporterPhone: string, reportedUser: string, messageId?: string, reason: string }) {
  return apiFetch('/report', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
