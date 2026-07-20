import express from 'express';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Prediction } from '../models/Prediction.js';
import { Reality } from '../models/Reality.js';
import * as scoringEngine from '../scoringEngine.js';
import { getTournamentState } from '../tournamentState.js';
import { triggerAutoSimulationIfNeeded } from '../autoSimulator.js';
import { MATCH_KICKOFFS } from '../shared_data.js';
import { createResponse } from './helpers.js';

const router = express.Router();

router.get('/tournament-state', async (req, res) => {
  const { groupName } = req.query;
  if (process.env.TEST_MODE === 'true') await triggerAutoSimulationIfNeeded();
  res.json(createResponse('success', await getTournamentState(groupName)));
});

router.get('/predictions', async (req, res) => {
    try {
        const { groupName, userId } = req.query;
        if (!groupName) return res.status(400).json(createResponse('error', null, 'Falta groupName'));

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        if (userId) {
            const user = await User.findById(userId);
            if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

            const pred = await Prediction.findOne({ user: user._id, group: group._id });
            return res.json(createResponse('success', pred ? pred.predictions : {}));
        } else {
            const preds = await Prediction.find({ group: group._id }).populate('user', 'name');
            const result = {};
            preds.forEach(p => {
                if (p.user) result[p.user.name] = { predictions: p.predictions, updatedAt: p.updatedAt?.toISOString() };
            });
            return res.json(createResponse('success', result));
        }
    } catch (error) {
        console.error('❌ Error GET /predictions:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/predictions', async (req, res) => {
    try {
        const { playerName, groupName, predictions } = req.body;
        if (!playerName || !groupName || !predictions) {
            return res.status(400).json(createResponse('error', null, 'Faltan datos'));
        }

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const user = await User.findOne({ name: playerName, groups: groupName });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado en este grupo'));

        // Eliminar keys de partidos que ya tienen resultado real (no se pueden editar)
        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const reality = realityDoc ? realityDoc.results : {};
        for (const key of Object.keys(predictions)) {
          const match = key.match(/^(g[A-L]_m\d)_[ha]$/);
          if (match) {
            const mid = match[1];
            if (`${mid}_h` in reality && `${mid}_a` in reality) {
              delete predictions[key];
            }
          }
        }

        // Eliminar keys de partidos KO que ya han empezado (kickoff pasado)
        for (const key of Object.keys(predictions)) {
          const koMatch = key.match(/^(ko_|pen_)(\d+)_[ha]$/);
          if (koMatch) {
            const matchId = `ko_${koMatch[2]}`;
            const kickoffMs = MATCH_KICKOFFS[matchId] ? new Date(MATCH_KICKOFFS[matchId]).getTime() : null;
            if (kickoffMs !== null && Date.now() >= kickoffMs) {
              delete predictions[key];
            }
          }
        }

        let pred = await Prediction.findOne({ user: user._id, group: group._id });
        if (!pred) {
            pred = new Prediction({ user: user._id, group: group._id, predictions });
        } else {
            // Merge para preservar predicciones de partidos bloqueados (ya jugados)
            // que fueron eliminadas de 'predictions' unas líneas arriba
            pred.predictions = { ...pred.predictions, ...predictions };
            pred.updatedAt = new Date();
        }
        await pred.save();
        res.json(createResponse('success', null, 'Predicciones guardadas'));
    } catch (error) {
        console.error('❌ Error POST /predictions:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/leaderboard', async (req, res) => {
    try {
        const { groupName } = req.query;
        if (!groupName) return res.status(400).json(createResponse('error', null, 'Falta groupName'));

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const predictions = await Prediction.find({ group: group._id }).populate('user', 'name');
        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const reality = realityDoc ? realityDoc.results : {};

        const playersData = {};
        predictions.forEach(p => {
            if (p.user) playersData[p.user.name] = { predictions: p.predictions, updatedAt: p.updatedAt?.toISOString() };
        });

        const leaderboard = scoringEngine.calculateLeaderboard(playersData, reality, group.rules, group.predictionMode);
        res.json(createResponse('success', leaderboard));
    } catch (error) {
        console.error('❌ Error obteniendo leaderboard:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

export default router;
