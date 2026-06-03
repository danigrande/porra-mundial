// ============================================
// DATA FETCHER — Centralizado y Limpio (SCALED)
// ============================================

// Función auxiliar para obtener la URL de la nueva API Node.js
function getApiUrl() {
  // Si estamos en el navegador y configuro RENDER_URL
  if (typeof window !== 'undefined' && window.RENDER_URL) return window.RENDER_URL + '/api';
  // Fallback local con puerto dinámico
  const port = (typeof process !== 'undefined' && process.env.PORT) ? process.env.PORT : '3000';
  return `http://localhost:${port}/api`;
}

/**
 * Función genérica para mapear acciones antiguas a la nueva API REST.
 */
export async function apiCall(params = {}, options = {}) {
  const baseUrl = getApiUrl();
  let { action, groupName, playerName, ...rest } = params;
  
  // Fallback a localStorage si no se pasan por parámetro
  if (typeof window !== 'undefined') {
    const stored = JSON.parse(localStorage.getItem('worldcup2026_user') || '{}');
    if (!playerName && stored.name) playerName = stored.name;
    if (!groupName && stored.groupName) groupName = stored.groupName;
    if (!params.email && stored.email) params.email = stored.email;
    if (!params.userId && stored.userId) params.userId = stored.userId;
  }
  
  let endpoint = '';
  let method = options.method || 'GET';
  let body = null;

  console.log(`[API DEBUG] mapping action: ${action}`);

  // Mapeo de Acciones -> Endpoints REST
  switch (action) {
    case 'login':
      endpoint = `/login`;
      method = 'POST';
      body = { email: params.email, password: params.password, groupName };
      break;
    case 'register':
      endpoint = `/register`;
      method = 'POST';
      body = { playerName, email: params.email, password: params.password, groupName, isNewGroup: params.isNewGroup };
      break;
    case 'listGroups':
      endpoint = `/groups`;
      break;
    case 'getGroupsForPlayer':
      if (params.userId) {
        endpoint = `/groups?userId=${encodeURIComponent(params.userId)}`;
      } else if (params.email) {
        endpoint = `/groups?email=${encodeURIComponent(params.email)}`;
      } else {
        endpoint = `/groups?playerName=${encodeURIComponent(playerName)}`;
      }
      break;
    case 'getRules':
      endpoint = `/groups/${encodeURIComponent(groupName)}/rules`;
      break;
    case 'saveRules':
    case 'setRules':
      endpoint = `/groups/${encodeURIComponent(groupName)}/rules`;
      method = 'POST';
      body = { 
        data: params.data || params.rules,
        predictionMode: params.predictionMode // Añadido para persistencia
      };
      break;
    case 'getPredictions':
      endpoint = `/predictions?groupName=${encodeURIComponent(groupName)}`;
      break;
    case 'savePredictions':
      endpoint = `/predictions`;
      method = 'POST';
      body = { playerName, groupName, predictions: params.predictions || rest };
      break;
    case 'getAllSummaries':
      endpoint = `/summaries?groupName=${encodeURIComponent(groupName)}`;
      break;
    case 'saveSummary':
      endpoint = `/summaries`;
      method = 'POST';
      body = { playerName, groupName, summary: params.summary };
      break;
    case 'getReality':
      endpoint = `/reality`;
      break;
    case 'saveReality':
      endpoint = `/reality`;
      method = 'POST';
      body = { results: params.results };
      break;
    case 'saveInfo':
      endpoint = `/profile`;
      method = 'POST';
      body = { playerName, userId: params.userId, email: params.email, groupName, profile: params.data }; // <-- Cambiado de params.profile a params.data
      break;
    case 'getInfo':
      endpoint = params.userId 
        ? `/profile?userId=${encodeURIComponent(params.userId)}` 
        : `/profile?playerName=${encodeURIComponent(playerName)}`;
      break;
    case 'changePassword':
      endpoint = `/profile/change-password`;
      method = 'POST';
      body = { userId: params.userId, oldPassword: params.oldPassword, newPassword: params.newPassword };
      break;
    case 'getUserMapping':
      endpoint = `/groups/${encodeURIComponent(groupName)}/user-mapping`;
      break;
    case 'addPlayer':
      endpoint = `/groups/${encodeURIComponent(groupName)}/players`;
      method = 'POST';
      body = { playerName, email: params.email };
      break;
    case 'getPlayers':
      endpoint = `/groups/${encodeURIComponent(groupName)}/players`;
      break;
    case 'getAllInfo':
      endpoint = `/groups/${encodeURIComponent(groupName)}/profiles`;
      break;
    case 'removePlayer':
      endpoint = `/groups/${encodeURIComponent(groupName)}/players/${encodeURIComponent(playerName)}`;
      method = 'DELETE';
      break;
    case 'transferAdmin':
      endpoint = `/groups/${encodeURIComponent(groupName)}/transfer-admin`;
      method = 'POST';
      body = { requesterName: playerName, targetName: params.targetName };
      break;
    case 'simulateMatch':
      endpoint = `/admin/simulate-match`;
      method = 'POST';
      body = { matchId: params.matchId, homeTeam: params.homeTeam, awayTeam: params.awayTeam };
      break;
    case 'simulateAll':
      endpoint = `/admin/simulate-all`;
      method = 'POST';
      break;
    case 'tournament-state':
      endpoint = `/tournament-state?groupName=${encodeURIComponent(groupName)}`;
      break;
    default:
      console.warn(`[API] Acción no implementada en la nueva API: ${action}`);
      return { status: 'error', message: 'Not implemented' };
  }

  try {
    const fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...options
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, fetchOptions);
    let data;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        const errorMsg = data?.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
    }
    
    console.log(`[API RESULT] ${action}:`, data);
    return data;
  } catch (error) {
    console.error(`[API ERROR] Fallo en ${action || 'request'}:`, error.message);
    return { status: 'error', message: error.message };
  }
}

