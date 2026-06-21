// ============================================
// DEV DASHBOARD — Rutas protegidas para el developer
// ============================================

import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
import { EvalRun } from '../models/EvalRun.js';
import { HumanReview } from '../models/HumanReview.js';
import { runLangFlow, extractPRDFromAnalysis } from '../langflowService.js';
import config from '../config.js';
import { setSimulatedTime, getTournamentState } from '../tournamentState.js';
import { getRssStats } from '../rssFeedService.js';
import { getWebSearchStats } from '../webSearchService.js';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: config.groq.apiKey });

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
// EVALS — Stats y logs de calidad de respuestas
// ==========================================

/**
 * GET /evals/stats — Métricas agregadas de calidad
 * Devuelve: pass rate, scores medios, breakdown por idioma y personalidad
 */
router.get('/evals/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const [overview, byLanguage, byPersonality, failedRecent, transcreationStats] = await Promise.all([

      // Overview global
      AILog.aggregate([
        { $match: { createdAt: { $gte: since }, evalPassed: { $exists: true }, evalSkipped: { $ne: true } } },
        { $group: {
          _id: null,
          totalEvals: { $sum: 1 },
          passed: { $sum: { $cond: ['$evalPassed', 1, 0] } },
          failed: { $sum: { $cond: ['$evalPassed', 0, 1] } },
          avgLangPurity: { $avg: '$evalScores.language_purity' },
          avgQuality: { $avg: '$evalScores.quality' },
          avgAttempts: { $avg: '$evalAttempts' }
        }}
      ]),

      // Breakdown por idioma
      AILog.aggregate([
        { $match: { createdAt: { $gte: since }, evalPassed: { $exists: true }, evalSkipped: { $ne: true } } },
        { $group: {
          _id: '$targetLanguage',
          total: { $sum: 1 },
          passed: { $sum: { $cond: ['$evalPassed', 1, 0] } },
          avgLangPurity: { $avg: '$evalScores.language_purity' },
          avgQuality: { $avg: '$evalScores.quality' }
        }},
        { $sort: { total: -1 } }
      ]),

      // Breakdown por personalidad
      AILog.aggregate([
        { $match: { createdAt: { $gte: since }, evalPassed: { $exists: true }, evalSkipped: { $ne: true }, anchorsUsed: { $ne: '' } } },
        { $group: {
          _id: '$anchorsUsed',
          total: { $sum: 1 },
          passed: { $sum: { $cond: ['$evalPassed', 1, 0] } },
          avgLangPurity: { $avg: '$evalScores.language_purity' },
          avgQuality: { $avg: '$evalScores.quality' }
        }},
        { $sort: { total: -1 } }
      ]),

      // Últimos 5 fallos (para diagnóstico rápido)
      AILog.find({
        createdAt: { $gte: since },
        evalPassed: false,
        evalSkipped: { $ne: true }
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('playerName targetLanguage evalScores evalFeedback anchorsUsed createdAt'),

      // Stats de transcreación
      AILog.aggregate([
        { $match: { createdAt: { $gte: since }, wasTranscreated: true } },
        { $group: {
          _id: '$targetLanguage',
          total: { $sum: 1 },
          fallbacks: { $sum: { $cond: ['$transcreationFallback', 1, 0] } }
        }},
        { $sort: { total: -1 } }
      ])
    ]);

    const ov = overview[0] || { totalEvals: 0, passed: 0, failed: 0, avgLangPurity: 0, avgQuality: 0, avgAttempts: 1 };
    const passRate = ov.totalEvals > 0 ? Math.round((ov.passed / ov.totalEvals) * 100) : null;

    res.json({
      overview: {
        ...ov,
        passRate,
        period: `${days} días`
      },
      byLanguage,
      byPersonality,
      failedRecent,
      transcreationStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /evals — Log paginado de evaluaciones con filtros
 */
router.get('/evals', async (req, res) => {
  try {
    const { page = 1, limit = 25, passed, targetLanguage, playerName } = req.query;

    const filter = { evalPassed: { $exists: true } };
    if (passed !== undefined && passed !== '') filter.evalPassed = passed === 'true';
    if (targetLanguage) filter.targetLanguage = targetLanguage;
    if (playerName) filter.playerName = { $regex: playerName, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AILog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('playerName groupName targetLanguage evalScores evalFeedback evalPassed evalAttempts evalSkipped wasTranscreated transcreationFallback anchorsUsed latencyMs createdAt'),
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
// BENCHMARKS — Golden Dataset Eval Runs
// ==========================================

/**
 * GET /evals/runs — List all eval runs with pagination
 */
router.get('/evals/runs', async (req, res) => {
  try {
    const { page = 1, limit = 20, dataset } = req.query;
    const filter = {};
    if (dataset && dataset !== 'all') filter.datasets = dataset;

    const [runs, total] = await Promise.all([
      EvalRun.find(filter)
        .sort({ timestamp: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select('runId timestamp completedAt createdAt model temperature datasets totalTests passed failed passRate perDataset results comparisonWithPrevious error')
        .lean(),
      EvalRun.countDocuments(filter)
    ]);

    res.json({
      runs,
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

/**
 * GET /evals/runs/latest — Latest run with comparison data
 */
router.get('/evals/runs/latest', async (req, res) => {
  try {
    const run = await EvalRun.findOne({ error: { $exists: false } })
      .sort({ timestamp: -1 })
      .select('runId timestamp completedAt createdAt model temperature datasets totalTests passed failed passRate perDataset results comparisonWithPrevious error')
      .lean();
    res.json({ run: run || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /evals/runs/:runId — Full detail of a specific run
 */
router.get('/evals/runs/:runId', async (req, res) => {
  try {
    const id = req.params.runId;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isObjectId ? { _id: id } : { runId: id };
    const run = await EvalRun.findOne(query).lean();
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /evals/trends — Time-series data for charts
 */
router.get('/evals/trends', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const runs = await EvalRun.find({ error: { $exists: false } })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('runId timestamp createdAt model temperature totalTests passed failed passRate perDataset')
      .lean();

    const trends = runs.reverse().map(r => {
      let totalQ = 0, countQ = 0, totalL = 0, countL = 0;
      if (r.perDataset) {
        for (const ds of Object.values(r.perDataset)) {
          if (ds.avgQuality != null) { totalQ += ds.avgQuality; countQ++; }
          if (ds.avgLanguagePurity != null) { totalL += ds.avgLanguagePurity; countL++; }
        }
      }
      return {
        runId: r.runId,
        timestamp: r.timestamp,
        createdAt: r.createdAt,
        model: r.model,
        temperature: r.temperature,
        passRate: r.passRate,
        overallTotal: r.totalTests,
        overallPassed: r.passed,
        avgLanguagePurity: countL ? Math.round((totalL / countL) * 10) / 10 : 0,
        avgQuality: countQ ? Math.round((totalQ / countQ) * 10) / 10 : 0,
        perDataset: r.perDataset || {},
      };
    });

    res.json({ runs: trends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /evals/compare/:runIdA/:runIdB — Side-by-side comparison
 */
router.get('/evals/compare/:runIdA/:runIdB', async (req, res) => {
  try {
    async function findRun(id) {
      if (!id) return null;
      let run = await EvalRun.findById(id).lean();
      if (!run) run = await EvalRun.findOne({ runId: id }).lean();
      return run;
    }
    const [runA, runB] = await Promise.all([
      findRun(req.params.runIdA),
      findRun(req.params.runIdB)
    ]);

    if (!runA || !runB) {
      return res.status(404).json({ error: 'One or both runs not found' });
    }

    // Aggregate quality across all datasets
    function calcAvgQuality(perDataset) {
      if (!perDataset) return 0;
      let totalQ = 0, count = 0;
      for (const ds of Object.values(perDataset)) {
        if (ds.avgQuality != null) { totalQ += ds.avgQuality; count++; }
      }
      return count ? Math.round((totalQ / count) * 100) / 100 : 0;
    }
    function calcAvgLang(perDataset) {
      if (!perDataset) return 0;
      let totalL = 0, count = 0;
      for (const ds of Object.values(perDataset)) {
        if (ds.avgLanguagePurity != null) { totalL += ds.avgLanguagePurity; count++; }
      }
      return count ? Math.round((totalL / count) * 100) / 100 : 0;
    }
    const qualA = calcAvgQuality(runA.perDataset);
    const qualB = calcAvgQuality(runB.perDataset);
    const langA = calcAvgLang(runA.perDataset);
    const langB = calcAvgLang(runB.perDataset);

    const regressions = [];
    const improvements = [];
    const unchanged = [];

    // Compare individual test results if available
    if (runA.results && runB.results) {
      const mapB = {};
      runB.results.forEach(r => { mapB[r.testId] = r; });

      for (const resultA of runA.results) {
        const resultB = mapB[resultA.testId];
        if (!resultB) continue;

        if (resultA.passed !== resultB.passed) {
          const item = {
            testId: resultA.testId,
            dataset: resultA.dataset,
            type: 'pass_flip',
            before: resultA.passed ? 1 : 0,
            after: resultB.passed ? 1 : 0,
            qualBefore: resultA.scores?.quality,
            qualAfter: resultB.scores?.quality,
          };
          if (resultA.passed && !resultB.passed) regressions.push(item);
          else improvements.push(item);
        } else if (resultA.scores?.quality != null && resultB.scores?.quality != null && resultA.scores.quality !== resultB.scores.quality) {
          const item = {
            testId: resultA.testId,
            dataset: resultA.dataset,
            type: 'quality_change',
            before: resultA.scores.quality,
            after: resultB.scores.quality,
          };
          if (resultA.scores.quality > resultB.scores.quality) regressions.push(item);
          else improvements.push(item);
        } else {
          unchanged.push({ testId: resultA.testId, dataset: resultA.dataset });
        }
      }
    }

    res.json({
      runA: { runId: runA.runId, model: runA.model, temperature: runA.temperature, timestamp: runA.timestamp, passRate: runA.passRate, avgQuality: qualA, avgLanguagePurity: langA },
      runB: { runId: runB.runId, model: runB.model, temperature: runB.temperature, timestamp: runB.timestamp, passRate: runB.passRate, avgQuality: qualB, avgLanguagePurity: langB },
      comparison: {
        passRateDelta: Math.round(((runB.passRate || 0) - (runA.passRate || 0)) * 10) / 10,
        qualityDelta: Math.round((qualB - qualA) * 100) / 100,
        languageDelta: Math.round((langB - langA) * 100) / 100,
        regressions,
        improvements,
        unchanged,
        temperatureMismatch: runA.temperature !== runB.temperature
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /evals/run — Trigger a new benchmark run
 */
router.post('/evals/run', async (req, res) => {
  try {
    const { model, dataset = 'all', temperature = 0 } = req.body;
    const { spawn } = await import('child_process');
    const runId = crypto.randomUUID();

    const child = spawn('node', [
      'tests/evals/evalRunner.js',
      '--dataset', dataset,
      '--temperature', String(temperature),
      '--run-id', runId
    ].concat(model ? ['--model', model] : []), {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      cwd: process.cwd()
    });

    child.stdout.on('data', data => console.log(`[EvalRunner] ${data}`));
    child.stderr.on('data', data => console.error(`[EvalRunner] ${data}`));

    child.on('exit', (code) => {
      if (code !== 0) {
        EvalRun.updateOne({ runId }, { $set: { error: `Exited with code ${code}` } }).catch(() => {});
      }
    });

    child.on('error', (err) => {
      EvalRun.updateOne({ runId }, { $set: { error: err.message } }).catch(() => {});
    });

    res.json({ runId, status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /evals/coverage — Personality × language coverage map
 */
router.get('/evals/coverage', async (req, res) => {
  try {
    const filePath = process.cwd() + '/tests/evals/golden_datasets/personality_responses.json';
    let entries = [];
    try {
      entries = JSON.parse(require('fs').readFileSync(filePath, 'utf-8'));
    } catch (e) {
      return res.json({ coverage: [] });
    }

    const coverage = {};
    for (const entry of entries) {
      const key = `${entry.personalityId}_${entry.targetLanguage}`;
      if (!coverage[key]) coverage[key] = { personality: entry.personalityId, language: entry.targetLanguage, count: 0, intents: [] };
      coverage[key].count++;
      if (entry.query) {
        const intent = entry.id?.split('_').slice(1).join('_') || 'unknown';
        if (!coverage[key].intents.includes(intent)) coverage[key].intents.push(intent);
      }
    }

    res.json({ coverage: Object.values(coverage) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// HUMAN REVIEW — HITL Queue
// ==========================================

/**
 * GET /evals/hitl/pending — Pending human review items
 */
router.get('/evals/hitl/pending', async (req, res) => {
  try {
    const { page = 1, limit = 25, source, personality, status = 'pending' } = req.query;
    const filter = { status };
    if (source) filter.source = source;
    if (personality) filter.personalityId = personality;

    const [reviews, total] = await Promise.all([
      HumanReview.find(filter)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean(),
      HumanReview.countDocuments(filter)
    ]);

    res.json({
      reviews,
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

/**
 * GET /evals/hitl/stats — Agreement rate, FP/FN rates
 */
router.get('/evals/hitl/stats', async (req, res) => {
  try {
    const total = await HumanReview.countDocuments({ status: 'reviewed' });
    const agreements = await HumanReview.countDocuments({
      status: 'reviewed',
      $expr: { $eq: ['$humanPassed', '$judgePassed'] }
    });
    const disagreements = total - agreements;
    const agreementRate = total > 0 ? Math.round((agreements / total) * 100) : 0;

    const falsePositives = await HumanReview.countDocuments({
      status: 'reviewed',
      judgePassed: true,
      humanPassed: false
    });
    const falseNegatives = await HumanReview.countDocuments({
      status: 'reviewed',
      judgePassed: false,
      humanPassed: true
    });
    const totalJudgePassed = await HumanReview.countDocuments({ status: 'reviewed', judgePassed: true });
    const totalJudgeFailed = await HumanReview.countDocuments({ status: 'reviewed', judgePassed: false });

    const pending = await HumanReview.countDocuments({ status: 'pending' });

    const bySource = await HumanReview.aggregate([
      { $match: { status: 'reviewed' } },
      { $group: { _id: '$source', count: { $sum: 1 }, agreements: { $sum: { $cond: [{ $eq: ['$humanPassed', '$judgePassed'] }, 1, 0] } } } }
    ]);

    res.json({
      totalReviews: total,
      agreements,
      disagreements,
      agreementRate,
      falsePositives,
      falseNegatives,
      falsePositiveRate: totalJudgePassed > 0 ? Math.round((falsePositives / totalJudgePassed) * 100) : 0,
      falseNegativeRate: totalJudgeFailed > 0 ? Math.round((falseNegatives / totalJudgeFailed) * 100) : 0,
      pending,
      bySource
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /evals/hitl/:id/verdict — Submit a human review verdict
 */
router.post('/evals/hitl/:id/verdict', async (req, res) => {
  try {
    const { humanPassed, humanConfidence, humanScores, humanNotes, reviewedBy } = req.body;

    const review = await HumanReview.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    review.status = 'reviewed';
    review.humanPassed = humanPassed;
    if (humanConfidence !== undefined) review.humanConfidence = humanConfidence;
    if (humanScores) {
      if (humanScores.language_purity !== undefined) review.humanScores.language_purity = humanScores.language_purity;
      if (humanScores.quality !== undefined) review.humanScores.quality = humanScores.quality;
    }
    if (humanNotes) review.humanNotes = humanNotes;
    review.reviewedBy = reviewedBy || 'dashboard';
    review.reviewedAt = new Date();

    await review.save();

    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /evals/hitl/:id/promote — Promote a review to the golden dataset
 */
router.post('/evals/hitl/:id/promote', async (req, res) => {
  try {
    const review = await HumanReview.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.status !== 'reviewed') {
      return res.status(400).json({ error: 'Review must be in "reviewed" status to promote' });
    }

    const overrideEntry = {
      id: `promoted_${review._id}`,
      query: review.query,
      personalityId: review.personalityId,
      targetLanguage: review.targetLanguage,
      type: 'personality',
      mockContext: { leaderboard: [], playerStats: null },
      expectations: {
        minLanguagePurity: 8,
        minQuality: 6,
        maxLength: 500,
        mustNotContain: ['```', '##', '**']
      },
      goldenResponse: review.response,
      goldenJudgeScores: review.humanScores || review.judgeScores,
      tags: ['promoted'],
      source: 'promoted_from_hitl',
      promotedAt: new Date().toISOString()
    };

    const fs = await import('fs');
    const path = await import('path');
    const dir = process.cwd();
    const overridesPath = path.default.join(dir, 'tests/evals/golden_datasets/local_overrides.json');

    let overrides = [];
    try {
      overrides = JSON.parse(fs.default.readFileSync(overridesPath, 'utf-8'));
    } catch (e) { /* file doesn't exist yet */ }

    overrides.push(overrideEntry);
    fs.default.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2));

    review.status = 'promoted';
    review.promotedToGolden = true;
    review.goldenDatasetCategory = 'personality';
    await review.save();

    res.json({ success: true, entry: overrideEntry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RETENTION — Engagement analytics per group
// ==========================================
router.get('/analytics/retention', async (req, res) => {
  try {
    const { days = 30, groupName } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const matchFilter = groupName ? { groupName } : {};
    const logFilter = { createdAt: { $gte: since } };
    if (groupName) logFilter.groupName = groupName;

    // Active users: distinct users who sent messages or triggered bot
    const [activeUsersAgg, totalUsers, botCalls, trendAgg, groupComparison] = await Promise.all([
      // Active users per day for trend
      AILog.aggregate([
        { $match: { createdAt: { $gte: since }, playerName: { $exists: true, $ne: '' } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, users: { $addToSet: '$playerName' }, calls: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      // Total distinct users in period
      AILog.distinct('playerName', { createdAt: { $gte: since }, playerName: { $exists: true, $ne: '' } }),

      // Total bot calls in period
      AILog.countDocuments(logFilter),

      // Score trends per day
      AILog.aggregate([
        { $match: { createdAt: { $gte: since }, evalScores: { $exists: true }, evalSkipped: { $ne: true } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, avgScore: { $avg: '$evalScores.quality' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      // Group comparison (if not filtered to one group)
      !groupName ? AILog.aggregate([
        { $match: { createdAt: { $gte: since }, groupName: { $exists: true, $ne: '' } } },
        { $group: { _id: '$groupName', calls: { $sum: 1 }, players: { $addToSet: '$playerName' } } },
        { $project: { groupName: '$_id', calls: 1, activeUsers: { $size: '$players' }, _id: 0 } }
      ]) : Promise.resolve([])
    ]);

    // Build trend array merging active users, bot calls, and avg scores
    const userMap = {};
    activeUsersAgg.forEach(d => { userMap[d._id] = { users: d.users.length, calls: d.calls }; });
    const scoreMap = {};
    trendAgg.forEach(d => { scoreMap[d._id] = { avgScore: d.avgScore, evalCount: d.count }; });

    const allDates = [...new Set([...Object.keys(userMap), ...Object.keys(scoreMap)])].sort();
    const trend = allDates.map(date => ({
      date,
      activeUsers: userMap[date]?.users || 0,
      botCalls: userMap[date]?.calls || 0,
      avgScore: scoreMap[date]?.avgScore ? Math.round(scoreMap[date].avgScore * 10) / 10 : null,
      evalCount: scoreMap[date]?.evalCount || 0
    }));

    // Churn: users seen in first half but not in second half
    const midPoint = new Date(since.getTime() + (Date.now() - since.getTime()) / 2);
    const firstHalfUsers = await AILog.distinct('playerName', { createdAt: { $gte: since, $lt: midPoint }, playerName: { $exists: true, $ne: '' } });
    const secondHalfUsers = await AILog.distinct('playerName', { createdAt: { $gte: midPoint }, playerName: { $exists: true, $ne: '' } });
    const churnedUsers = firstHalfUsers.filter(u => !secondHalfUsers.includes(u));
    const retainedUsers = firstHalfUsers.filter(u => secondHalfUsers.includes(u));

    // Global averages for comparison
    let globalAgg = { avgCalls: 0, avgUsers: 0, avgRetention: 0 };
    if (!groupName && groupComparison.length > 0) {
      const totalCalls = groupComparison.reduce((s, g) => s + g.calls, 0);
      const totalUsers = groupComparison.reduce((s, g) => s + g.activeUsers, 0);
      const totalGroups = groupComparison.length;
      globalAgg = {
        avgCalls: totalGroups > 0 ? Math.round(totalCalls / totalGroups) : 0,
        avgUsers: totalGroups > 0 ? Math.round(totalUsers / totalGroups) : 0,
        avgRetention: totalUsers > 0 ? Math.round((retainedUsers.length / totalUsers) * 100) : 0
      };
    }

    res.json({
      period: `${days} días`,
      totalUsers: totalUsers.length,
      activeUsers: secondHalfUsers.length,
      retainedUsers: retainedUsers.length,
      churnedUsers: churnedUsers.length,
      retentionRate: totalUsers.length > 0 ? Math.round((retainedUsers.length / totalUsers.length) * 100) : 0,
      totalBotCalls: botCalls,
      avgBotCallsPerUser: totalUsers.length > 0 ? Math.round((botCalls / totalUsers.length) * 10) / 10 : 0,
      trend,
      groupComparison: groupComparison.map(g => ({
        ...g,
        retentionRate: g.activeUsers > 0 ? Math.round((retainedUsers.filter(u => g.players?.includes(u)).length / g.activeUsers) * 100) : 0
      })),
      globalAverages: globalAgg
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/usage', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const [today, week, month, byType, byDay, avgLatency, byModel] = await Promise.all([
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
      ]),

      // Desglose por modelo/proveedor (últimos 7 días)
      AILog.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { 
          _id: '$model', 
          calls: { $sum: 1 }, 
          tokens: { $sum: '$tokensUsed' },
          avgLatency: { $avg: '$latencyMs' }
        }},
        { $sort: { tokens: -1 } }
      ])
    ]);
    
    res.json({
      today: today[0] || { totalTokens: 0, calls: 0 },
      week: week[0] || { totalTokens: 0, calls: 0 },
      month: month[0] || { totalTokens: 0, calls: 0 },
      byType,
      byDay,
      byModel,
      latency: avgLatency[0] || { avg: 0, max: 0, min: 0 },
      limits: {
        dailyRequests: 14400,
        tokensPerMinute: 500000,
        note: 'Límites aproximados — los datos combinan HF + Groq'
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

// Resetear contraseña de un usuario (genera una aleatoria)
router.post('/users/:userName/reset-password', async (req, res) => {
  try {
    const { userName } = req.params;
    const user = await User.findOne({ name: userName });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const newPassword = crypto.randomBytes(4).toString('hex');
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    console.log(`🔧 Contraseña reseteada para ${userName}`);
    res.json({ status: 'ok', newPassword });
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
// ===========================================

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
// FEEDBACK — Detalle individual
// ==========================================
router.get('/feedback/:id', async (req, res) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: 'Feedback no encontrado' });
    res.json(fb);
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
// PRD — Detalle individual
// ==========================================
router.get('/prds/:id', async (req, res) => {
  try {
    const prd = await PRD.findById(req.params.id).populate('feedbackId', 'subject type detail userName');
    if (!prd) return res.status(404).json({ error: 'PRD no encontrado' });
    res.json(prd);
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
// DIAGNOSTICS — Pattern analysis + recommendations
// ==========================================

/**
 * GET /diagnostics — Aggregate AILog data by issue and personality
 */
router.get('/diagnostics', async (req, res) => {
  try {
    const { days = 7, personality } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const matchFilter = {
      createdAt: { $gte: since },
      evalPassed: { $exists: true },
      evalSkipped: { $ne: true }
    };
    if (personality) matchFilter.anchorsUsed = personality;

    // 1. Overview — global metrics
    const [overview] = await AILog.aggregate([
      { $match: matchFilter },
      { $group: {
        _id: null,
        totalEvaluations: { $sum: 1 },
        passed: { $sum: { $cond: ['$evalPassed', 1, 0] } },
        failed: { $sum: { $cond: ['$evalPassed', 0, 1] } },
        avgQuality: { $avg: '$evalScores.quality' },
        avgLanguagePurity: { $avg: '$evalScores.language_purity' },
        avgAttempts: { $avg: '$evalAttempts' }
      }}
    ]);

    const total = overview?.totalEvaluations || 0;
    const passed = overview?.passed || 0;
    const failed = overview?.failed || 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : null;

    // 2. Breakdown by main issue
    const byIssue = await AILog.aggregate([
      { $match: { ...matchFilter, evalMainIssue: { $nin: ['', null] } } },
      { $group: {
        _id: '$evalMainIssue',
        count: { $sum: 1 },
        avgQuality: { $avg: '$evalScores.quality' }
      }},
      { $sort: { count: -1 } }
    ]);

    // 3. Breakdown by personality
    const byPersonality = await AILog.aggregate([
      { $match: { ...matchFilter, anchorsUsed: { $ne: '' } } },
      { $group: {
        _id: '$anchorsUsed',
        total: { $sum: 1 },
        passed: { $sum: { $cond: ['$evalPassed', 1, 0] } },
        avgQuality: { $avg: '$evalScores.quality' },
        avgLanguagePurity: { $avg: '$evalScores.language_purity' },
        avgAttempts: { $avg: '$evalAttempts' }
      }},
      { $sort: { total: -1 } }
    ]);

    // 4. Top issue per personality (separate aggregation)
    const topIssueByPersonality = await AILog.aggregate([
      { $match: { ...matchFilter, anchorsUsed: { $ne: '' }, evalMainIssue: { $nin: ['', null, 'none'] } } },
      { $group: {
        _id: { personality: '$anchorsUsed', issue: '$evalMainIssue' },
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $group: {
        _id: '$_id.personality',
        topIssue: { $first: '$_id.issue' },
        topIssueCount: { $first: '$count' },
        totalIssues: { $sum: '$count' }
      }}
    ]);
    const topIssueMap = {};
    for (const row of topIssueByPersonality) {
      topIssueMap[row._id] = {
        issue: row.topIssue,
        pct: row.totalIssues > 0 ? Math.round((row.topIssueCount / row.totalIssues) * 100) : 0
      };
    }

    // 5. Force approved count
    const forceApproved = await HumanReview.countDocuments({
      source: 'force_approved',
      createdAt: { $gte: since }
    });

    // 6. HITL correlation
    const hitlReviewed = await HumanReview.countDocuments({ status: 'reviewed', createdAt: { $gte: since } });
    const hitlDisagreements = await HumanReview.countDocuments({
      status: 'reviewed',
      createdAt: { $gte: since },
      $expr: { $ne: ['$humanPassed', '$judgePassed'] }
    });
    const humanDownvotes = await HumanReview.countDocuments({
      source: 'user_downvote',
      createdAt: { $gte: since }
    });

    // 7. Compute health status
    const failRate = total > 0 ? (failed / total) * 100 : 0;
    const avgAttempts = overview?.avgAttempts || 1;
    let health = 'good';
    let healthLabel = '🟢 Buen estado';
    if (failRate > 25 || forceApproved > 20 || avgAttempts > 2.0) {
      health = 'critical';
      healthLabel = '🔴 Requiere atención urgente';
    } else if (failRate > 15 || forceApproved > 10 || avgAttempts > 1.5) {
      health = 'attention';
      healthLabel = '🟡 Atención recomendada';
    }

    // 8. Rule-based recommendations
    const globalRecommendations = [];
    const byPersonalityWithRecs = [];

    for (const p of byPersonality) {
      const pct = p.total > 0 ? Math.round(((p.total - p.passed) / p.total) * 100) : 0;
      const top = topIssueMap[p._id] || { issue: 'none', pct: 0 };
      const rec = generatePersonalityRecommendation(p._id, pct, top.issue, top.pct, p.avgAttempts);
      byPersonalityWithRecs.push({
        personalityId: p._id,
        total: p.total,
        passRate: Math.round((p.passed / p.total) * 100),
        failRate: pct,
        avgAttempts: Math.round(p.avgAttempts * 100) / 100,
        avgQuality: p.avgQuality ? Math.round(p.avgQuality * 10) / 10 : null,
        avgLanguagePurity: p.avgLanguagePurity ? Math.round(p.avgLanguagePurity * 10) / 10 : null,
        topIssue: top.issue,
        topIssuePct: top.pct,
        recommendation: rec
      });
    }

    // Global force_approved recommendation
    if (forceApproved > 10) {
      globalRecommendations.push({
        type: 'force_approved',
        severity: forceApproved > 20 ? 'high' : 'medium',
        message: `Hay ${forceApproved} force_approved en ${days} días. El Quality Gate no logra producir respuestas válidas. Revisar reglas negativas en los prompts o relajar thresholds.`,
        suggestedActions: [
          { type: 'threshold', label: 'Aumentar maxRetries a 4', impact: 'low' },
          { type: 'prompt_review', label: 'Revisar reglas contradictorias en system prompts', impact: 'high' }
        ]
      });
    }

    // Global HITL disagreement recommendation
    const disagreeRate = hitlReviewed > 0 ? Math.round((hitlDisagreements / hitlReviewed) * 100) : 0;
    if (disagreeRate > 15) {
      globalRecommendations.push({
        type: 'judge_calibration',
        severity: 'medium',
        message: `El juez y los humanos discrepan en ${disagreeRate}% de casos. El prompt del juez necesita calibración.`,
        suggestedActions: [
          { type: 'judge_prompt', label: 'Revisar buildJudgePrompt para alinear criterios', impact: 'high' }
        ]
      });
    }

    // Determine issue breakdown with trend (compare to previous period)
    const prevSince = new Date(since.getTime() - parseInt(days) * 24 * 60 * 60 * 1000);
    const prevByIssue = await AILog.aggregate([
      { $match: {
        createdAt: { $gte: prevSince, $lt: since },
        evalPassed: { $exists: true },
        evalSkipped: { $ne: true },
        evalMainIssue: { $nin: ['', null] }
      }},
      { $group: { _id: '$evalMainIssue', count: { $sum: 1 } } }
    ]);
    const prevIssueMap = {};
    for (const row of prevByIssue) { prevIssueMap[row._id] = row.count; }

    const breakdownByIssue = {};
    for (const row of byIssue) {
      const prevCount = prevIssueMap[row._id] || 0;
      const trend = prevCount > 0 ? (row.count > prevCount ? 'up' : row.count < prevCount ? 'down' : 'stable') : 'new';
      breakdownByIssue[row._id] = {
        count: row.count,
        pct: total > 0 ? Math.round((row.count / total) * 100) : 0,
        trend,
        avgQuality: row.avgQuality ? Math.round(row.avgQuality * 10) / 10 : null
      };
    }

    // Period info
    const fromDate = new Date(since);
    const toDate = new Date();

    res.json({
      period: { days: parseInt(days), from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
      overview: {
        totalEvaluations: total,
        passRate,
        avgAttempts: overview?.avgAttempts ? Math.round(overview.avgAttempts * 100) / 100 : 1,
        avgQuality: overview?.avgQuality ? Math.round(overview.avgQuality * 10) / 10 : null,
        avgLanguagePurity: overview?.avgLanguagePurity ? Math.round(overview.avgLanguagePurity * 10) / 10 : null,
        forceApproved,
        humanDisagreements: hitlDisagreements,
        humanDownvotes,
        health,
        healthLabel
      },
      breakdownByIssue,
      byPersonality: byPersonalityWithRecs,
      globalRecommendations,
      _meta: { generatedAt: new Date().toISOString() }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /diagnostics/analyze — LLM-powered recommendations (on demand)
 * Body: { aggregateData, personalities?: string[] }
 * Returns: enriched recommendations with prompt diffs
 */
router.post('/diagnostics/analyze', async (req, res) => {
  try {
    const { aggregateData, personalities } = req.body;
    if (!aggregateData) {
      return res.status(400).json({ error: 'aggregateData is required' });
    }

    // Get current system prompts for affected personalities
    const { getSystemPrompt } = await import('../groqEngine.js');
    const targetPersonalities = personalities ||
      (aggregateData.byPersonality || []).filter(p => p.recommendation).map(p => p.personalityId);

    const prompts = {};
    for (const pid of targetPersonalities) {
      try {
        prompts[pid] = getSystemPrompt(pid);
      } catch (e) {
        prompts[pid] = '(not found)';
      }
    }

    // Build a compact summary for the LLM
    const summary = {
      overview: {
        totalEvaluations: aggregateData.overview?.totalEvaluations || 0,
        passRate: aggregateData.overview?.passRate || 0,
        avgAttempts: aggregateData.overview?.avgAttempts || 1,
        forceApproved: aggregateData.overview?.forceApproved || 0
      },
      breakdownByIssue: aggregateData.breakdownByIssue || {},
      byPersonality: (aggregateData.byPersonality || []).map(p => ({
        personalityId: p.personalityId,
        passRate: p.passRate,
        failRate: p.failRate,
        avgAttempts: p.avgAttempts,
        topIssue: p.topIssue,
        topIssuePct: p.topIssuePct
      })),
      globalRecommendations: aggregateData.globalRecommendations || []
    };

    const llmPrompt = `Eres un experto en depuración de prompts para chatbots deportivos con personalidad. 
Analiza estas métricas de evaluación y los prompts actuales, luego genera recomendaciones específicas.

MÉTRICAS AGREGADAS (últimos ${aggregateData.period?.days || 7} días):
${JSON.stringify(summary, null, 2)}

PROMPTS ACTUALES DE LAS PERSONALIDADES AFECTADAS:
${Object.entries(prompts).map(([pid, prompt]) => `--- ${pid} ---\n${prompt}`).join('\n\n')}

INSTRUCCIONES:
1. Identifica los patrones de fallo por personalidad (humor, language, personality, factuality).
2. Para cada personalidad con alta tasa de fallos (>20%), sugiere cambios específicos en el prompt:
   - ¿Qué línea o regla del prompt causa el problema?
   - ¿Cómo reescribirías esa sección?
   - Señala el número de línea aproximado y el texto a cambiar.
3. Si el problema no es del prompt, sugiere: cambiar de modelo, ajustar thresholds, o mejorar RAG.
4. Si todas las métricas son buenas, indícalo.

RESPONDE SOLO CON JSON VÁLIDO:
{
  "personalities": [
    {
      "personalityId": "andres_montes",
      "diagnosis": "texto explicando la causa raíz",
      "diffSuggestion": "texto del cambio sugerido en el prompt (qué quitar y qué poner)",
      "fileReference": "groqEngine.js:XX",
      "impact": "high|medium|low",
      "alternativeActions": ["opción 1", "opción 2"]
    }
  ],
  "globalNotes": "cualquier observación adicional"
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: llmPrompt }],
      model: config.evals?.judgeModel || 'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch (e) {
      analysis = { error: 'Failed to parse LLM response', raw };
    }

    res.json({
      analysis,
      _meta: {
        model: config.evals?.judgeModel || 'llama-3.1-8b-instant',
        personalitiesAnalyzed: targetPersonalities,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function generatePersonalityRecommendation(personalityId, failRate, topIssue, topIssuePct, avgAttempts) {
  if (failRate < 15 && avgAttempts < 1.5) return null;

  const recs = {
    andres_montes: {
      humor: {
        severity: avgAttempts > 2 ? 'high' : 'medium',
        summary: `El mecanismo 'street_wisdom' no se activa en el ${topIssuePct}% de respuestas.`,
        details: 'Las reglas de variedad forzada ("VARIEDAD CRÍTICA: NO repitas") están generando respuestas genéricas. El tono coloquial se pierde.',
        suggestedActions: [
          { type: 'prompt_adjustment', label: 'Suavizar regla de variedad en groqEngine.js:54', file: 'groqEngine.js:54', impact: 'high' },
          { type: 'threshold_adjustment', label: 'Bajar minQuality a 5 para andres_montes', impact: 'low' }
        ]
      },
      language: {
        severity: 'medium',
        summary: `Inconsistencias de idioma en ${topIssuePct}% de respuestas.`,
        details: 'El prompt permite español pero el modelo a veces mezcla códigos con inglés.',
        suggestedActions: [
          { type: 'prompt_adjustment', label: 'Reforzar "Responde SIEMPRE en español" al final del prompt', file: 'groqEngine.js:52', impact: 'medium' }
        ]
      }
    },
    pedrerol: {
      humor: {
        severity: 'medium',
        summary: `El dramatismo de Pedrerol no se transmite en el ${topIssuePct}% de respuestas.`,
        details: 'Las frases como "EXCLUSIVA" y "ATENTOS" aparecen pero sin la intensidad esperada.',
        suggestedActions: [
          { type: 'prompt_adjustment', label: 'Añadir ejemplo de tono esperado en groqEngine.js:72-73', file: 'groqEngine.js:72', impact: 'medium' }
        ]
      },
      language: {
        severity: 'low',
        summary: `Pedrerol tiene fallos de idioma en ${topIssuePct}% de casos. Generalmente falso positivo por emojis.`,
        details: 'El uso intensivo de signos de exclamación puede confundir al juez.',
        suggestedActions: []
      }
    },
    roncero: {
      humor: {
        severity: 'high',
        summary: `La exageración de Roncero no pasa el filtro de calidad en ${topIssuePct}% de intentos.`,
        details: 'El tono ultra-pasional puede sonar "cringe" para el juez. Revisar ejemplos de intensidad sin caer en lo forzado.',
        suggestedActions: [
          { type: 'prompt_adjustment', label: 'Añadir ejemplos few-shot de exageración natural', file: 'groqEngine.js:90-93', impact: 'high' }
        ]
      }
    },
    juez_dredd: {
      personality: {
        severity: 'medium',
        summary: `El tono de Juez Dredd no se distingue claramente en el ${topIssuePct}% de respuestas.`,
        details: 'El setting de "I AM THE LAW" a veces se pierde en respuestas demasiado informativas.',
        suggestedActions: [
          { type: 'prompt_adjustment', label: 'Reforzar el tono judicial al inicio del prompt', file: 'groqEngine.js:100-105', impact: 'medium' }
        ]
      }
    },
    darth_vader: {
      humor: {
        severity: 'medium',
        summary: `El humor oscuro de Darth Vader no siempre se activa (${topIssuePct}%).`,
        details: 'El menacing_wit necesita ejemplos más explícitos de cómo combinar amenaza con humor.',
        suggestedActions: [
          { type: 'prompt_adjustment', label: 'Añadir ejemplos de menacing_wit en inglés', file: 'groqEngine.js:100-110', impact: 'medium' }
        ]
      }
    },
    trump: {
      humor: {
        severity: 'low',
        summary: `Trump tiene buena tasa de aprobación. Fallos menores de humor (${topIssuePct}%).`,
        details: 'Las superlatives a veces son demasiado repetitivas.',
        suggestedActions: []
      }
    },
    fabrizio_romano: {
      language: {
        severity: 'low',
        summary: `Fabrizio tiene mezcla ES/EN ocasional (${topIssuePct}%).`,
        details: 'El "Here we go!" en inglés puede confundir al juez cuando el idioma esperado es español.',
        suggestedActions: []
      }
    }
  };

  const personalityRecs = recs[personalityId];
  if (!personalityRecs) return null;

  const issueRec = personalityRecs[topIssue];
  if (!issueRec) return null;

  return issueRec;
}

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
