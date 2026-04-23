// ============================================
// DATA FETCHER — Obtiene datos de Google Sheets
// ============================================
// Reutiliza tu Google Apps Script existente como fuente de datos.

import config from './config.js';

const SCRIPT_URL = config.googleScript.url;

/**
 * Obtiene todas las predicciones de todos los jugadores.
 * Retorna: { "Dani": { timestamp, predictions: {...} }, ... }
 */
export async function getAllPredictions() {
  try {
    const response = await fetch(SCRIPT_URL);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data || {};
    }
    console.error('Error en getAllPredictions:', data.message);
    return {};
  } catch (error) {
    console.error('Error fetching predictions:', error.message);
    return {};
  }
}

/**
 * Obtiene los perfiles de personalidad de todos los jugadores desde Google Sheets.
 * Retorna: { "Dani": { nickname, likes, dislikes, humor_style }, ... }
 */
export async function getAllProfiles() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getAllInfo`);
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
 * Obtiene los resúmenes IA guardados previamente.
 * Retorna: { "Dani": "resumen texto...", ... }
 */
export async function getAllSummaries() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getAllSummaries`);
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
 * Obtiene la lista de nombres de jugadores registrados.
 */
export async function getPlayerList() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getPlayers`);
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
 * Guarda un resumen IA en Google Sheets.
 */
export async function saveSummary(playerName, summaryText) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveSummary',
        playerName,
        summary: summaryText,
      }),
    });
  } catch (error) {
    console.error('Error saving summary:', error.message);
  }
}

/**
 * Obtiene el perfil de un jugador específico.
 * Primero intenta Google Sheets, luego usa el respaldo local de config.js.
 */
export async function getPlayerProfile(playerName) {
  const remoteProfiles = await getAllProfiles();
  if (remoteProfiles[playerName]) {
    return remoteProfiles[playerName];
  }
  // Fallback al perfil local
  return config.playerProfiles[playerName] || {
    nickname: playerName,
    likes: ['Fútbol'],
    dislikes: ['Perder'],
    humor_style: 'Divertido y amigable',
  };
}

/**
 * Obtiene la configuración dinámica (como GROUP_ID) desde Google Sheets.
 */
export async function getDynamicConfig() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getConfigs`);
    const data = await response.json();
    return data.status === 'success' ? data.data : {};
  } catch (error) {
    console.error('Error fetching dynamic configs:', error.message);
    return {};
  }
}

/**
 * Obtiene el mapeo de teléfonos a jugadores desde Google Sheets.
 */
export async function getPhoneMapping() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getPhoneMapping`);
    const data = await response.json();
    return data.status === 'success' ? data.data : {};
  } catch (error) {
    console.error('Error fetching phone mapping:', error.message);
    return {};
  }
}
