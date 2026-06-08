import express from 'express';
import { Reality } from '../models/Reality.js';
import { Group } from '../models/Group.js';
import { Prediction } from '../models/Prediction.js';
import * as apiFootballService from '../apiFootballService.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET } from '../shared_data.js';
import { invalidateAllCaches } from '../messageHandler.js';
import { adminAuth } from '../middleware.js';
import { createResponse } from './helpers.js';

const router = express.Router();

router.get('/reality', async (req, res) => {
    try {
        const reality = await Reality.findOne({ tournament: 'worldcup2026' });
        res.json(createResponse('success', reality ? reality.results : {}));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/reality', async (req, res) => {
    try {
        const { results } = req.body;
        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const existingResults = realityDoc ? realityDoc.results : {};

        let events = results.events;
        if (events === undefined) {
            events = existingResults.events || {};
        }

        const mergedResults = { ...existingResults, ...results, events };

        await Reality.findOneAndUpdate(
            { tournament: 'worldcup2026' },
            { results: mergedResults, updatedAt: new Date() },
            { upsert: true }
        );

        invalidateAllCaches();

        res.json(createResponse('success'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/admin/simulate-match', adminAuth, async (req, res) => {
    try {
        const { matchId, homeTeam, awayTeam } = req.body;
        if (!matchId || !homeTeam || !awayTeam) {
            return res.status(400).json(createResponse('error', null, 'Faltan parámetros'));
        }

        const simData = apiFootballService.simulateMatchEvents(matchId, homeTeam, awayTeam);

        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const results = realityDoc ? realityDoc.results : {};

        results[`${matchId}_h`] = simData.goals.home.toString();
        results[`${matchId}_a`] = simData.goals.away.toString();
        results[`${matchId}_date`] = simData.date;
        if (simData.penalties) {
            results[`pen_${matchId.replace('ko_', '')}_h`] = simData.penalties.home.toString();
            results[`pen_${matchId.replace('ko_', '')}_a`] = simData.penalties.away.toString();
        }

        if (!results.events) results.events = {};
        results.events[matchId] = simData.events;

        await Reality.findOneAndUpdate(
            { tournament: 'worldcup2026' },
            { results, updatedAt: new Date() },
            { upsert: true }
        );

        res.json(createResponse('success', { results }));
    } catch (error) {
        console.error("Error simulando partido:", error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/admin/simulate-all', adminAuth, async (req, res) => {
    try {
        const results = apiFootballService.simulateAllMatches(FIXTURE_GROUPS, BRACKET_MATCHES);

        await Reality.findOneAndUpdate(
            { tournament: 'worldcup2026' },
            { results, updatedAt: new Date() },
            { upsert: true }
        );

        res.json(createResponse('success', { results }));
    } catch (error) {
        console.error("Error simulando todo:", error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/admin/regenerate-events', adminAuth, async (req, res) => {
    try {
        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const currentReality = realityDoc ? realityDoc.results : {};

        const updatedResults = apiFootballService.regenerateEvents(currentReality, FIXTURE_GROUPS, BRACKET_MATCHES);

        await Reality.findOneAndUpdate(
            { tournament: 'worldcup2026' },
            { results: updatedResults, updatedAt: new Date() },
            { upsert: true }
        );

        res.json(createResponse('success', { message: 'Eventos regenerados manteniendo resultados originales' }));
    } catch (error) {
        console.error("Error regenerando eventos:", error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/admin/force-sync', adminAuth, async (req, res) => {
    try {
        const { startRealitySync } = await import('../realitySyncService.js');
        const io = req.app.get('io');
        await startRealitySync(io);
        res.json(createResponse('success', null, 'Sincronización forzada completada'));
    } catch (error) {
        console.error("Error en force-sync:", error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/dev/populate-reality', adminAuth, async (req, res) => {
    try {
        const { phaseId } = req.body;
        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const currentReality = realityDoc ? realityDoc.results : {};

        const updatedResults = apiFootballService.simulatePhaseResults(
            phaseId,
            currentReality,
            FIXTURE_GROUPS,
            BRACKET_MATCHES,
            KNOCKOUT_BRACKET
        );

        await Reality.findOneAndUpdate(
            { tournament: 'worldcup2026' },
            { results: updatedResults, updatedAt: new Date() },
            { upsert: true }
        );

        res.json(createResponse('success', { phase: phaseId }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/dev/reset-test', adminAuth, async (req, res) => {
    try {
        const { groupName } = req.body;
        if (!groupName) throw new Error('Nombre de grupo requerido');

        const group = await Group.findOne({ name: groupName });
        if (!group) throw new Error('Grupo no encontrado');

        await Prediction.deleteMany({ group: group._id });

        group.lastAnnouncedPhase = null;
        group.lastReminderPhase = null;
        await group.save();

        await Reality.deleteOne({ tournament: 'worldcup2026' });

        res.json(createResponse('success', { message: `Grupo ${groupName} reseteado para el test` }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

export default router;
