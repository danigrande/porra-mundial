import express from 'express';
import { ChatbotFeedback } from '../models/ChatbotFeedback.js';
import { HumanReview } from '../models/HumanReview.js';
import { AILog } from '../models/AILog.js';
import { Message } from '../models/Message.js';
import { createResponse } from './helpers.js';
import config from '../config.js';

const router = express.Router();

const DOWN_REASONS = ['incorrect', 'not_helpful', 'off_topic', 'rude', 'other'];

async function maybeCreateHumanReview(rating, messageId, feedbackId) {
  try {
    const message = await Message.findById(messageId).select('aiLogId').lean();
    if (!message?.aiLogId) return;

    const aiLog = await AILog.findById(message.aiLogId).lean();
    if (!aiLog) return;

    // Daily cap check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await HumanReview.countDocuments({ createdAt: { $gte: today } });
    if (todayCount >= (config.hitl?.maxDailyReviews || 20)) return;

    // Dedupe: skip if too many similar cases already queued this week
    const weekAgo = new Date(Date.now() - (config.hitl?.dedupeWindow || 7) * 86400000);
    const similar = await HumanReview.countDocuments({
      personalityId: aiLog.anchorsUsed,
      targetLanguage: aiLog.targetLanguage,
      createdAt: { $gte: weekAgo }
    });
    if (similar >= 3) return;

    // Rating 1-2 → user_downvote (como antes)
    if (rating <= 2) {
      await HumanReview.create({
        source: 'user_downvote',
        aiLogId: aiLog._id,
        chatbotFeedbackId: feedbackId,
        query: aiLog.userPrompt,
        response: aiLog.groqResponse,
        personalityId: aiLog.anchorsUsed,
        targetLanguage: aiLog.targetLanguage,
        judgeScores: aiLog.evalScores,
        judgePassed: aiLog.evalPassed,
        status: 'pending'
      });
    } else if (rating >= 4 && aiLog.evalPassed === false) {
      // Rating 4-5 pero Judge falló → señal de calibración (falso negativo)
      await HumanReview.create({
        source: 'judge_disagree',
        aiLogId: aiLog._id,
        chatbotFeedbackId: feedbackId,
        query: aiLog.userPrompt,
        response: aiLog.groqResponse,
        personalityId: aiLog.anchorsUsed,
        targetLanguage: aiLog.targetLanguage,
        judgeScores: aiLog.evalScores,
        judgePassed: aiLog.evalPassed,
        status: 'pending'
      });
    }
    // Rating 3 → neutral, sin acción
  } catch (e) {
    console.error('[HumanReview] Error auto-creating review:', e.message);
  }
}

router.post('/chatbot-feedback', async (req, res) => {
  try {
    const { messageId, userId, userName, rating, reason } = req.body;

    if (!messageId || !userId || !userName || !rating) {
      return res.status(400).json(createResponse('error', null, 'Faltan campos obligatorios'));
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json(createResponse('error', null, 'Rating debe ser un número entre 1 y 5'));
    }
    if (ratingNum <= 2 && reason && !DOWN_REASONS.includes(reason)) {
      return res.status(400).json(createResponse('error', null, 'Razón inválida'));
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json(createResponse('error', null, 'Mensaje no encontrado'));
    }

    // Buscar el aiLogId del mensaje para linkear feedback ↔ AILog
    const msg = await Message.findById(messageId).select('aiLogId').lean();
    const aiLogId = msg?.aiLogId || null;

    const feedback = await ChatbotFeedback.findOneAndUpdate(
      { messageId, userId },
      { messageId, userId, userName, rating: ratingNum, reason: reason || null, aiLogId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Auto-create HumanReview for relevant feedback (fire-and-forget)
    maybeCreateHumanReview(ratingNum, messageId, feedback._id);

    res.json(createResponse('success', {
      _id: feedback._id,
      messageId: feedback.messageId,
      userId: feedback.userId,
      rating: feedback.rating,
      reason: feedback.reason,
      createdAt: feedback.createdAt,
    }, 'Feedback registrado'));

  } catch (error) {
    console.error('❌ Error en POST /chatbot-feedback:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

// PATCH para cambiar rating (útil si el usuario reconsidera)
router.patch('/chatbot-feedback/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId, rating, reason } = req.body;

    if (!messageId || !userId || !rating) {
      return res.status(400).json(createResponse('error', null, 'messageId, userId y rating requeridos'));
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json(createResponse('error', null, 'Rating debe ser un número entre 1 y 5'));
    }

    const existing = await ChatbotFeedback.findOne({ messageId, userId });
    if (!existing) {
      return res.status(404).json(createResponse('error', null, 'Feedback no encontrado'));
    }

    const oldRating = existing.rating;
    existing.rating = ratingNum;
    if (reason !== undefined) existing.reason = reason;
    await existing.save();

    // Si el rating cambió significativamente (cruzó threshold 2→3 o 4→3), re-evaluar HITL
    if ((oldRating <= 2 && ratingNum >= 3) || (oldRating >= 4 && ratingNum <= 3)) {
      // Podríamos remover HITL existente si el user rectificó, pero por ahora solo log
      console.log(`[Feedback] User ${userId} changed rating from ${oldRating} to ${ratingNum} for message ${messageId}`);
    }

    res.json(createResponse('success', {
      _id: existing._id,
      messageId: existing.messageId,
      userId: existing.userId,
      rating: existing.rating,
      reason: existing.reason,
      createdAt: existing.createdAt,
    }, 'Rating actualizado'));
  } catch (error) {
    console.error('❌ Error en PATCH /chatbot-feedback/:messageId:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

router.get('/chatbot-feedback/batch', async (req, res) => {
  try {
    const { messageIds, userId } = req.query;
    if (!messageIds || !userId) {
      return res.status(400).json(createResponse('error', null, 'messageIds y userId requeridos'));
    }

    const ids = messageIds.split(',').filter(Boolean);
    const feedbacks = await ChatbotFeedback.find({
      messageId: { $in: ids },
      userId
    }).lean();

    const result = {};
    ids.forEach(id => { result[id] = null; });
    feedbacks.forEach(fb => {
      result[fb.messageId.toString()] = {
        rating: fb.rating,
        reason: fb.reason,
      };
    });

    res.json(createResponse('success', result));
  } catch (error) {
    console.error('❌ Error en GET /chatbot-feedback/batch:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

router.get('/chatbot-feedback/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.query;

    const feedback = await ChatbotFeedback.findOne({ messageId, userId }).lean();

    res.json(createResponse('success', feedback ? {
      rating: feedback.rating,
      reason: feedback.reason,
    } : null));
  } catch (error) {
    console.error('❌ Error en GET /chatbot-feedback/:messageId:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

router.delete('/chatbot-feedback/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.query;

    if (!messageId || !userId) {
      return res.status(400).json(createResponse('error', null, 'messageId y userId requeridos'));
    }

    await ChatbotFeedback.findOneAndDelete({ messageId, userId });
    res.json(createResponse('success', null, 'Feedback eliminado'));
  } catch (error) {
    console.error('❌ Error en DELETE /chatbot-feedback/:messageId:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

export default router;
