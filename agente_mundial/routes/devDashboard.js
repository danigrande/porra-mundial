// ============================================
// DEV DASHBOARD — Rutas protegidas para el developer
// ============================================

import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { AILog } from '../models/AILog.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Summary } from '../models/Summary.js';
import { Prediction } from '../models/Prediction.js';
import { BlockedUser } from '../models/BlockedUser.js';
import { Report } from '../models/Report.js';
import { PushToken } from '../models/PushToken.js';
import { Feedback } from '../models/Feedback.js';
import { PRD } from '../models/PRD.js';
import { runLangFlow, extractPRDFromAnalysis } from '../langflowService.js';
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
        socketio: {
          active: !!req.app.get('io'),
          clients: req.app.get('io')?.engine?.clientsCount || 0
        },
        rss: {
          enabled: config.rss.enabled,
          pollIntervalMinutes: config.rss.pollIntervalMs / 60000,
          feeds: config.rss.feeds.length
        },
        tavily: {
          enabled: config.webSearch.enabled,
          configured: !!config.webSearch.apiKey
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
// GROUPS — Listar todos los grupos con estadísticas
// ==========================================
router.get('/groups', async (req, res) => {
  try {
    const groups = await Group.find().populate('admin', 'name');
    
    const groupsWithStats = await Promise.all(groups.map(async (g) => {
      const [predictionCount, summaryCount] = await Promise.all([
        Prediction.countDocuments({ group: g._id }),
        Summary.countDocuments({ groupName: g.name })
      ]);
      
      return {
        _id: g._id,
        name: g.name,
        adminName: g.admin?.name || 'Unknown',
        memberCount: g.members?.length || 0,
        predictionCount,
        summaryCount,
        createdAt: g.createdAt
      };
    }));
    
    res.json(groupsWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GROUP DETAILS — Detalle completo de un grupo
// ==========================================
router.get('/groups/:name/details', async (req, res) => {
  try {
    const { name } = req.params;
    const group = await Group.findOne({ name }).populate('members', 'name email');
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    const [predictions, summaries] = await Promise.all([
      Prediction.find({ group: group._id }).populate('user', 'name'),
      Summary.find({ groupName: name })
    ]);

    res.json({
      group,
      predictions: predictions.map(p => ({
        _id: p._id,
        userName: p.user?.name || 'Unknown',
        updatedAt: p.updatedAt,
        data: p.predictions
      })),
      summaries: summaries.map(s => ({
        _id: s._id,
        playerName: s.playerName,
        updatedAt: s.updatedAt,
        text: s.text
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DELETE ACTIONS
// ==========================================

// Borrar una predicción específica
router.delete('/predictions/:id', async (req, res) => {
  try {
    await Prediction.findByIdAndDelete(req.params.id);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Borrar un resumen específico
router.delete('/summaries/:id', async (req, res) => {
  try {
    await Summary.findByIdAndDelete(req.params.id);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quitar un usuario de un grupo
router.delete('/groups/:groupName/members/:userName', async (req, res) => {
  try {
    const { groupName, userName } = req.params;
    const user = await User.findOne({ name: userName });
    const group = await Group.findOne({ name: groupName });

    if (user && group) {
      // Quitar del grupo
      group.members = group.members.filter(id => id.toString() !== user._id.toString());
      await group.save();
      
      // Quitar de los grupos del usuario
      user.groups = user.groups.filter(g => g !== groupName);
      await user.save();
    }
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Borrar grupo entero (Destructivo)
router.delete('/groups/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { cascade } = req.query; // 'true' para borrar todo lo relacionado

    const group = await Group.findOne({ name });
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    if (cascade === 'true') {
      // Borrar predicciones
      await Prediction.deleteMany({ group: group._id });
      // Borrar resúmenes
      await Summary.deleteMany({ groupName: name });
      // Borrar logs de IA
      await AILog.deleteMany({ groupName: name });
      // Quitar el grupo de todos los usuarios
      await User.updateMany(
        { groups: name },
        { $pull: { groups: name, isAdminOf: name } }
      );
    }

    await Group.findByIdAndDelete(group._id);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar admin del grupo
router.post('/groups/:groupName/admin', async (req, res) => {
  try {
    const { groupName } = req.params;
    const { newAdminName } = req.body;
    
    const group = await Group.findOne({ name: groupName });
    const newAdmin = await User.findOne({ name: newAdminName });
    
    if (!group || !newAdmin) return res.status(404).json({ error: 'Grupo o Usuario no encontrado' });

    // Quitar de los antiguos admins (si los hubiera)
    if (group.admin) {
      await User.findByIdAndUpdate(group.admin, { $pull: { isAdminOf: groupName } });
    }

    // Actualizar grupo
    group.admin = newAdmin._id;
    await group.save();
    
    // Actualizar nuevo admin
    await User.findByIdAndUpdate(newAdmin._id, { $addToSet: { isAdminOf: groupName } });

    console.log(`👑 Nuevo admin para ${groupName}: ${newAdminName}`);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar todos los usuarios
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('name email nickname groups isAdminOf createdAt').lean();
    const usersWithStats = await Promise.all(users.map(async (u) => {
      const [predictionCount, messageCount] = await Promise.all([
        Prediction.countDocuments({ user: u._id }),
        Message.countDocuments({ senderId: u._id.toString() })
      ]);
      return {
        _id: u._id,
        name: u.name,
        email: u.email || '',
        nickname: u.nickname || '',
        groups: u.groups || [],
        isAdminOf: u.isAdminOf || [],
        predictionCount,
        messageCount,
        createdAt: u.createdAt
      };
    }));
    res.json(usersWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resetear contraseña de un usuario (Forzar a 'PrediccionMundial')
router.post('/users/:userName/reset-password', async (req, res) => {
  try {
    const { userName } = req.params;
    const user = await User.findOne({ name: userName });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.password = await bcrypt.hash('PrediccionMundial', 10);
    await user.save();
    
    console.log(`🔧 Contraseña reseteada a PrediccionMundial para ${userName}`);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Borrar usuario de la base de datos (borrado en cascada)
router.delete('/users/:userName', async (req, res) => {
  try {
    const { userName } = req.params;
    const userId = req.query.userId;
    
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ name: userName });
    }
    
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const userIdStr = user._id.toString();
    
    // 1. Borrar predicciones
    const delPredictions = await Prediction.deleteMany({ user: user._id });
    
    // 2. Borrar mensajes del chat
    const delMessages = await Message.deleteMany({ senderId: userIdStr });
    
    // 3. Borrar tokens de push
    const delTokens = await PushToken.deleteMany({ user: userIdStr });
    
    // 4. Borrar bloqueos (como blocker y como blocked)
    const delBlocks = await BlockedUser.deleteMany({
      $or: [{ blockerId: userIdStr }, { blockedId: userIdStr }]
    });
    
    // 5. Borrar reports (como reporter y como reported)
    const delReports = await Report.deleteMany({
      $or: [{ reporterId: userIdStr }, { reportedId: userIdStr }]
    });
    
    // 6. Eliminar de todos los grupos
    await Group.updateMany(
      { members: user._id },
      { $pull: { members: user._id } }
    );
    
    // 7. Si era admin de algún grupo, asignar nuevo admin o dejar sin admin
    await Group.updateMany(
      { admin: user._id },
      { $set: { admin: null } }
    );
    
    // 8. Borrar el usuario
    await User.findByIdAndDelete(user._id);
    
    console.log(`🗑️ Usuario "${userName}" (${userIdStr}) borrado en cascada:`);
    console.log(`   - ${delPredictions.deletedCount} predicciones`);
    console.log(`   - ${delMessages.deletedCount} mensajes`);
    console.log(`   - ${delTokens.deletedCount} push tokens`);
    console.log(`   - ${delBlocks.deletedCount} bloqueos`);
    console.log(`   - ${delReports.deletedCount} reports`);
    
    res.json({ status: 'ok', deleted: {
      predictions: delPredictions.deletedCount,
      messages: delMessages.deletedCount,
      tokens: delTokens.deletedCount,
      blocks: delBlocks.deletedCount,
      reports: delReports.deletedCount
    }});
  } catch (error) {
    console.error('Error borrando usuario:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SIMULATE TIME (Para Testing Opción B)
// ==========================================
import { setSimulatedTime, getTournamentState } from '../tournamentState.js';
import { getRssStats } from '../rssFeedService.js';
import { getWebSearchStats } from '../webSearchService.js';

router.post('/simulate-time', async (req, res) => {
  try {
    const { timeStr } = req.body;
    // Si timeStr está vacío, false o null, desactiva la simulación
    setSimulatedTime(timeStr);
    
    res.json({ 
      status: 'ok', 
      message: timeStr ? `Tiempo simulado a ${timeStr}` : 'Simulación de tiempo desactivada',
      newState: await getTournamentState()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RSS FEED STATS
// ==========================================
router.get('/rss-stats', async (req, res) => {
  try {
    res.json(getRssStats());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// WEB SEARCH (TAVILY) STATS
// ==========================================
router.get('/websearch-stats', async (req, res) => {
  try {
    res.json(getWebSearchStats());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// FEEDBACK — Listar feedback con filtros
// ==========================================
router.get('/feedback', async (req, res) => {
  try {
    const { priority, type, analyzed, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (priority) filter.priority = priority;
    if (type) filter.type = type;
    if (analyzed === 'true') filter.analyzedAt = { $ne: null };
    if (analyzed === 'false') filter.analyzedAt = null;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [feedback, total] = await Promise.all([
      Feedback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Feedback.countDocuments(filter)
    ]);

    res.json({
      feedback,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// FEEDBACK — Análisis individual con LangFlow
// ==========================================
router.post('/feedback/:id/analyze', async (req, res) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: 'Feedback no encontrado' });

    const result = await runLangFlow(`[${fb.type}] ${fb.subject}: ${fb.detail}`, fb._id);

    fb.analysis = result.raw || result.parsed?.analysis || '';
    fb.priority = result.parsed?.priority || 'P-PENDING';
    fb.priorityReason = result.parsed?.reason || '';
    fb.langflowRunId = result.raw?.substring(0, 50) || '';
    fb.analyzedAt = new Date();
    await fb.save();

    res.json({ feedback: fb, analysis: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// FEEDBACK — Análisis batch (todos los no analizados)
// ==========================================
router.post('/feedback/analyze-all', async (req, res) => {
  try {
    const unanalyzed = await Feedback.find({ analyzedAt: null }).sort({ voteCount: -1 });
    const results = [];

    for (const fb of unanalyzed) {
      const result = await runLangFlow(`[${fb.type}] ${fb.subject}: ${fb.detail}`, fb._id);
      fb.analysis = result.raw || result.parsed?.analysis || '';
      fb.priority = result.parsed?.priority || 'P-PENDING';
      fb.priorityReason = result.parsed?.reason || '';
      fb.analyzedAt = new Date();
      await fb.save();
      results.push({ feedbackId: fb._id, priority: fb.priority });
    }

    res.json({ analyzed: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// FEEDBACK — Editar campos de análisis manualmente
// ==========================================
router.put('/feedback/:id', async (req, res) => {
  try {
    const { priority, priorityReason, analysis } = req.body;
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: 'Feedback no encontrado' });

    if (priority) fb.priority = priority;
    if (priorityReason !== undefined) fb.priorityReason = priorityReason;
    if (analysis !== undefined) fb.analysis = analysis;
    await fb.save();

    res.json({ feedback: fb });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PRD — Listar PRDs
// ==========================================
router.get('/prds', async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [prds, total] = await Promise.all([
      PRD.find(filter).populate('feedbackId', 'subject type detail userName').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      PRD.countDocuments(filter)
    ]);

    res.json({ prds, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PRD — Generar PRD desde un feedback analizado
// ==========================================
router.post('/prds/generate/:feedbackId', async (req, res) => {
  try {
    const fb = await Feedback.findById(req.params.feedbackId);
    if (!fb) return res.status(404).json({ error: 'Feedback no encontrado' });
    if (!fb.analyzedAt) return res.status(400).json({ error: 'El feedback debe analizarse antes de generar PRD' });

    const analysisResult = await runLangFlow(`GENERATE PRD for: [${fb.priority}] ${fb.subject}: ${fb.detail}`, fb._id);
    const extracted = await extractPRDFromAnalysis(analysisResult.raw);

    const prdData = extracted || {
      title: fb.subject,
      problemStatement: fb.detail,
      proposedSolution: '',
      userImpact: '',
      technicalNotes: '',
      acceptanceCriteria: [],
      suggestedFiles: [],
      priority: fb.priority === 'P-PENDING' ? 'P2' : (fb.priority || 'P2'),
    };

    const prd = await PRD.create({
      feedbackId: fb._id,
      title: prdData.title,
      priority: prdData.priority,
      problemStatement: prdData.problemStatement,
      proposedSolution: prdData.proposedSolution,
      userImpact: prdData.userImpact,
      technicalNotes: prdData.technicalNotes,
      acceptanceCriteria: prdData.acceptanceCriteria,
      suggestedFiles: prdData.suggestedFiles,
      rawAnalysis: analysisResult.raw,
      langflowRunId: analysisResult.raw?.substring(0, 50) || '',
    });

    fb.prdGenerated = true;
    await fb.save();

    res.json({ prd });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PRD — Editar/Actualizar PRD (approve/reject/edit)
// ==========================================
router.put('/prds/:id', async (req, res) => {
  try {
    const allowed = ['title', 'status', 'priority', 'problemStatement', 'proposedSolution', 'userImpact', 'technicalNotes', 'acceptanceCriteria', 'suggestedFiles'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updatedAt = new Date();

    const prd = await PRD.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!prd) return res.status(404).json({ error: 'PRD no encontrado' });
    res.json({ prd });
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
