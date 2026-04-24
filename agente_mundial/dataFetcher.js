// ============================================
// DATA FETCHER — Obtiene datos de Google Sheets (SCALED)
// ============================================

import config from './config.js';

const SCRIPT_URL = config.googleScript.url;

/**
 * Obtiene todas las predicciones de un grupo.
 * @param {string} groupName
 */
export async function getAllPredictions(groupName) {
  try {
    const url = groupName ? `${SCRIPT_URL}?action=getPredictions&groupName=${encodeURIComponent(groupName)}` : SCRIPT_URL;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data || {};
    }
    return {};
  } catch (error) {
    console.error('Error fetching predictions:', error.message);
    return {};
  }
}

/**
 * Obtiene los perfiles de personalidad de un grupo.
 */
export async function getAllProfiles(groupName) {
  try {
    const url = groupName ? `${SCRIPT_URL}?action=getAllInfo&groupName=${encodeURIComponent(groupName)}` : `${SCRIPT_URL}?action=getAllInfo`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data || {};
    }
    return {};
  } catch (error) {
    console.error('Error fetching profiles:', error.message);
    return {};
  }
}

/**
 * Obtiene los resúmenes IA guardados.
 */
export async function getAllSummaries(groupName) {
  try {
    const url = groupName ? `${SCRIPT_URL}?action=getAllSummaries&groupName=${encodeURIComponent(groupName)}` : `${SCRIPT_URL}?action=getAllSummaries`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data || {};
    }
    return {};
  } catch (error) {
    console.error('Error fetching summaries:', error.message);
    return {};
  }
}

/**
 * Obtiene la lista de nombres de jugadores.
 */
export async function getPlayerList(groupName) {
  try {
    const url = groupName ? `${SCRIPT_URL}?action=getPlayers&groupName=${encodeURIComponent(groupName)}` : `${SCRIPT_URL}?action=getPlayers`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching players:', error.message);
    return [];
  }
}

/**
 * Guarda un resumen IA.
 */
export async function saveSummary(playerName, groupName, summaryText) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSummary',
        playerName,
        groupName,
        summary: summaryText,
      }),
    });
  } catch (error) {
    console.error('Error saving summary:', error.message);
  }
}

/**
 * Obtiene las reglas de puntuación de un grupo.
 */
export async function getRules(groupName) {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getRules&groupName=${encodeURIComponent(groupName)}`);
    const data = await response.json();
    return data.status === 'success' ? data.data : {};
  } catch (error) {
    console.error('Error fetching rules:', error.message);
    return {};
  }
}

/**
 * Obtiene el perfil de un jugador específico.
 */
export async function getPlayerProfile(playerName, groupName) {
  const remoteProfiles = await getAllProfiles(groupName);
  if (remoteProfiles[playerName]) {
    return remoteProfiles[playerName];
  }
  return config.playerProfiles[playerName] || {
    nickname: playerName,
    likes: ['Fútbol'],
    dislikes: ['Perder'],
    humor_style: 'Divertido y amigable',
  };
}

/**
 * Obtiene la configuración dinámica.
 */
export async function getDynamicConfig() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getConfigs`);
    const data = await response.json();
    return data.status === 'success' ? data.data : {};
  } catch (error) {
    return {};
  }
}

/**
 * Obtiene el mapeo de teléfonos de un grupo.
 */
export async function getPhoneMapping(groupName) {
  try {
    const url = groupName ? `${SCRIPT_URL}?action=getPhoneMapping&groupName=${encodeURIComponent(groupName)}` : `${SCRIPT_URL}?action=getPhoneMapping`;
    const response = await fetch(url);
    const data = await response.json();
    return data.status === 'success' ? data.data : {};
  } catch (error) {
    return {};
  }
}
