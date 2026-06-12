import { Reality } from './models/Reality.js';
import { Group } from './models/Group.js';
import { fetchZafronixMatches, syncRealityFromZafronix } from './zafronixService.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const WATCHDOG_INTERVAL_MS = 60 * 1000;
const STALE_THRESHOLD_MS = POLL_INTERVAL_MS * 2.5;

let pollInterval = null;
let watchdogInterval = null;
let io = null;
let lastSyncTime = 0;
let watchdogStarted = false;

export const syncStatus = {
  lastSyncTime: null,
  lastSyncResult: 'never',
  lastSyncError: null,
  zafronixMatchCount: 0,
  realityMatchCount: 0,
  pollIntervalMs: POLL_INTERVAL_MS,
  isPollingActive: false,
};

export async function startRealitySync(socketIO) {
  io = socketIO;
  await syncResults();
  stopPollInterval();
  pollInterval = setInterval(syncResults, POLL_INTERVAL_MS);
  syncStatus.isPollingActive = true;
  startWatchdog();
  console.log(`[RealitySync] Sincronización cada ${POLL_INTERVAL_MS / 60000} minutos`);
}

export function stopRealitySync() {
  stopPollInterval();
  stopWatchdog();
  syncStatus.isPollingActive = false;
}

function stopPollInterval() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function startWatchdog() {
  if (watchdogStarted) return;
  watchdogStarted = true;
  watchdogInterval = setInterval(() => {
    if (lastSyncTime === 0) return;
    const elapsed = Date.now() - lastSyncTime;
    if (elapsed > STALE_THRESHOLD_MS) {
      console.warn(
        `[RealitySync] ⚠️ Watchdog: ${Math.round(elapsed / 1000 / 60)} minutos sin sync (umbral: ${STALE_THRESHOLD_MS / 1000 / 60} min). Re-ejecutando...`
      );
      syncStatus.lastSyncResult = 'stale';
      syncStatus.lastSyncError = `Sin sync por ${Math.round(elapsed / 1000 / 60)} min`;
      syncResults().catch(e =>
        console.error('[RealitySync] Watchdog error en syncResults:', e.message)
      );
    }
  }, WATCHDOG_INTERVAL_MS);
}

function stopWatchdog() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  watchdogStarted = false;
}

async function syncResults() {
  try {
    const apiKey = process.env.ZAFRONIX_API_KEY;
    if (!apiKey) {
      console.warn('[RealitySync] ZAFRONIX_API_KEY no configurada');
      syncStatus.lastSyncResult = 'error';
      syncStatus.lastSyncError = 'ZAFRONIX_API_KEY no configurada';
      return;
    }

    const zafronixData = await fetchZafronixMatches(apiKey);
    const matches = zafronixData.data || [];

    const completedMatches = matches.filter(m => m.homeScore !== null);
    syncStatus.zafronixMatchCount = completedMatches.length;

    if (completedMatches.length === 0) {
      console.log('[RealitySync] No hay partidos finalizados aún');
      lastSyncTime = Date.now();
      syncStatus.lastSyncTime = new Date(lastSyncTime).toISOString();
      syncStatus.lastSyncResult = 'no_matches';
      syncStatus.lastSyncError = null;
      return;
    }

    const matchIds = completedMatches.map(m => m.matchNo).join(',');
    console.log(`[RealitySync] ${completedMatches.length} partidos finalizados en Zafronix: [${matchIds}]`);

    const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
    const currentReality = realityDoc ? realityDoc.results : { events: {} };

    const updatedResults = syncRealityFromZafronix(zafronixData, currentReality);

    const hasChanges = JSON.stringify(currentReality) !== JSON.stringify(updatedResults);
    if (!hasChanges) {
      console.log(`[RealitySync] ${completedMatches.length} partidos — sin cambios [${matchIds}]`);
      lastSyncTime = Date.now();
      syncStatus.lastSyncTime = new Date(lastSyncTime).toISOString();
      syncStatus.lastSyncResult = 'no_changes';
      syncStatus.lastSyncError = null;
      return;
    }

    const changedKeys = [];
    if (currentReality) {
      const allKeys = new Set([...Object.keys(currentReality), ...Object.keys(updatedResults)]);
      for (const key of allKeys) {
        if (key === 'events') continue;
        if (JSON.stringify(currentReality[key]) !== JSON.stringify(updatedResults[key])) {
          changedKeys.push(`${key}: ${currentReality[key] ?? '—'} → ${updatedResults[key] ?? '—'}`);
        }
      }
    }

    await Reality.findOneAndUpdate(
      { tournament: 'worldcup2026' },
      { results: updatedResults, updatedAt: new Date() },
      { upsert: true }
    );

    const syncedCount = completedMatches.length;
    syncStatus.realityMatchCount = Object.keys(updatedResults).filter(k => k.match(/^g[A-Z]_m\d_[ha]$/) || k.match(/^ko_\d+_[ha]$/)).length;

    console.log(`[RealitySync] ✅ ${syncedCount} partidos sincronizados desde Zafronix`);
    if (changedKeys.length > 0) {
      console.log(`[RealitySync] Cambios (${changedKeys.length}):`);
      changedKeys.forEach(k => console.log(`  ${k}`));
    }

    if (io) {
      io.emit('reality-updated', { count: syncedCount });
      await notifyGroups();
    }

    lastSyncTime = Date.now();
    syncStatus.lastSyncTime = new Date(lastSyncTime).toISOString();
    syncStatus.lastSyncResult = 'success';
    syncStatus.lastSyncError = null;
  } catch (error) {
    lastSyncTime = Date.now();
    syncStatus.lastSyncTime = new Date(lastSyncTime).toISOString();
    syncStatus.lastSyncResult = 'error';
    syncStatus.lastSyncError = error.message;

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
