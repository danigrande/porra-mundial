import express from 'express';
import { ChatbotFeedback } from '../models/ChatbotFeedback.js';
import { Message } from '../models/Message.js';
import { createResponse } from './helpers.js';

const router = express.Router();

const DOWN_REASONS = ['incorrect', 'not_helpful', 'off_topic', 'rude', 'other'];

router.post('/chatbot-feedback', async (req, res) => {
  try {
    const { messageId, userId, userName, rating, reason } = req.body;

    if (!messageId || !userId || !userName || !rating) {
      return res.status(400).json(createResponse('error', null, 'Faltan campos obligatorios'));
    }
    if (!['up', 'down'].includes(rating)) {
      return res.status(400).json(createResponse('error', null, 'Rating debe ser "up" o "down"'));
    }
    if (rating === 'down' && reason && !DOWN_REASONS.includes(reason)) {
      return res.status(400).json(createResponse('error', null, 'Razón inválida'));
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json(createResponse('error', null, 'Mensaje no encontrado'));
    }

    const feedback = await ChatbotFeedback.findOneAndUpdate(
      { messageId, userId },
      { messageId, userId, userName, rating, reason: reason || null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

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
