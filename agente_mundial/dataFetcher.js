// ============================================
// DATA FETCHER — Centralizado y Limpio (SCALED)
// ============================================

// Intenta obtener la URL de config.js (Node) o de la variable global (Navegador)
let SCRIPT_URL = '';
try {
  // @ts-ignore
  if (typeof window !== 'undefined' && window.SCRIPT_URL) {
    SCRIPT_URL = window.SCRIPT_URL;
  } else {
    const config = (await import('./config.js')).default;
    SCRIPT_URL = config.googleScript.url;
  }
} catch (e) {
  // Fallback si nada funciona
}

/**
 * Función genérica para realizar peticiones a la API de Google Apps Script.
 */
export async function apiCall(params = {}, options = {}) {
  if (!SCRIPT_URL) {
    console.error('SCRIPT_URL no definida. Asegúrate de que web_config.js o config.js estén cargados.');
    return { status: 'error', message: 'Configuración de red no encontrada' };
  }

  try {
    const isPost = options.method === 'POST';
    let url = SCRIPT_URL;

    if (!isPost) {
      const query = new URLSearchParams(params).toString();
      url += query ? `?${query}` : '';
    }

    const fetchOptions = {
      method: options.method || 'GET',
      headers: isPost ? { 'Content-Type': 'application/json' } : {},
      ...options
    };

    if (isPost) {
      fetchOptions.body = JSON.stringify(params);
    }

    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    return data; // Devolvemos el objeto completo { status, data, message, etc. }
  } catch (error) {
    console.error(`[API ERROR] Fallo en ${params.action || 'request'}:`, error.message);
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

export const getPlayerList = async (groupName) => {
  const res = await apiCall({ action: 'getPlayers', groupName });
  return res?.status === 'success' ? res.data : [];
};

export const getRules = async (groupName) => {
  const res = await apiCall({ action: 'getRules', groupName });
  return res?.status === 'success' ? res.data : {};
};

export const getPhoneMapping = async (groupName) => {
  const res = await apiCall({ action: 'getPhoneMapping', groupName });
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
