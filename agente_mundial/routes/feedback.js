import express from 'express';
import { Feedback } from '../models/Feedback.js';
import { PRD } from '../models/PRD.js';
import { createResponse } from './helpers.js';

const router = express.Router();

router.post('/feedback', async (req, res) => {
    try {
        const { userId, userName, type, subject, detail } = req.body;
        if (!userId || !userName || !type || !subject || !detail) {
            return res.status(400).json(createResponse('error', null, 'Faltan campos obligatorios'));
        }
        if (!['bug', 'feature'].includes(type)) {
            return res.status(400).json(createResponse('error', null, 'Tipo inválido'));
        }
        if (subject.length > 100) {
            return res.status(400).json(createResponse('error', null, 'El asunto no puede superar 100 caracteres'));
        }
        if (detail.length > 1500) {
            return res.status(400).json(createResponse('error', null, 'El detalle no puede superar 1500 caracteres'));
        }
        const feedback = await Feedback.create({ userId, userName, type, subject, detail });
        console.log(`💬 FEEDBACK #${feedback._id}: [${type}] ${subject}`);
        res.json(createResponse('success', { feedbackId: feedback._id }, 'Reporte recibido. ¡Gracias por tu aporte!'));
    } catch (error) {
        console.error('❌ Error en POST /feedback:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/feedback', async (req, res) => {
    try {
        const feedbacks = await Feedback.find().sort({ createdAt: -1 }).lean();
        res.json(createResponse('success', feedbacks));
    } catch (error) {
        console.error('❌ Error en GET /feedback:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/feedback/:id/vote', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json(createResponse('error', null, 'Falta userId'));

        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json(createResponse('error', null, 'Feedback no encontrado'));

        const idx = feedback.votes.indexOf(userId);
        if (idx === -1) {
            feedback.votes.push(userId);
        } else {
            feedback.votes.splice(idx, 1);
        }
        feedback.voteCount = feedback.votes.length;
        await feedback.save();

        res.json(createResponse('success', { voteCount: feedback.voteCount, voted: idx === -1 }));
    } catch (error) {
        console.error('❌ Error en POST /feedback/:id/vote:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/prds/approved', async (req, res) => {
    try {
        const prds = await PRD.find({ status: 'approved' })
            .populate('feedbackId', 'subject type detail userName')
            .sort({ priority: 1, createdAt: -1 });
        res.json(createResponse('success', prds));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

export default router;
