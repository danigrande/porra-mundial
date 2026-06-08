import RssParser from 'rss-parser';
import config from './config.js';
import { sendBotMessage } from './chatService.js';
import * as pushService from './pushService.js';
import { SeenArticle } from './models/SeenArticle.js';

const rssParser = new RssParser();

// Persistent tracking of seen articles via MongoDB
const seenGuids = new Set();
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Daily articles for end-of-day summary
const dailyArticles = [];

// Stats for dev dashboard
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
  summariesSent: 0,
  summaryArticles: 0,
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
  scheduleDailySummary();
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

        // Guardar para resumen diario
        dailyArticles.push({
          guid: article.guid,
          title: article.title,
          content: article.content,
          link: article.link,
          source: feedUrl.substring(0, 40),
          time: new Date().toISOString(),
        });

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

async function classifyWithGroq(systemPrompt, userPrompt) {
  const apiKey = config.groq.apiKey;
  if (!apiKey) {
    console.warn('[RSS] GROQ_API_KEY no configurada');
    return null;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.groq.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(no body)');
      console.error(`[RSS] Groq API error ${response.status}: ${body.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim().toUpperCase() || null;
  } catch (error) {
    if (error.name === 'TimeoutError' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.warn('[RSS] Groq API timeout');
    } else if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
      console.warn('[RSS] Groq API no disponible (error de red)');
    } else {
      console.error('[RSS] Error en Groq API:', error.message?.substring(0, 200) || error);
    }
    return null;
  }
}

async function isBreakingNews(article) {
  const snippet = (article.content || '').substring(0, 500);
  const text = `${article.title} ${snippet}`.toLowerCase();

  const groqAnswer = await classifyWithGroq(
    'You are a sports news classifier. Respond with ONLY a single word: YES or NO.',
    `Is this about the Spanish national team and is it a breaking or important development regarding the FIFA World Cup that users of a World Cup prediction pool should know about?

Title: ${article.title}
Content: ${snippet}`
  );

  if (groqAnswer === 'YES') {
    console.log(`🚨 BREAKING: "${article.title.substring(0, 80)}"`);
    return true;
  }

  if (groqAnswer === null) {
    const breakingKeywords = ['última hora', 'breaking', 'oficial', 'confirmado', 'lesión', 'gol', 'victoria', 'clasifica', 'elimina', 'sorteo', 'once titular', 'convocatoria', 'españa', 'selección española', 'de la fuente'];
    const hasBreakingKeyword = breakingKeywords.some(k => text.includes(k));
    return hasBreakingKeyword;
  }

  return false;
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

// ==========================================
// Daily summary at 23:59
// ==========================================

function scheduleDailySummary() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(23, 59, 0, 0);

  let msUntil = target - now;
  if (msUntil <= 0) {
    target.setDate(target.getDate() + 1);
    msUntil = target - now;
  }

  console.log(`📅 Resumen diario programado para las 23:59 (en ${Math.round(msUntil / 60000)} min)`);

  setTimeout(async () => {
    await sendDailySummary();
    scheduleDailySummary(); // reprogramar para el día siguiente
  }, msUntil);
}

async function isRelevantForSummary(article) {
  const snippet = (article.content || '').substring(0, 500);
  const text = `${article.title} ${snippet}`.toLowerCase();

  const groqAnswer = await classifyWithGroq(
    'You are a sports news classifier. Respond with ONLY a single word: YES or NO.',
    `Is this news article relevant to the FIFA World Cup that users of a World Cup prediction pool should know about?

Title: ${article.title}
Content: ${snippet}`
  );

  if (groqAnswer !== null) return groqAnswer === 'YES';

  const relevantKeywords = ['mundial', 'world cup', '2026', 'espana', 'mexico', 'usa', 'canada', 'seleccion', 'partido', 'gol', 'clasificacion', 'futbol'];
  return relevantKeywords.some(k => text.includes(k));
}

async function sendDailySummary() {
  if (dailyArticles.length === 0) {
    console.log('[RSS] No hay artículos para el resumen diario');
    return;
  }

  console.log(`📅 Preparando resumen diario de ${dailyArticles.length} artículos candidatos...`);

  // Clasificar cada artículo de hoy con prompt relajado (sin filtro España)
  const relevant = [];
  for (const article of dailyArticles) {
    const ok = await isRelevantForSummary(article);
    if (ok) relevant.push(article);
  }

  // Vaciar el array para el día siguiente
  dailyArticles.length = 0;

  if (relevant.length === 0) {
    console.log('[RSS] Ningún artículo relevante para el resumen diario');
    return;
  }

  // Limitar a 8 artículos
  const top = relevant.slice(0, 8);

  // Construir mensaje
  const dateStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  let message = `📰 *RESUMEN INFORMATIVO — ${dateStr}* 📰\n\nLas noticias más relevantes del día sobre el Mundial:\n\n`;
  top.forEach((a, i) => {
    message += `${i + 1}. *${a.title}*\n${a.link}\n\n`;
  });
  message += `🤖 Generado automáticamente por el bot de la porra`;

  if (!io) {
    console.warn('[RSS] Socket.IO no disponible para resumen diario');
    return;
  }

  const rooms = io.sockets.adapter.rooms;
  for (const roomName of rooms.keys()) {
    if (roomName.startsWith('group:')) {
      const groupName = roomName.replace('group:', '');
      try {
        await sendBotMessage(groupName, message);
        stats.summariesSent++;
        console.log(`[RSS] Resumen enviado al grupo ${groupName}`);
      } catch (err) {
        stats.errors++;
        console.error(`[RSS] Error enviando resumen a grupo ${groupName}:`, err.message);
      }
    }
  }

  stats.summaryArticles += top.length;
  console.log(`📅 Resumen diario enviado: ${top.length} artículos a ${rooms.size} grupos`);
}

export function getRssStats() {
  return {
    enabled: config.rss.enabled,
    feeds: config.rss.feeds.map(url => url.substring(0, 60)),
    pollIntervalMinutes: config.rss.pollIntervalMs / 60000,
    keywords: config.rss.worldCupKeywords,
    ...stats,
    seenArticlesCount: seenGuids.size,
    dailyArticlesPending: dailyArticles.length,
    breakingFilter: 'Spain + World Cup + breaking',
    summaryFilter: 'World Cup relevant (no Spain filter)',
    summaryTime: '23:59 daily',
  };
}
