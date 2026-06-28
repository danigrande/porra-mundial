import { Platform } from 'react-native';

// Apuntar al servidor local para desarrollo (Expo Go)
const LOCAL_IP = '192.168.1.132';
const API_BASE = __DEV__
  ? (Platform.OS === 'web' ? 'http://localhost:3000' : `http://${LOCAL_IP}:3000`)
  : 'https://porra-mundial.onrender.com';

export const API_URL = API_BASE;
export const SOCKET_URL = API_BASE;

/**
 * Subir un archivo al servidor.
 */
export async function uploadFile(fileUri: string, type: string = 'image') {
  const formData = new FormData();
  const filename = fileUri.split('/').pop() || 'file';

  const mimeMap: Record<string, string> = {
    image: 'image/jpeg',
    audio: 'audio/m4a',
    file: 'application/octet-stream',
    pdf: 'application/pdf',
    'application/pdf': 'application/pdf',
    'image/jpeg': 'image/jpeg',
    'image/png': 'image/png',
    'audio/m4a': 'audio/m4a',
    'audio/mpeg': 'audio/mpeg',
    'audio/mp3': 'audio/mpeg',
  };

  formData.append('file', {
    uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
    name: filename,
    type: mimeMap[type] || type || 'application/octet-stream',
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

export async function login(email: string, password: string, groupName: string) {
  return apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, groupName }),
  });
}

export async function register(
  playerName: string,
  email: string,
  password: string,
  groupName: string,
) {
  return apiFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ playerName, email, password, groupName }),
  });
}

export async function getUserByEmail(email: string) {
  return apiFetch(`/user/by-email/${encodeURIComponent(email)}`);
}

export async function getUserGroups(email: string) {
  return apiFetch(`/groups?email=${encodeURIComponent(email)}`);
}

// ==========================================
// GRUPOS Y JUGADORES
// ==========================================

export async function getPlayers(groupName: string) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players`);
}

export async function addPlayer(groupName: string, playerName: string, email: string, password?: string) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players`, {
    method: 'POST',
    body: JSON.stringify({ playerName, email, password }),
  });
}

export async function checkGroupExists(name: string) {
  return apiFetch(`/groups/${encodeURIComponent(name)}/exists`);
}

export async function transferAdmin(groupName: string, requesterName: string, targetName: string) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/transfer-admin`, {
    method: 'POST',
    body: JSON.stringify({ requesterName, targetName }),
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

export async function resetGroup(groupName: string, adminKey: string) {
  return apiFetch('/dev/reset-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey
    },
    body: JSON.stringify({ groupName }),
  });
}

// ==========================================
// PREDICCIONES
// ==========================================

export async function getPredictions(groupName: string) {
  return apiFetch(`/predictions?groupName=${encodeURIComponent(groupName)}`);
}

export async function getMyPredictions(groupName: string, userId: string) {
  return apiFetch(`/predictions?groupName=${encodeURIComponent(groupName)}&userId=${encodeURIComponent(userId)}`);
}

export async function savePredictions(playerName: string, groupName: string, predictions: any) {
  return apiFetch('/predictions', {
    method: 'POST',
    body: JSON.stringify({ playerName, groupName, predictions }),
  });
}

export async function registerPushToken(userId: string, token: string, platform: string) {
  return apiFetch('/push-token', {
    method: 'POST',
    body: JSON.stringify({ userId, token, platform }),
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

export async function simulateMatch(matchId: string | number, homeTeam: string, awayTeam: string, adminKey: string) {
  return apiFetch('/admin/simulate-match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey
    },
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

export async function searchChat(groupName: string, q: string, before?: string, limit?: number) {
  let url = `/chat/${encodeURIComponent(groupName)}/search?q=${encodeURIComponent(q)}`;
  if (before) url += `&before=${before}`;
  if (limit) url += `&limit=${limit}`;
  return apiFetch(url);
}

export async function getLinkPreview(url: string): Promise<{ title: string; description: string; image: string }> {
  try {
    const response = await fetch(`${API_URL}/api/link-preview?url=${encodeURIComponent(url)}`, {
      headers: { 'Accept': 'application/json' },
    });
    const text = await response.text();
    const data = JSON.parse(text);
    if (data.status === 'error') return { title: '', description: '', image: '' };
    return data.data || { title: '', description: '', image: '' };
  } catch {
    return { title: '', description: '', image: '' };
  }
}

// ==========================================
// PERFIL
// ==========================================

export async function getProfile(userId: string) {
  if (!userId) throw new Error('Usuario no autenticado');
  return apiFetch(`/profile?userId=${encodeURIComponent(userId)}`);
}

export async function updateProfile(userId: string, groupName: string, profile: any, email?: string) {
  return apiFetch('/profile', {
    method: 'POST',
    body: JSON.stringify({ userId, groupName, profile, email }),
  });
}

export async function forgotPassword(email: string) {
  return apiFetch('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, code: string, newPassword: string) {
  return apiFetch('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, code, newPassword }),
  });
}

export async function adminResetMemberPassword(
  adminUserId: string,
  groupName: string,
  memberEmail: string,
  newPassword?: string,
) {
  return apiFetch('/admin/reset-member-password', {
    method: 'POST',
    body: JSON.stringify({ adminUserId, groupName, memberEmail, newPassword }),
  });
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
) {
  return apiFetch('/profile/change-password', {
    method: 'POST',
    body: JSON.stringify({ userId, oldPassword, newPassword }),
  });
}

export async function deleteAccount(userId: string) {
  return apiFetch(`/profile?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function reportContent(data: {
  reporterId: string;
  reportedId: string;
  messageId?: string;
  reason: string;
}) {
  return apiFetch('/report', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function blockUser(blockerId: string, blockedId: string, groupName?: string) {
  return apiFetch('/block', {
    method: 'POST',
    body: JSON.stringify({ blockerId, blockedId, groupName }),
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  return apiFetch('/unblock', {
    method: 'POST',
    body: JSON.stringify({ blockerId, blockedId }),
  });
}

export async function getBlockedUsers(userId: string): Promise<string[]> {
  return apiFetch(`/blocked?userId=${encodeURIComponent(userId)}`);
}

export async function searchGiphy(query: string) {
  return apiFetch(`/giphy/search?q=${encodeURIComponent(query)}`);
}

// === FEEDBACK ===

export async function sendFeedback(data: {
  userId: string; userName: string; type: string; subject: string; detail: string;
}) {
  return apiFetch('/feedback', { method: 'POST', body: JSON.stringify(data) });
}

export async function getFeedback() {
  return apiFetch('/feedback');
}

export async function voteFeedback(feedbackId: string, userId: string) {
  return apiFetch(`/feedback/${feedbackId}/vote`, { method: 'POST', body: JSON.stringify({ userId }) });
}

// === CHATBOT FEEDBACK ===

export async function submitChatbotFeedback(data: {
  messageId: string;
  userId: string;
  userName: string;
  rating: number;
  reason?: string;
}) {
  return apiFetch('/chatbot-feedback', { method: 'POST', body: JSON.stringify(data) });
}

export async function getChatbotFeedbackBatch(messageIds: string[], userId: string) {
  return apiFetch(`/chatbot-feedback/batch?messageIds=${encodeURIComponent(JSON.stringify(messageIds))}&userId=${encodeURIComponent(userId)}`);
}
