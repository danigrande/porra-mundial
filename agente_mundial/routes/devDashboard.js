// ============================================
// DEV DASHBOARD — Rutas protegidas para el developer
// ============================================

import express from 'express';
import mongoose from 'mongoose';
import { AILog } from '../models/AILog.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Summary } from '../models/Summary.js';
import config from '../config.js';

const router = express.Router();

// ==========================================
// MIDDLEWARE: Protección con DEV_KEY
// ==========================================
router.use((req, res, next) => {
  const devKey = req.headers['x-dev-key'] || req.query.key;
  const expectedKey = process.env.DEV_DASHBOARD_KEY;
  
  if (!expectedKey) {
    return res.status(503).json({ error: 'DEV_DASHBOARD_KEY no configurada en el servidor' });
  }
  
  if (devKey !== expectedKey) {
    return res.status(401).json({ error: 'Clave de developer incorrecta' });
  }
  
  next();
});

// ==========================================
// HEALTH — Estado de todos los servicios
// ==========================================
router.get('/health', async (req, res) => {
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    // Contar documentos en colecciones principales
    let dbStats = {};
    if (mongoState === 1) {
      const [messages, users, groups, summaries, aiLogs] = await Promise.all([
        Message.countDocuments(),
        User.countDocuments(),
        Group.countDocuments(),
        Summary.countDocuments(),
        AILog.countDocuments()
      ]);
      dbStats = { messages, users, groups, summaries, aiLogs };
    }
    
    // Memoria del proceso
    const memUsage = process.memoryUsage();
    
    res.json({
      status: 'ok',
      services: {
        mongodb: {
          state: mongoStates[mongoState] || 'unknown',
          connected: mongoState === 1,
          collections: dbStats
        },
        groq: {
          configured: !!config.groq.apiKey,
          model: config.groq.model,
          temperature: config.groq.temperature,
          maxTokens: config.groq.maxTokens
        },
        huggingface: {
          configured: !!process.env.HUGGINGFACEHUB_API_KEY,
          embeddingsActive: !!process.env.HUGGINGFACEHUB_API_KEY
        },
        server: {
          uptime: Math.floor(process.uptime()),
          uptimeFormatted: formatUptime(process.uptime()),
          memoryMB: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
          },
          nodeVersion: process.version,
          platform: process.platform
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AI LOGS — Lista paginada de interacciones
// ==========================================
router.get('/logs', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      playerName, 
      type, 
      source,
      fromDate,
      toDate 
    } = req.query;
    
    const filter = {};
    if (playerName) filter.playerName = { $regex: playerName, $options: 'i' };
    if (type) filter.type = type;
    if (source) filter.source = source;
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [logs, total] = await Promise.all([
      AILog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-systemPrompt -userPrompt -ragContext -groqResponse'), // Excluir campos grandes en la lista
      AILog.countDocuments(filter)
    ]);
    
    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AI LOG DETAIL — Detalle completo de un log
// ==========================================
router.get('/logs/:id', async (req, res) => {
  try {
    const log = await AILog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: 'Log no encontrado' });
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RAG MESSAGES — Explorar mensajes del RAG
// ==========================================
router.get('/rag/messages', async (req, res) => {
  try {
    const { 
      senderName, 
      chatId, 
      search,
      page = 1, 
      limit = 30 
    } = req.query;
    
    const filter = {};
    if (senderName) filter.senderName = { $regex: senderName, $options: 'i' };
    if (chatId) filter.chatId = chatId;
    if (search) filter.text = { $regex: search, $options: 'i' };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-embedding'), // No enviar vectores al dashboard
      Message.countDocuments(filter)
    ]);
    
    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RAG STATS — Estadísticas del RAG
// ==========================================
router.get('/rag/stats', async (req, res) => {
  try {
    const [totalMessages, bySender, byDay] = await Promise.all([
      Message.countDocuments(),
      
      // Mensajes por remitente
      Message.aggregate([
        { $group: { _id: '$senderName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),
      
      // Mensajes por día (últimos 30 días)
      Message.aggregate([
        { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, 
          count: { $sum: 1 } 
        }},
        { $sort: { _id: 1 } }
      ])
    ]);
    
    res.json({
      totalMessages,
      bySender,
      byDay
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// USAGE — Métricas de uso de Groq
// ==========================================
router.get('/usage', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const [today, week, month, byType, byDay, avgLatency] = await Promise.all([
      // Tokens hoy
      AILog.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, totalTokens: { $sum: '$tokensUsed' }, calls: { $sum: 1 } } }
      ]),
      
      // Tokens esta semana
      AILog.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { _id: null, totalTokens: { $sum: '$tokensUsed' }, calls: { $sum: 1 } } }
      ]),
      
      // Tokens este mes
      AILog.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: null, totalTokens: { $sum: '$tokensUsed' }, calls: { $sum: 1 } } }
      ]),
      
      // Desglose por tipo
      AILog.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { 
          _id: '$type', 
          calls: { $sum: 1 }, 
          tokens: { $sum: '$tokensUsed' },
          avgLatency: { $avg: '$latencyMs' }
        }}
      ]),
      
      // Tokens por día (últimos 7 días)
      AILog.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, 
          tokens: { $sum: '$tokensUsed' },
          calls: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      
      // Latencia media global
      AILog.aggregate([
        { $match: { createdAt: { $gte: weekStart }, latencyMs: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$latencyMs' }, max: { $max: '$latencyMs' }, min: { $min: '$latencyMs' } } }
      ])
    ]);
    
    res.json({
      today: today[0] || { totalTokens: 0, calls: 0 },
      week: week[0] || { totalTokens: 0, calls: 0 },
      month: month[0] || { totalTokens: 0, calls: 0 },
      byType,
      byDay,
      latency: avgLatency[0] || { avg: 0, max: 0, min: 0 },
      limits: {
        // Groq free tier limits (aproximados)
        dailyRequests: 14400,
        tokensPerMinute: 500000,
        note: 'Límites del tier gratuito de Groq (llama-3.3-70b)'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// HELPERS
// ==========================================

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export default router;
