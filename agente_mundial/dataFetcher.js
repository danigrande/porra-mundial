// ============================================
// DATA FETCHER — Centralizado y Limpio (SCALED)
// ============================================

// Función auxiliar para obtener la URL en tiempo real
function getScriptUrl() {
  if (typeof window !== 'undefined' && window.SCRIPT_URL) return window.SCRIPT_URL;
  if (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.SCRIPT_URL) return window.CONFIG.SCRIPT_URL;
  return '';
}

/**
 * Función genérica para realizar peticiones a la API de Google Apps Script.
 */
export async function apiCall(params = {}, options = {}) {
  let url = getScriptUrl();
  
  // Si no hay URL, intentamos cargar config.js (Node)
  if (!url) {
    try {
      const config = (await import('./config.js')).default;
      url = config.googleScript.url;
    } catch (e) {}
  }

  if (!url) {
    console.error('[API] Error: SCRIPT_URL no encontrada en window ni en config.js');
    return { status: 'error', message: 'Configuración de red no encontrada' };
  }

  console.log(`[API DEBUG] ${options.method || 'GET'} -> ${params.action}`);

  try {
    const isPost = options.method === 'POST';
    let finalUrl = url;

    if (!isPost) {
      const query = new URLSearchParams(params).toString();
      finalUrl += query ? `?${query}` : '';
    }

    const fetchOptions = {
      method: options.method || 'GET',
      headers: isPost ? { 'Content-Type': 'text/plain' } : {},
      ...options
    };

    if (isPost) {
      fetchOptions.body = JSON.stringify(params);
    }

    const response = await fetch(finalUrl, fetchOptions);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    console.log(`[API RESULT] ${params.action}:`, data);
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
