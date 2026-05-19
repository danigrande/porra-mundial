import { Platform } from 'react-native';

// Apuntar siempre al backend de producción en Render
const API_BASE = 'https://porra-mundial.onrender.com';

/*
// Descomentar para desarrollo con servidor local:
const LOCAL_IP = '192.168.1.138';
const API_BASE = __DEV__
  ? (Platform.OS === 'web' ? 'http://localhost:3000' : `http://${LOCAL_IP}:3000`)
  : 'https://porra-mundial.onrender.com';
*/

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
async function apiFetch(endpoint: string, options: RequestInit = {}) {
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
  } catch (error: any) {
    console.error(`[API] Error en ${endpoint}:`, error.message);
    throw error;
  }
}

// ==========================================
// AUTENTICACIÓN
// ==========================================

export async function login(phone: string, pin: string, groupName: string) {
  return apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ phone, playerPin: pin, groupName }),
  });
}

export async function register(playerName: string, phone: string, pin: string, groupName: string, isNewGroup: boolean = false) {
  return apiFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ playerName, phone, playerPin: pin, groupName, isNewGroup }),
  });
}

export async function getUserByPhone(phone: string) {
  return apiFetch(`/user/by-phone/${phone}`);
}

export async function getUserGroups(phone: string) {
  return apiFetch(`/groups?phone=${phone}`);
}

// ==========================================
// GRUPOS Y JUGADORES
// ==========================================

export async function getPlayers(groupName: string) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players`);
}

export async function addPlayer(groupName: string, playerName: string, phone: string) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players`, {
    method: 'POST',
    body: JSON.stringify({ playerName, phone }),
  });
}

export async function removePlayer(groupName: string, playerName: string) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players/${encodeURIComponent(playerName)}`, {
    method: 'DELETE',
  });
}

export async function getGroupRules(groupName: string) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/rules`);
}

export async function saveGroupRules(groupName: string, data: any, predictionMode: string) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/rules`, {
    method: 'POST',
    body: JSON.stringify({ data, predictionMode }),
  });
}

export async function getLeaderboard(groupName: string) {
  return apiFetch(`/leaderboard?groupName=${encodeURIComponent(groupName)}`);
}

export async function resetGroup(groupName: string) {
  return apiFetch('/dev/reset-test', {
    method: 'POST',
    body: JSON.stringify({ groupName }),
  });
}

// ==========================================
// PREDICCIONES
// ==========================================

export async function getPredictions(groupName: string) {
  return apiFetch(`/predictions?groupName=${encodeURIComponent(groupName)}`);
}

export async function getMyPredictions(groupName: string, phone: string) {
  return apiFetch(`/predictions?groupName=${encodeURIComponent(groupName)}&phone=${encodeURIComponent(phone)}`);
}

export async function savePredictions(playerName: string, groupName: string, predictions: any) {
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

export async function getTournamentState(groupName?: string) {
  const params = groupName ? `?groupName=${encodeURIComponent(groupName)}` : '';
  return apiFetch(`/tournament-state${params}`);
}

export async function saveReality(results: any) {
  return apiFetch('/reality', {
    method: 'POST',
    body: JSON.stringify({ results }),
  });
}

export async function simulateMatch(matchId: string | number, homeTeam: string, awayTeam: string) {
  return apiFetch('/admin/simulate-match', {
    method: 'POST',
    body: JSON.stringify({ matchId, homeTeam, awayTeam }),
  });
}

// ==========================================
// RESÚMENES
// ==========================================

export async function getSummaries(groupName: string) {
  return apiFetch(`/summaries?groupName=${encodeURIComponent(groupName)}`);
}

export async function getPlayerSummary(player: string, groupName: string) {
  return apiFetch(`/summary/${encodeURIComponent(player)}?groupName=${encodeURIComponent(groupName)}`);
}

// ==========================================
// CHAT
// ==========================================

export async function getChatHistory(groupName: string, before: string | null = null, limit: number = 50) {
  let url = `/chat/${encodeURIComponent(groupName)}/messages?limit=${limit}`;
  if (before) url += `&before=${before}`;
  return apiFetch(url);
}

// ==========================================

// ==========================================
// PERFIL
// ==========================================

export async function getProfile(phone: string) {
  return apiFetch(`/profile?phone=${phone}`);
}

export async function updateProfile(phone: string, groupName: string, profile: any) {
  return apiFetch('/profile', {
    method: 'POST',
    body: JSON.stringify({ phone, groupName, profile }),
  });
}

export async function changePin(phone: string, groupName: string, oldPin: string, newPin: string) {
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

export async function blockUser(blockerPhone: string, blockedPhone: string, groupName?: string) {
  return apiFetch('/block', {
    method: 'POST',
    body: JSON.stringify({ blockerPhone, blockedPhone, groupName }),
  });
}

export async function unblockUser(blockerPhone: string, blockedPhone: string) {
  return apiFetch('/unblock', {
    method: 'POST',
    body: JSON.stringify({ blockerPhone, blockedPhone }),
  });
}

export async function getBlockedUsers(phone: string): Promise<string[]> {
  return apiFetch(`/blocked?phone=${encodeURIComponent(phone)}`);
}

export async function searchGiphy(query: string) {
  return apiFetch(`/giphy/search?q=${encodeURIComponent(query)}`);
}

