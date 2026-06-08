import RssParser from 'rss-parser';
import config from './config.js';
import { sendBotMessage } from './chatService.js';
import * as pushService from './pushService.js';
import { SeenArticle } from './models/SeenArticle.js';

const rssParser = new RssParser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  },
  timeout: 10000,
});

// Persistent tracking of seen articles via MongoDB
const seenGuids = new Set();
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const stats = {
  pollCount: 0,
  lastPollTime: null,
  articlesParsed: 0,
  worldCupArticles: 0,
  breakingNews: 0,
  broadcastsSent: 0,
  pushNotificationsSent: 0,
  errors: 0,
  recentBreaking: [], // last 10
};

let io = null;

export async function startRssService(socketIo) {
  if (!config.rss.enabled) {
    console.log('[RSS] Servicio deshabilitado en config');
    return;
  }

  io = socketIo;

  // Cargar GUIDs vistos desde MongoDB
  try {
    const existing = await SeenArticle.find({}, 'guid').lean();
    existing.forEach(a => seenGuids.add(a.guid));
    console.log(`[RSS] Cargados ${seenGuids.size} GUIDs de artículos vistos`);
  } catch (err) {
    console.error('[RSS] Error cargando GUIDs:', err.message);
  }

  console.log(`📡 RSS Service iniciado (cada ${config.rss.pollIntervalMs / 60000} min, ${config.rss.feeds.length} feeds)`);

  pollFeeds();
  setInterval(pollFeeds, config.rss.pollIntervalMs);
}

async function pollFeeds() {
  stats.pollCount++;
  stats.lastPollTime = new Date().toISOString();

  for (const feedUrl of config.rss.feeds) {
    try {
      const articles = await parseRSS(feedUrl);
      stats.articlesParsed += articles.length;

      const newArticles = articles.filter(a => !seenGuids.has(a.guid));

      for (const article of newArticles) {
        seenGuids.add(article.guid);
        try { await SeenArticle.create({ guid: article.guid, title: article.title }); } catch (e) { /* duplicado */ }

        if (!isWorldCupRelated(article)) continue;
        stats.worldCupArticles++;

        const isBreaking = await isBreakingNews(article);
        if (isBreaking) {
          stats.breakingNews++;
          stats.recentBreaking.unshift({
            title: article.title,
            link: article.link,
            source: feedUrl.substring(0, 40),
            time: new Date().toISOString(),
          });
          if (stats.recentBreaking.length > 10) stats.recentBreaking.pop();
          await broadcastBreakingNews(article);
        }
      }

      if (newArticles.length > 0) {
        console.log(`[RSS] ${newArticles.length} artículos nuevos de ${feedUrl.substring(0, 60)}...`);
      }
    } catch (err) {
      stats.errors++;
      console.error(`[RSS] Error en feed ${feedUrl.substring(0, 60)}:`, err.message);
    }
  }

  // Limpiar entradas antiguas de MongoDB
  try {
    const cutoff = new Date(Date.now() - MAX_AGE_MS);
    const deleted = await SeenArticle.deleteMany({ seenAt: { $lt: cutoff } });
    if (deleted.deletedCount > 0) {
      console.log(`[RSS] Limpiados ${deleted.deletedCount} GUIDs antiguos`);
      // Refrescar Set
      const remaining = await SeenArticle.find({}, 'guid').lean();
      seenGuids.clear();
      remaining.forEach(a => seenGuids.add(a.guid));
    }
  } catch (err) {
    console.error('[RSS] Error limpiando GUIDs:', err.message);
  }
}

async function parseRSS(feedUrl) {
  const feed = await rssParser.parseURL(feedUrl);
  return (feed.items || []).map(item => ({
    guid: item.guid || item.link || item.title,
    title: (item.title || '').trim(),
    content: (item.contentSnippet || item.content || item.description || '').trim(),
    link: (item.link || '').trim(),
    pubDate: item.pubDate || item.isoDate || null,
  }));
}

function isWorldCupRelated(article) {
  const text = `${article.title} ${article.content}`.toLowerCase();
  return config.rss.worldCupKeywords.some(keyword => text.includes(keyword));
}

function isBreakingNews(article) {
  const snippet = (article.content || '').substring(0, 500);
  const text = `${article.title} ${snippet}`.toLowerCase();

  const breakingKeywords = ['última hora', 'breaking', 'oficial', 'confirmado', 'lesión', 'gol', 'victoria', 'clasifica', 'elimina', 'sorteo', 'once titular', 'convocatoria', 'españa', 'selección española', 'de la fuente'];
  const isBreaking = breakingKeywords.some(k => text.includes(k));

  if (isBreaking) {
    console.log(`🚨 BREAKING: "${article.title.substring(0, 80)}"`);
  }

  return isBreaking;
}

async function broadcastBreakingNews(article) {
  const message = `🚨 NOTICIA DE ÚLTIMA HORA 🚨\n\n${article.title}\n\n${article.link}`;

  if (!io) {
    console.warn('[RSS] Socket.IO no disponible para broadcast');
    stats.errors++;
    return;
  }

  // Enviar a todos los grupos activos
  const rooms = io.sockets.adapter.rooms;
  for (const roomName of rooms.keys()) {
    if (roomName.startsWith('group:')) {
      const groupName = roomName.replace('group:', '');
      try {
        await sendBotMessage(groupName, message);
        stats.broadcastsSent++;
        console.log(`[RSS] Mensaje enviado al grupo ${groupName}`);
      } catch (err) {
        stats.errors++;
        console.error(`[RSS] Error enviando a grupo ${groupName}:`, err.message);
      }

      // También push notification a los miembros del grupo
      try {
        await pushService.sendToGroup(
          groupName,
          '🚨 Noticia de Última Hora',
          article.title.substring(0, 150),
          { screen: 'chat', groupName },
          null,
          true // es el agente (RSS)
        );
        stats.pushNotificationsSent++;
      } catch (err) {
        stats.errors++;
        console.error(`[RSS] Error push a grupo ${groupName}:`, err.message);
      }
    }
  }

  console.log(`📢 Breaking news broadcast complete: "${article.title.substring(0, 60)}"`);
}


export function getRssStats() {
  return {
    enabled: config.rss.enabled,
    feeds: config.rss.feeds.map(url => url.substring(0, 60)),
    pollIntervalMinutes: config.rss.pollIntervalMs / 60000,
    keywords: config.rss.worldCupKeywords,
    ...stats,
    seenArticlesCount: seenGuids.size,
    breakingFilter: 'Spain + World Cup + breaking',
  };
}
