import { Reality } from './models/Reality.js';
import { Group } from './models/Group.js';
import { fetchZafronixMatches, syncRealityFromZafronix } from './zafronixService.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000;

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
    const apiKey = process.env.ZAFRONIX_API_KEY;
    if (!apiKey) {
      console.warn('[RealitySync] ZAFRONIX_API_KEY no configurada');
      return;
    }

    const zafronixData = await fetchZafronixMatches(apiKey);
    const matches = zafronixData.data || [];

    const completedMatches = matches.filter(m => m.homeScore !== null);
    if (completedMatches.length === 0) {
      console.log('[RealitySync] No hay partidos finalizados aún');
      return;
    }

    const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
    const currentReality = realityDoc ? realityDoc.results : { events: {} };

    const updatedResults = syncRealityFromZafronix(zafronixData, currentReality);

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
    console.log(`[RealitySync] ${syncedCount} partidos sincronizados desde Zafronix`);

    if (io) {
      io.emit('reality-updated', { count: syncedCount });
      await notifyGroups();
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ERR_BAD_REQUEST') {
      console.warn('[RealitySync] Zafronix no disponible, reintentando en el próximo ciclo');
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
