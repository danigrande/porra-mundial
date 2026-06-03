import RssParser from 'rss-parser';
import Groq from 'groq-sdk';
import config from './config.js';
import { sendBotMessage } from './chatService.js';
import * as pushService from './pushService.js';

const rssParser = new RssParser();
const groq = new Groq({ apiKey: config.groq.apiKey });

// In-memory tracking of seen articles: Map<guid, timestamp>
const seenArticles = new Map();
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let io = null;

export function startRssService(socketIo) {
  if (!config.rss.enabled) {
    console.log('[RSS] Servicio deshabilitado en config');
    return;
  }

  io = socketIo;
  console.log(`📡 RSS Service iniciado (cada ${config.rss.pollIntervalMs / 60000} min, ${config.rss.feeds.length} feeds)`);

  pollFeeds();
  setInterval(pollFeeds, config.rss.pollIntervalMs);
}

async function pollFeeds() {
  for (const feedUrl of config.rss.feeds) {
    try {
      const articles = await parseRSS(feedUrl);
      const newArticles = articles.filter(a => !seenArticles.has(a.guid));

      for (const article of newArticles) {
        seenArticles.set(article.guid, Date.now());

        if (!isWorldCupRelated(article)) continue;

        const isBreaking = await isBreakingNews(article);
        if (isBreaking) {
          await broadcastBreakingNews(article);
        }
      }

      if (newArticles.length > 0) {
        console.log(`[RSS] ${newArticles.length} artículos nuevos de ${feedUrl.substring(0, 60)}...`);
      }
    } catch (err) {
      console.error(`[RSS] Error en feed ${feedUrl.substring(0, 60)}:`, err.message);
    }
  }

  // Limpiar entradas antiguas
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [guid, ts] of seenArticles) {
    if (ts < cutoff) seenArticles.delete(guid);
  }
}

async function parseRSS(feedUrl) {
  const feed = await rssParser.parseURL(feedUrl);
  return (feed.items || []).map(item => ({
    guid: item.guid || item.link || item.title,
    title: item.title || '',
    content: item.contentSnippet || item.content || item.description || '',
    link: item.link || '',
    pubDate: item.pubDate || item.isoDate || null,
  }));
}

function isWorldCupRelated(article) {
  const text = `${article.title} ${article.content}`.toLowerCase();
  return config.rss.worldCupKeywords.some(keyword => text.includes(keyword));
}

async function isBreakingNews(article) {
  try {
    const snippet = (article.content || '').substring(0, 500);

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a sports news classifier. Respond with ONLY a single word: YES or NO.',
        },
        {
          role: 'user',
          content: `Is this news article about a breaking or important development regarding the FIFA World Cup that users of a World Cup prediction pool should know about?

Title: ${article.title}
Content: ${snippet}`,
        },
      ],
      model: config.groq.model,
      temperature: 0.1,
      max_tokens: 10,
    });

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
    const isBreaking = answer === 'YES';

    if (isBreaking) {
      console.log(`🚨 BREAKING: "${article.title.substring(0, 80)}"`);
    }

    return isBreaking;
  } catch (error) {
    console.error('[RSS] Error clasificando artículo:', error.message);
    return false;
  }
}

async function broadcastBreakingNews(article) {
  const message = `🚨 NOTICIA DE ÚLTIMA HORA 🚨\n\n${article.title}\n\n${article.link}`;

  if (!io) {
    console.warn('[RSS] Socket.IO no disponible para broadcast');
    return;
  }

  // Enviar a todos los grupos activos
  const rooms = io.sockets.adapter.rooms;
  for (const roomName of rooms.keys()) {
    if (roomName.startsWith('group:')) {
      const groupName = roomName.replace('group:', '');
      try {
        await sendBotMessage(groupName, message);
        console.log(`[RSS] Mensaje enviado al grupo ${groupName}`);
      } catch (err) {
        console.error(`[RSS] Error enviando a grupo ${groupName}:`, err.message);
      }

      // También push notification a los miembros del grupo
      try {
        await pushService.sendToGroup(
          groupName,
          '🚨 Noticia de Última Hora',
          article.title.substring(0, 150),
          { screen: 'chat', groupName }
        );
      } catch (err) {
        console.error(`[RSS] Error push a grupo ${groupName}:`, err.message);
      }
    }
  }

  console.log(`📢 Breaking news broadcast complete: "${article.title.substring(0, 60)}"`);
}
