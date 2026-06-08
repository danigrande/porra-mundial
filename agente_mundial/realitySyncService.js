import axios from 'axios';
import { Reality } from './models/Reality.js';
import { Group } from './models/Group.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES } from './shared_data.js';
import { syncRealityFromApi } from './apiFootballService.js';

const API_URL = 'https://v3.football.api-sports.io';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

const TEAM_NAME_MAP = {
  'Mexico': 'México', 'South Africa': 'Sudáfrica', 'South Korea': 'Corea del Sur',
  'Czech Republic': 'República Checa', 'Canada': 'Canadá',
  'Bosnia-Herzegovina': 'Bosnia y Herzegovina', 'Qatar': 'Catar',
  'Switzerland': 'Suiza', 'Brazil': 'Brasil', 'Morocco': 'Marruecos',
  'Haiti': 'Haití', 'Scotland': 'Escocia', 'USA': 'Estados Unidos',
  'Paraguay': 'Paraguay', 'Australia': 'Australia', 'Turkey': 'Turquía',
  'Germany': 'Alemania', 'Curacao': 'Curazao', 'Ivory Coast': 'Costa de Marfil',
  'Ecuador': 'Ecuador', 'Netherlands': 'Países Bajos', 'Japan': 'Japón',
  'Sweden': 'Suecia', 'Tunisia': 'Túnez', 'Belgium': 'Bélgica',
  'Egypt': 'Egipto', 'Iran': 'Irán', 'New Zealand': 'Nueva Zelanda',
  'Spain': 'España', 'Cape Verde': 'Cabo Verde', 'Saudi Arabia': 'Arabia Saudita',
  'Uruguay': 'Uruguay', 'France': 'Francia', 'Senegal': 'Senegal',
  'Iraq': 'Irak', 'Norway': 'Noruega', 'Argentina': 'Argentina',
  'Algeria': 'Argelia', 'Austria': 'Austria', 'Jordan': 'Jordania',
  'Portugal': 'Portugal', 'DR Congo': 'RD Congo', 'Uzbekistan': 'Uzbekistán',
  'Colombia': 'Colombia', 'England': 'Inglaterra', 'Croatia': 'Croacia',
  'Ghana': 'Ghana', 'Panama': 'Panamá',
};

let pollInterval = null;
let io = null;

export async function startRealitySync(socketIO) {
  io = socketIO;
  await syncResults();
  pollInterval = setInterval(syncResults, POLL_INTERVAL_MS);
  console.log(`[RealitySync] Sincronización cada ${POLL_INTERVAL_MS / 60000} minutos`);
}

export function stopRealitySync() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function syncResults() {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      console.warn('[RealitySync] API_FOOTBALL_KEY no configurada');
      return;
    }

    const response = await axios.get(`${API_URL}/fixtures`, {
      params: { league: 1, season: 2026, status: 'FT' },
      headers: { 'x-apisports-key': apiKey },
      timeout: 15000,
    });

    const fixtures = response.data?.response || [];
    if (fixtures.length === 0) {
      console.log('[RealitySync] No hay partidos finalizados aún');
      return;
    }

    const translatedFixtures = fixtures.map(f => ({
      ...f,
      teams: {
        home: { name: TEAM_NAME_MAP[f.teams.home.name] || f.teams.home.name },
        away: { name: TEAM_NAME_MAP[f.teams.away.name] || f.teams.away.name },
      }
    }));

    const apiResponse = { response: translatedFixtures };

    const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
    const currentReality = realityDoc ? realityDoc.results : { events: {} };

    const updatedResults = syncRealityFromApi(apiResponse, currentReality, FIXTURE_GROUPS, BRACKET_MATCHES);

    const hasChanges = JSON.stringify(currentReality) !== JSON.stringify(updatedResults);
    if (!hasChanges) return;

    await Reality.findOneAndUpdate(
      { tournament: 'worldcup2026' },
      { results: updatedResults, updatedAt: new Date() },
      { upsert: true }
    );

    console.log(`[RealitySync] ${fixtures.length} partidos sincronizados`);

    if (io) {
      io.emit('reality-updated', { count: fixtures.length });
      await notifyGroups();
    }
  } catch (error) {
    if (error.response?.status === 429) {
      console.warn('[RealitySync] Rate limit alcanzado');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.warn('[RealitySync] API no disponible, reintentando en el próximo ciclo');
    } else {
      console.error('[RealitySync] Error:', error.message);
    }
  }
}

async function notifyGroups() {
  try {
    const groups = await Group.find();
    for (const group of groups) {
      io.to(`group:${group.name}`).emit('scores-updated', { groupName: group.name });
    }
  } catch (e) {
    console.error('[RealitySync] Error notificando grupos:', e.message);
  }
}
