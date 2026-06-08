import { Reality } from './models/Reality.js';
import { Group } from './models/Group.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES } from './shared_data.js';
import { fetchWorldCupJson, syncRealityFromOpenfootball } from './openfootballService.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000;

const TEAM_NAME_MAP = {
  'Mexico': 'México', 'South Africa': 'Sudáfrica', 'South Korea': 'Corea del Sur',
  'Czech Republic': 'República Checa', 'Canada': 'Canadá',
  'Bosnia-Herzegovina': 'Bosnia y Herzegovina', 'Bosnia & Herzegovina': 'Bosnia y Herzegovina', 'Qatar': 'Catar',
  'Switzerland': 'Suiza', 'Brazil': 'Brasil', 'Morocco': 'Marruecos',
  'Haiti': 'Haití', 'Scotland': 'Escocia', 'USA': 'Estados Unidos',
  'Paraguay': 'Paraguay', 'Australia': 'Australia', 'Turkey': 'Turquía',
  'Germany': 'Alemania', 'Curacao': 'Curazao', 'Curaçao': 'Curazao', 'Ivory Coast': 'Costa de Marfil',
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
    const openfootballData = await fetchWorldCupJson();
    const matches = openfootballData.matches || [];

    const completedMatches = matches.filter(m => m.score);
    if (completedMatches.length === 0) {
      console.log('[RealitySync] No hay partidos finalizados aún');
      return;
    }

    const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
    const currentReality = realityDoc ? realityDoc.results : { events: {} };

    const updatedResults = syncRealityFromOpenfootball(openfootballData, currentReality, FIXTURE_GROUPS, BRACKET_MATCHES, TEAM_NAME_MAP);

    const hasChanges = JSON.stringify(currentReality) !== JSON.stringify(updatedResults);
    if (!hasChanges) {
      console.log(`[RealitySync] ${completedMatches.length} partidos — sin cambios`);
      return;
    }

    await Reality.findOneAndUpdate(
      { tournament: 'worldcup2026' },
      { results: updatedResults, updatedAt: new Date() },
      { upsert: true }
    );

    const syncedCount = completedMatches.length;
    console.log(`[RealitySync] ${syncedCount} partidos sincronizados desde openfootball`);

    if (io) {
      io.emit('reality-updated', { count: syncedCount });
      await notifyGroups();
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.warn('[RealitySync] openfootball no disponible, reintentando en el próximo ciclo');
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
