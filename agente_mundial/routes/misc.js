import express from 'express';
import axios from 'axios';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Summary } from '../models/Summary.js';
import { Message } from '../models/Message.js';
import { Reality } from '../models/Reality.js';
import { Prediction } from '../models/Prediction.js';
import { Report } from '../models/Report.js';
import { BlockedUser } from '../models/BlockedUser.js';
import * as scoringEngine from '../scoringEngine.js';
import * as groqEngine from '../groqEngine.js';
import { createResponse } from './helpers.js';

const router = express.Router();

// ==========================================
// REPORTES Y BLOQUEOS (Moderación)
// ==========================================

router.post('/report', async (req, res) => {
    try {
        const { reporterId, reportedId, messageId, reason } = req.body;
        if (!reporterId || !reportedId || !reason) {
            return res.status(400).json(createResponse('error', null, 'Faltan campos obligatorios'));
        }

        let messageText = '';
        let groupName = '';
        if (messageId) {
            const msg = await Message.findById(messageId).lean();
            if (msg) {
                messageText = msg.text || '';
                groupName = msg.chatId || '';
            }
        }

        const report = await Report.create({
            reporterId,
            reportedId,
            messageId,
            messageText,
            reason,
            groupName
        });

        console.log(`🚩 REPORTE #${report._id}: De ${reporterId} contra ${reportedId}. Motivo: ${reason}`);
        res.json(createResponse('success', { reportId: report._id }, 'Reporte enviado a moderación'));
    } catch (error) {
        console.error('❌ Error en POST /report:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/block', async (req, res) => {
    try {
        const { blockerId, blockedId, groupName } = req.body;
        if (!blockerId || !blockedId) {
            return res.status(400).json(createResponse('error', null, 'Faltan campos obligatorios'));
        }
        await BlockedUser.findOneAndUpdate(
            { blockerId, blockedId },
            { blockerId, blockedId, groupName, createdAt: new Date() },
            { upsert: true }
        );
        console.log(`🚫 BLOQUEO: ${blockerId} bloqueó a ${blockedId}`);
        res.json(createResponse('success', null, 'Usuario bloqueado'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/unblock', async (req, res) => {
    try {
        const { blockerId, blockedId } = req.body;
        await BlockedUser.deleteOne({ blockerId, blockedId });
        res.json(createResponse('success', null, 'Usuario desbloqueado'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/blocked', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json(createResponse('error', null, 'Falta userId'));
        const blocked = await BlockedUser.find({ blockerId: userId }).lean();
        res.json(createResponse('success', blocked.map(b => b.blockedId)));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// RESÚMENES IA
// ==========================================

router.get('/summaries', async (req, res) => {
    try {
        const { groupName } = req.query;
        const summaries = await Summary.find({ groupName });
        const result = {};
        summaries.forEach(s => {
            result[s.playerName] = s.text;
        });
        res.json(createResponse('success', result));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/summaries', async (req, res) => {
    try {
        const { playerName, groupName, summary } = req.body;
        await Summary.findOneAndUpdate(
            { playerName, groupName },
            { text: summary, updatedAt: new Date() },
            { upsert: true }
        );
        res.json(createResponse('success'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/summary/:player', async (req, res) => {
    try {
        const { player } = req.params;
        const { groupName } = req.query;

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const predictions = await Prediction.find({ group: group._id }).populate('user', 'name');
        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const reality = realityDoc ? realityDoc.results : {};

        const playersData = {};
        predictions.forEach(p => { if (p.user) playersData[p.user.name] = { predictions: p.predictions }; });

        const leaderboard = scoringEngine.calculateLeaderboard(playersData, reality, group.rules, group.predictionMode);
        const playerStats = leaderboard.find(p => p.name === player);

        let chatContext = "";
        try {
            const rag = await import('../ragService.js');
            const chatId = groupName;
            chatContext = await rag.semanticSearchContextForPlayer(chatId, player, text || '');
        } catch (e) {
            console.warn('⚠️ No se pudo recuperar contexto RAG:', e.message);
        }

        const summaryText = await groqEngine.generatePersonalitySummary(player, groupName, {
            playerStats,
            leaderboard,
            chatContext
        });

        await Summary.findOneAndUpdate(
            { playerName: player, groupName },
            { text: summaryText, updatedAt: new Date() },
            { upsert: true }
        );

        res.json(createResponse('success', summaryText));
    } catch (error) {
        console.error('❌ Error generando resumen individual:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// CHAT (API REST)
// ==========================================

router.get('/chat/:groupName/messages', async (req, res) => {
    try {
        const { groupName } = req.params;
        const { before, limit = 50 } = req.query;

        const query = { chatId: groupName };
        if (before) {
            query.timestamp = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json(createResponse('success', messages.reverse()));
    } catch (error) {
        console.error('❌ Error en GET /chat/messages:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/chat/:messageId/react', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji, userId: uid, add } = req.body;
        if (!messageId || !emoji) {
            return res.status(400).json(createResponse('error', null, 'messageId y emoji requeridos'));
        }
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json(createResponse('error', null, 'Mensaje no encontrado'));
        }
        const reactions = message.reactions || {};
        const users = reactions[emoji] || [];
        if (add) {
            if (!users.includes(uid)) {
                reactions[emoji] = [...users, uid];
            }
        } else {
            reactions[emoji] = users.filter(id => id !== uid);
            if (reactions[emoji].length === 0) delete reactions[emoji];
        }
        message.reactions = reactions;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`group:${message.chatId}`).emit('message-reacted', {
                messageId,
                reactions: Object.fromEntries(message.reactions),
            });
        }
        res.json(createResponse('success', Object.fromEntries(message.reactions)));
    } catch (error) {
        console.error('❌ Error en POST /chat/react:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.put('/chat/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { newText, userId: uid } = req.body;
        if (!messageId || !newText?.trim()) {
            return res.status(400).json(createResponse('error', null, 'messageId y newText requeridos'));
        }
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json(createResponse('error', null, 'Mensaje no encontrado'));
        }
        if (message.senderId !== uid) {
            return res.status(403).json(createResponse('error', null, 'No puedes editar este mensaje'));
        }
        if (Date.now() - new Date(message.timestamp).getTime() > 15 * 60 * 1000) {
            return res.status(400).json(createResponse('error', null, 'Ya no puedes editar este mensaje (más de 15 min)'));
        }
        message.text = newText.trim();
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`group:${message.chatId}`).emit('message-edited', {
                messageId,
                newText: message.text,
                edited: true,
                editedAt: message.editedAt,
            });
        }
        res.json(createResponse('success', { text: message.text, edited: true, editedAt: message.editedAt }));
    } catch (error) {
        console.error('❌ Error en PUT /chat/message:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.delete('/chat/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { deleteFor, userId: uid } = req.query;
        if (!messageId || !deleteFor) {
            return res.status(400).json(createResponse('error', null, 'messageId y deleteFor requeridos'));
        }
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json(createResponse('error', null, 'Mensaje no encontrado'));
        }
        const io = req.app.get('io');

        if (deleteFor === 'everyone') {
            if (message.senderId !== uid) {
                return res.status(403).json(createResponse('error', null, 'No puedes eliminar este mensaje para todos'));
            }
            const chatId = message.chatId;
            await Message.findByIdAndDelete(messageId);
            if (io) {
                io.to(`group:${chatId}`).emit('message-deleted', { messageId, deleteFor: 'everyone' });
            }
            res.json(createResponse('success', { deleted: true }));
        } else if (deleteFor === 'me') {
            if (!message.deletedFor.includes(uid)) {
                message.deletedFor.push(uid);
                await message.save();
            }
            res.json(createResponse('success', { deletedForMe: true }));
        } else {
            res.status(400).json(createResponse('error', null, 'deleteFor debe ser "me" o "everyone"'));
        }
    } catch (error) {
        console.error('❌ Error en DELETE /chat/message:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/link-preview', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json(createResponse('error', null, 'url requerida'));
        }
        const response = await axios.get(url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const html = response.data;
        const og = {};
        const ogRegex = /<meta\s+(?:property|name)=["'](?:og:)?(\w+)["']\s+content=["']([^"']+)["']/gi;
        let match;
        while ((match = ogRegex.exec(html)) !== null) {
            og[match[1]] = match[2];
        }
        res.json(createResponse('success', {
            title: og.title || og.site_name || '',
            description: og.description || '',
            image: og.image || '',
        }));
    } catch (error) {
        console.error('❌ Error en GET /link-preview:', error);
        res.json(createResponse('success', { title: '', description: '', image: '' }));
    }
});

router.get('/chat/:groupName/search', async (req, res) => {
    try {
        const { groupName } = req.params;
        const { q, before, limit = 50 } = req.query;
        if (!q?.trim()) {
            return res.status(400).json(createResponse('error', null, 'q requerido'));
        }
        const query = {
            chatId: groupName,
            text: { $regex: q.trim(), $options: 'i' },
        };
        if (before) {
            query.timestamp = { $lt: new Date(before) };
        }
        const results = await Message.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();
        res.json(createResponse('success', results.reverse()));
    } catch (error) {
        console.error('❌ Error en GET /chat/search:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================

router.post('/push-token', async (req, res) => {
    try {
        const { userId, token, platform } = req.body;
        if (!userId || !token) {
            return res.status(400).json(createResponse('error', null, 'userId y token son requeridos'));
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

        const pushService = await import('../pushService.js');
        await pushService.registerToken(user._id.toString(), token, platform || 'android');

        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /push-token:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.delete('/push-token', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json(createResponse('error', null, 'token es requerido'));

        const pushService = await import('../pushService.js');
        await pushService.removeToken(token);

        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en DELETE /push-token:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/test-push/:groupName', async (req, res) => {
    try {
        const { groupName } = req.params;
        const pushService = await import('../pushService.js');

        await pushService.sendToGroup(
            groupName,
            '🏆 Agente Mundial (Test)',
            'Esta es una notificación de prueba para verificar tus ajustes de silencio.',
            { screen: 'chat', groupName },
            null,
            true
        );

        res.json(createResponse('success', { message: `Notificación de prueba enviada al grupo ${groupName}` }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// BUSCAR USUARIO
// ==========================================

router.get('/user/by-email/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email.toLowerCase().trim() });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

        res.json(createResponse('success', {
            name: user.name,
            email: user.email,
            groups: user.groups,
            isAdminOf: user.isAdminOf || [],
            nickname: user.nickname || user.name,
            userId: user._id.toString()
        }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/user/by-id/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

        res.json(createResponse('success', {
            name: user.name,
            email: user.email,
            groups: user.groups,
            isAdminOf: user.isAdminOf || [],
            nickname: user.nickname || user.name,
            userId: user._id.toString()
        }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// PROXY GIPHY
// ==========================================

router.get('/giphy/search', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        const apiKey = process.env.GIPHY_API_KEY;
        const response = await axios.get(`https://api.giphy.com/v1/gifs/search`, {
            params: {
                api_key: apiKey,
                q: q || 'soccer world cup',
                limit,
                rating: 'g'
            }
        });

        const gifs = response.data.data.map(g => ({
            id: g.id,
            url: g.images.fixed_height.url
        }));

        res.json(createResponse('success', gifs));
    } catch (error) {
        console.error('❌ Error proxy GIPHY:', error.message);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

export default router;
