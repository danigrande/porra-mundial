import express from 'express';
import { Correction } from '../models/Correction.js';
import { GoldenEntry } from '../models/GoldenEntry.js';
import { createResponse } from './helpers.js';

const router = express.Router();

const DEV_KEY_HEADER = 'x-dev-key';

function requireDevKey(req, res, next) {
  const key = req.headers[DEV_KEY_HEADER] || req.query.key;
  if (!key || key !== process.env.DEV_DASHBOARD_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// GET /corrections — lista paginada
router.get('/corrections', requireDevKey, async (req, res) => {
  try {
    const { page = 1, limit = 25, status, personalityId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (personalityId) filter.personalityId = personalityId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [corrections, total] = await Promise.all([
      Correction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Correction.countDocuments(filter)
    ]);

    res.json({
      corrections,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /corrections/stats — estadísticas agregadas
router.get('/corrections/stats', requireDevKey, async (req, res) => {
  try {
    const total = await Correction.countDocuments();
    const pending = await Correction.countDocuments({ status: 'pending' });
    const approved = await Correction.countDocuments({ status: 'approved' });
    const promoted = await Correction.countDocuments({ promotedToGolden: true });

    const byPersonality = await Correction.aggregate([
      { $group: { _id: '$personalityId', count: { $sum: 1 }, promoted: { $sum: { $cond: ['$promotedToGolden', 1, 0] } } } },
      { $sort: { count: -1 } }
    ]);

    const avgConfidence = await Correction.aggregate([
      { $match: { detectorConfidence: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$detectorConfidence' } } }
    ]);

    res.json({
      total,
      pending,
      approved,
      promoted,
      byPersonality,
      avgConfidence: avgConfidence[0]?.avg || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /corrections/:id/approve — aprobar corrección
router.post('/corrections/:id/approve', requireDevKey, async (req, res) => {
  try {
    const correction = await Correction.findById(req.params.id);
    if (!correction) return res.status(404).json({ error: 'Corrección no encontrada' });

    correction.status = 'approved';
    correction.reviewedBy = req.body.reviewedBy || 'dashboard';
    correction.reviewedAt = new Date();
    await correction.save();

    res.json({ success: true, correction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /corrections/:id/reject — rechazar corrección
router.post('/corrections/:id/reject', requireDevKey, async (req, res) => {
  try {
    const correction = await Correction.findById(req.params.id);
    if (!correction) return res.status(404).json({ error: 'Corrección no encontrada' });

    correction.status = 'rejected';
    correction.reviewedBy = req.body.reviewedBy || 'dashboard';
    correction.reviewedAt = new Date();
    await correction.save();

    res.json({ success: true, correction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /corrections/:id/promote — promover a golden dataset
router.post('/corrections/:id/promote', requireDevKey, async (req, res) => {
  try {
    const correction = await Correction.findById(req.params.id);
    if (!correction) return res.status(404).json({ error: 'Corrección no encontrada' });
    if (correction.status !== 'approved') {
      return res.status(400).json({ error: 'La corrección debe estar en estado "approved" para promover' });
    }

    const overrideEntry = {
      id: `correction_${correction._id}`,
      query: correction.context || '(corrección conversacional)',
      personalityId: correction.personalityId || 'andres_montes',
      targetLanguage: correction.targetLanguage || 'es',
      type: 'personality',
      mockContext: { leaderboard: [], playerStats: null },
      expectations: {
        minLanguagePurity: 8,
        minQuality: 6,
        maxLength: 500,
        mustNotContain: ['```', '##', '**']
      },
      goldenResponse: correction.correctedText,
      goldenJudgeScores: { language_purity: 10, quality: 10 },
      tags: ['promoted_from_correction'],
      source: 'correction',
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

    // También persistir en MongoDB para que sobreviva al redeploy
    await GoldenEntry.create({
      source: 'correction',
      category: 'personality',
      query: correction.context || '(corrección conversacional)',
      personalityId: correction.personalityId || 'andres_montes',
      targetLanguage: correction.targetLanguage || 'es',
      mockContext: { leaderboard: [], playerStats: null },
      expectations: { minLanguagePurity: 8, minQuality: 6, maxLength: 500, mustNotContain: ['```', '##', '**'] },
      goldenResponse: correction.correctedText,
      goldenJudgeScores: { language_purity: 10, quality: 10 },
      tags: ['promoted_from_correction'],
      originalReviewId: correction._id,
    });

    correction.status = 'promoted';
    correction.promotedToGolden = true;
    correction.reviewedBy = req.body.reviewedBy || 'dashboard';
    correction.reviewedAt = new Date();
    await correction.save();

    res.json({ success: true, entry: overrideEntry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
