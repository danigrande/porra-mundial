// ============================================
// API SERVICE — Comunicación con el backend
// ============================================

// Cambia esta URL a tu servidor en Render cuando despliegues
const API_BASE = __DEV__ 
  ? 'http://192.168.1.10:3000'  // IP local para desarrollo
  : 'https://tu-app.onrender.com'; // URL de producción

export const API_URL = API_BASE;
export const SOCKET_URL = API_BASE;

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

export async function getGroupPlayers(groupName) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/players`);
}

export async function getGroupRules(groupName) {
  return apiFetch(`/groups/${encodeURIComponent(groupName)}/rules`);
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
// PUSH NOTIFICATIONS
// ==========================================

export async function registerPushToken(phone, token, platform) {
  return apiFetch('/push-token', {
    method: 'POST',
    body: JSON.stringify({ phone, token, platform }),
  });
}

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