// --- FUNCIONES EXPORTADAS ---

export const getAllPredictions = async (groupName) => {
  const res = await apiCall({ action: 'getPredictions', groupName });
  return res?.status === 'success' ? res.data : {};
};

export const getAllProfiles = async (groupName) => {
  const res = await apiCall({ action: 'getAllInfo', groupName });
  return res?.status === 'success' ? res.data : {};
};

export const getAllSummaries = async (groupName) => {
  const res = await apiCall({ action: 'getAllSummaries', groupName });
  return res?.status === 'success' ? res.data : {};
};

export const getUserMapping = async (groupName) => {
  const res = await apiCall({ action: 'getUserMapping', groupName });
  return res?.status === 'success' ? res.data : {};
};

export const getPlayerList = async (groupName) => {
  const res = await apiCall({ action: 'getPlayers', groupName });
  return res?.status === 'success' ? res.data : [];
};

export const getRules = async (groupName) => {
  const res = await apiCall({ action: 'getRules', groupName });
  return res?.status === 'success' ? res.data : {};
};

export const setRules = async (groupName, data) => {
  const res = await apiCall({ action: 'setRules', groupName, data }, { method: 'POST' });
  return res?.status === 'success';
};

export const getReality = async () => {
  const res = await apiCall({ action: 'getReality' });
  return res?.status === 'success' ? res.data : {};
};

/**
 * Guarda un resumen IA.
 */
export async function saveSummary(playerName, groupName, summaryText) {
  console.log(`💾 [saveSummary] Guardando resumen de "${playerName}" en grupo "${groupName}"`);
  return await apiCall({
    action: 'saveSummary',
    playerName,
    groupName,
    summary: summaryText,
  }, { method: 'POST' });
}

/**
 * Obtiene el perfil de un jugador específico.
 */
export async function getPlayerProfile(playerName, groupName) {
  const remoteProfiles = await getAllProfiles(groupName);
  if (remoteProfiles && remoteProfiles[playerName]) {
    return remoteProfiles[playerName];
  }
  
  // Fallback local desde config.js
  return config.playerProfiles[playerName] || {
    nickname: playerName,
    likes: ['Fútbol'],
    dislikes: ['Perder'],
    humor_style: 'Divertido y amigable',
  };
}
