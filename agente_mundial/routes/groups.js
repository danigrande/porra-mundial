import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Prediction } from '../models/Prediction.js';
import { createResponse } from './helpers.js';
import { sendWelcomeEmail } from '../emailService.js';

const router = express.Router();

router.get('/groups', async (req, res) => {
    try {
        const { playerName, email, userId } = req.query;
        let query = {};
        if (userId) query = { _id: userId };
        else if (email) query = { email: email.toLowerCase().trim() };
        else if (playerName) query = { name: playerName };

        if (userId || email || playerName) {
            const user = await User.findOne(query);
            return res.json(createResponse('success', (user && user.groups) ? user.groups : []));
        }
        const groups = await Group.find({}, 'name');
        res.json(createResponse('success', groups.map(g => g.name)));
    } catch (error) {
        console.error('❌ Error en GET /groups:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/groups/:name/exists', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.name });
        res.json(createResponse('success', { exists: !!group }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/groups/:groupName/players', async (req, res) => {
    try {
        const group = await Group.findOne({ name: { $regex: new RegExp(`^${req.params.groupName}$`, 'i') } }).populate('members', 'name email nickname');
        if (!group) {
            console.warn(`[API] Grupo no encontrado: ${req.params.groupName}`);
            return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        }

        console.log(`[API] Enviando ${group.members?.length || 0} jugadores para el grupo ${group.name}`);

        const players = group.members.map(m => ({
            name: m.name,
            email: m.email,
            nickname: m.nickname || m.name,
            userId: m._id.toString()
        }));
        res.json(createResponse('success', players));
    } catch (error) {
        console.error('❌ Error en GET /groups/:groupName/players:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/groups/:groupName/players', async (req, res) => {
    try {
        const { groupName } = req.params;
        const { playerName, email, password } = req.body;

        console.log(`👤 [ADMIN] Añadiendo jugador: "${playerName}" (📧${email}) al grupo: "${groupName}"`);

        if (!playerName || !email) return res.status(400).json(createResponse('error', null, 'El nombre y email del jugador son requeridos'));

        const rawPassword = password || crypto.randomBytes(4).toString('hex');
        if (rawPassword.length < 8) {
            return res.status(400).json(createResponse('error', null, 'La contraseña debe tener al menos 8 caracteres'));
        }
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        const normalizedEmail = email.toLowerCase().trim();
        let isNewUser = false;
        let user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            console.log(`✨ Creando nuevo usuario: ${playerName} (📧${normalizedEmail})`);
            user = await User.create({
                name: playerName,
                password: hashedPassword,
                email: normalizedEmail,
                groups: [groupName],
                mustChangePassword: true,
            });
            isNewUser = true;
        } else {
            if (playerName && user.name !== playerName) {
                user.name = playerName;
            }
            if (!user.groups || !user.groups.includes(groupName)) {
                user.groups.push(groupName);
            }
            await user.save();
        }

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const isAlreadyMember = group.members.some(mId => mId.toString() === user._id.toString());

        if (!isAlreadyMember) {
            console.log(`🔗 Vinculando usuario ${user._id} al grupo ${group._id}`);
            group.members.push(user._id);
            await group.save();
        } else {
            console.log(`ℹ️ El usuario ya es miembro del grupo`);
        }

        if (isNewUser) {
            sendWelcomeEmail(normalizedEmail, playerName, groupName, rawPassword).catch(e => {
                console.error('[Email] Error enviando bienvenida:', e.message);
            });
        }

        const io = req.app.get('io');
        if (io) io.emit('group-updated', { groupName });

        res.json(createResponse('success', { isNewUser }));
    } catch (error) {
        console.error('❌ Error en POST /groups/:groupName/players:', error);
        if (error.code === 11000) {
            return res.status(400).json(createResponse('error', null, 'Este correo electrónico ya está registrado con otro nombre'));
        }
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.delete('/groups/:groupName/players/:playerName', async (req, res) => {
    try {
        const { groupName, playerName } = req.params;
        console.log(`🗑️ [ADMIN] Eliminando jugador: "${playerName}" del grupo: "${groupName}"`);

        const group = await Group.findOne({ name: groupName }).populate('members');
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const user = group.members.find(m => m.name === playerName);

        if (user) {
            if (user.groups) {
                user.groups = user.groups.filter(g => g !== groupName);
                await user.save();
            }

            group.members = group.members.filter(m => m._id.toString() !== user._id.toString());
            await group.save();

            await Prediction.deleteMany({ user: user._id, group: group._id });

            console.log(`✅ Jugador "${playerName}" (ID: ${user._id}) desvinculado correctamente`);
        } else {
            console.warn(`⚠️ Jugador "${playerName}" no encontrado en los miembros del grupo`);
        }

        const io = req.app.get('io');
        if (io) io.emit('group-updated', { groupName });

        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en DELETE /groups/:groupName/players:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/groups/:groupName/profiles', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName }).populate('members');
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const profiles = {};
        group.members.forEach(user => {
            profiles[user.name] = {
                email: user.email,
                likes: user.likes || [],
                dislikes: user.dislikes || [],
                humor_style: user.humor_style || 'Divertido y amigable',
                ai_personality: user.ai_personality || 'andres_montes',
                nickname: user.nickname || user.name,
                userId: user._id.toString()
            };
        });
        res.json(createResponse('success', profiles));
    } catch (error) {
        console.error('❌ Error en GET /groups/:groupName/profiles:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/groups/:groupName/user-mapping', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName }).populate('members', 'name email');
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const mapping = {};
        group.members.forEach(m => {
            if (m._id) {
                mapping[m._id.toString()] = m.name;
            }
        });
        res.json(createResponse('success', mapping));
    } catch (error) {
        console.error('❌ Error en GET /groups/:groupName/user-mapping:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/groups/:groupName/rules', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const data = { ...group.rules.toObject(), predictionMode: group.predictionMode || 'A' };
        res.json(createResponse('success', data));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/groups/:groupName/rules', async (req, res) => {
    try {
        const { groupName } = req.params;
        const newRules = req.body.data || {};
        const group = await Group.findOne({ name: groupName });

        if (group) {
            const oldMode = group.predictionMode || 'A';
            const newMode = req.body.predictionMode || newRules.predictionMode || newRules.prediction_mode || 'A';

            if (oldMode === 'A' && newMode === 'B') {
                console.log(`🧹 [MODO B] Limpiando predicciones eliminatorias para el grupo: ${groupName}`);
                const predictions = await Prediction.find({ group: group._id });
                for (const pred of predictions) {
                    const keys = Object.keys(pred.predictions || {});
                    let hasChanged = false;
                    keys.forEach(key => {
                        if (key.startsWith('ko_') || key.startsWith('pen_') || key.startsWith('honor_')) {
                            delete pred.predictions[key];
                            hasChanged = true;
                        }
                    });
                    if (hasChanged) {
                        pred.markModified('predictions');
                        await pred.save();
                    }
                }
            }

            group.predictionMode = newMode;
            group.rules = { ...group.rules, ...newRules };
            group.markModified('rules');
            await group.save();
        }
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /rules:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/groups/:groupName/transfer-admin', async (req, res) => {
    try {
        const { groupName } = req.params;
        const { requesterName, targetName } = req.body;

        const group = await Group.findOne({ name: groupName });
        const requester = await User.findOne({ name: requesterName });
        const target = await User.findOne({ name: targetName });

        if (!group || !requester || !target) {
            return res.status(404).json(createResponse('error', null, 'Grupo o usuario no encontrado'));
        }

        if (group.admin.toString() !== requester._id.toString()) {
            return res.status(403).json(createResponse('error', null, 'Solo el administrador actual puede traspasar el mando'));
        }

        await User.findByIdAndUpdate(requester._id, { $pull: { isAdminOf: groupName } });

        group.admin = target._id;
        await group.save();

        await User.findByIdAndUpdate(target._id, { $addToSet: { isAdminOf: groupName } });

        console.log(`👑 Traspaso de mando en ${groupName}: de ${requesterName} a ${targetName}`);
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /groups/transfer-admin:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

export default router;
