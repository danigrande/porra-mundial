import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Prediction } from '../models/Prediction.js';
import { Summary } from '../models/Summary.js';
import { Message } from '../models/Message.js';
import { Reality } from '../models/Reality.js';
import { Report } from '../models/Report.js';
import { BlockedUser } from '../models/BlockedUser.js';
import * as scoringEngine from '../scoringEngine.js';
import * as groqEngine from '../groqEngine.js';
import * as apiFootballService from '../apiFootballService.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET } from '../shared_data.js';
import { getTournamentState } from '../tournamentState.js';
import { triggerAutoSimulationIfNeeded } from '../autoSimulator.js';
import { adminAuth } from '../middleware.js';

const router = express.Router();

// Helper para envolver las respuestas
const createResponse = (status, data = null, message = null) => {
  return { status, data, message };
};

// ==========================================
// ESTADO DEL TORNEO
// ==========================================
router.get('/tournament-state', async (req, res) => {
  const { groupName } = req.query;
  await triggerAutoSimulationIfNeeded();
  res.json(createResponse('success', await getTournamentState(groupName)));
});

// Middleware para verificar conexión a DB
router.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') return next(); 
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json(createResponse('error', null, 'La base de datos no está conectada. Revisa MONGODB_URI en Render.'));
    }
    next();
});

// ==========================================
// RUTAS DE REALIDAD (Resultados Oficiales)
// ==========================================

router.get('/reality', async (req, res) => {
    try {
        await triggerAutoSimulationIfNeeded();
        const reality = await Reality.findOne({ tournament: 'worldcup2026' });
        res.json(createResponse('success', reality ? reality.results : {}));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/reality', async (req, res) => {
    try {
        const { results } = req.body;
        // Si results.events es undefined, mantenemos los existentes. 
        // Pero si es un objeto vacío {}, significa que queremos borrarlos.
        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const existingResults = realityDoc ? realityDoc.results : {};
        
        let events = results.events;
        if (events === undefined) {
            events = existingResults.events || {};
        }
        
        const mergedResults = { ...results, events };

        await Reality.findOneAndUpdate(
            { tournament: 'worldcup2026' },
            { results: mergedResults, updatedAt: new Date() },
            { upsert: true }
        );
        res.json(createResponse('success'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.delete('/profile', async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json(createResponse('error', null, 'Falta phone'));

        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

        // Eliminar predicciones, mensajes y el usuario
        await Prediction.deleteMany({ user: user._id });
        await Message.deleteMany({ sender: user.name });
        await User.findByIdAndDelete(user._id);

        res.json(createResponse('success', null, 'Cuenta eliminada correctamente'));
    } catch (error) {
        console.error('❌ Error DELETE /profile:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/report', async (req, res) => {
    try {
        const { reporterPhone, reportedUser, messageId, reason } = req.body;
        if (!reporterPhone || !reportedUser || !reason) {
            return res.status(400).json(createResponse('error', null, 'Faltan campos obligatorios'));
        }

        // Recuperar el texto del mensaje si existe
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
            reporterPhone,
            reportedUser,
            messageId,
            messageText,
            reason,
            groupName
        });

        console.log(`🚩 REPORTE #${report._id}: De ${reporterPhone} contra ${reportedUser}. Motivo: ${reason}`);
        res.json(createResponse('success', { reportId: report._id }, 'Reporte enviado a moderación'));
    } catch (error) {
        console.error('❌ Error en POST /report:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// --- Bloquear usuario (server-side) ---
router.post('/block', async (req, res) => {
    try {
        const { blockerPhone, blockedPhone, groupName } = req.body;
        if (!blockerPhone || !blockedPhone) {
            return res.status(400).json(createResponse('error', null, 'Faltan campos obligatorios'));
        }
        await BlockedUser.findOneAndUpdate(
            { blockerPhone, blockedPhone },
            { blockerPhone, blockedPhone, groupName, createdAt: new Date() },
            { upsert: true }
        );
        console.log(`🚫 BLOQUEO: ${blockerPhone} bloqueó a ${blockedPhone}`);
        res.json(createResponse('success', null, 'Usuario bloqueado'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// --- Desbloquear usuario ---
router.post('/unblock', async (req, res) => {
    try {
        const { blockerPhone, blockedPhone } = req.body;
        await BlockedUser.deleteOne({ blockerPhone, blockedPhone });
        res.json(createResponse('success', null, 'Usuario desbloqueado'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// --- Obtener lista de bloqueados ---
router.get('/blocked', async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json(createResponse('error', null, 'Falta phone'));
        const blocked = await BlockedUser.find({ blockerPhone: phone }).lean();
        res.json(createResponse('success', blocked.map(b => b.blockedPhone)));
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
        
        // Actualizar resultados del partido
        results[`${matchId}_h`] = simData.goals.home.toString();
        results[`${matchId}_a`] = simData.goals.away.toString();
        results[`${matchId}_date`] = simData.date;
        if (simData.penalties) {
            results[`pen_${matchId.replace('ko_', '')}_h`] = simData.penalties.home.toString();
            results[`pen_${matchId.replace('ko_', '')}_a`] = simData.penalties.away.toString();
        }

        // Actualizar eventos
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

// ==========================================
// RUTAS DE DESARROLLO (Testing Go-Live)
// ==========================================

router.post('/dev/populate-reality', adminAuth, async (req, res) => {
    try {
        const { phaseId } = req.body; // 'groups', 'r32', 'r16', 'qf', 'sf', '3rd', 'final'
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

        // 1. Borrar predicciones del grupo
        await Prediction.deleteMany({ group: group._id });

        // 2. Resetear estados de notificación del grupo
        group.lastAnnouncedPhase = null;
        group.lastReminderPhase = null;
        await group.save();

        // 3. Borrar resultados de realidad (opcional, resetea TODO el mundial de test)
        await Reality.deleteOne({ tournament: 'worldcup2026' });

        res.json(createResponse('success', { message: `Grupo ${groupName} reseteado para el test` }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});


// ==========================================
// RUTAS DE RESÚMENES (IA)
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

        // Obtener datos para el ranking
        const predictions = await Prediction.find({ group: group._id }).populate('user', 'name');
        const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
        const reality = realityDoc ? realityDoc.results : {};

        // Mapear predicciones para el motor de puntos
        const playersData = {};
        predictions.forEach(p => { if (p.user) playersData[p.user.name] = { predictions: p.predictions }; });

        // Calcular ranking
        const leaderboard = scoringEngine.calculateLeaderboard(playersData, reality, group.rules);
        const playerStats = leaderboard.find(p => p.name === player);

        // Recuperar contexto RAG del chat nativo
        let chatContext = "";
        try {
            const rag = await import('../ragService.js');
            const chatId = groupName;
            chatContext = await rag.retrieveContextForPlayer(chatId, player);
        } catch (e) {
            console.warn('⚠️ No se pudo recuperar contexto RAG:', e.message);
        }

        // Generar resumen con IA
        const summaryText = await groqEngine.generatePersonalitySummary(player, groupName, {
            playerStats,
            leaderboard,
            chatContext
        });

        // Guardar/Actualizar en DB
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

router.get('/profile', async (req, res) => {
    try {
        const { playerName, phone } = req.query;
        // Buscar por phone primero, fallback a name
        const user = phone 
            ? await User.findOne({ phone }) 
            : await User.findOne({ name: playerName });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));
        
        res.json(createResponse('success', {
            name: user.name,
            phone: user.phone,
            likes: user.likes || [],
            dislikes: user.dislikes || [],
            humor_style: user.humor_style || 'Divertido y amigable',
            ai_personality: user.ai_personality || 'andres_montes',
            nickname: user.nickname || user.name,
            notificationPreference: user.notificationPreference || 'all'
        }));
    } catch (error) {
        console.error('❌ Error en GET /profile:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/profile', async (req, res) => {
    try {
        const { playerName, phone, groupName, profile } = req.body;
        if (!profile) throw new Error('El perfil es requerido');

        // Buscar por phone primero, fallback a name
        const query = phone ? { phone } : { name: playerName };
        console.log(`👤 [Profile] Actualizando preferencias para ${phone || playerName}:`, profile.notificationPreference);
        const user = await User.findOneAndUpdate(
            query,
            { 
                $set: { 
                    nickname: profile.nickname || playerName,
                    likes: profile.likes || [],
                    dislikes: profile.dislikes || [],
                    humor_style: profile.humor_style || 'Divertido y amigable',
                    ai_personality: profile.ai_personality || 'andres_montes',
                    notificationPreference: profile.notificationPreference || 'all'
                }
            },
            { new: true }
        );
        res.json(createResponse('success', { notificationPreference: user.notificationPreference }));
    } catch (error) {
        console.error('❌ Error en POST /profile:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// GRUPOS Y REGLAS
// ==========================================

router.get('/groups/:groupName/rules', async (req, res) => {
    try {
        const { groupName } = req.params;
        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        
        res.json(createResponse('success', {
            ...group.rules.toObject(),
            predictionMode: group.predictionMode
        }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/groups/:groupName/rules', async (req, res) => {
    try {
        const { groupName } = req.params;
        const { data, predictionMode } = req.body;

        const group = await Group.findOneAndUpdate(
            { name: groupName },
            { 
                rules: data, 
                predictionMode: predictionMode,
                updatedAt: new Date() 
            },
            { new: true }
        );

        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        res.json(createResponse('success', group.rules));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// RUTAS DE AUTENTICACIÓN Y JUGADORES
// ==========================================


// Login — ahora con PIN hasheado
router.post('/login', async (req, res) => {
  try {
    const { phone, playerPin, groupName } = req.body;
    
    const group = await Group.findOne({ name: groupName });
    if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

    const user = await User.findOne({ phone, groups: groupName });
    if (!user) return res.status(401).json(createResponse('error', null, 'Teléfono o Grupo incorrecto'));

    // Verificar PIN (con fallback a texto plano para usuarios antiguos)
    let isMatch = false;
    if (user.pin.startsWith('$2a$') || user.pin.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(playerPin, user.pin);
    } else {
        isMatch = (user.pin === playerPin);
        // Si coincide en texto plano, lo hasheamos ahora
        if (isMatch) {
            user.pin = await bcrypt.hash(playerPin, 10);
            await user.save();
            console.log(`🔐 PIN de ${user.name} actualizado a hash automáticamente`);
        }
    }

    if (!isMatch) return res.status(401).json(createResponse('error', null, 'PIN incorrecto'));

    const isAdmin = group.admin && group.admin.toString() === user._id.toString();
    
    console.log(`🔐 Login exitoso: ${user.name} (📱${phone}) en ${groupName}`);

    res.json(createResponse('success', { isAdmin, name: user.name }));
  } catch (error) {
    console.error('❌ Error en POST /login:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

// Registro — con PIN hasheado
router.post('/register', async (req, res) => {
  try {
    const { playerName, phone, playerPin, groupName, isNewGroup } = req.body;
    
    if (!phone || phone.length < 7) {
      return res.status(400).json(createResponse('error', null, 'El número de teléfono es obligatorio'));
    }

    // Hashear PIN
    const hashedPin = await bcrypt.hash(playerPin, 10);

    // Buscar por teléfono (identificador único)
    let user = await User.findOne({ phone });
    if (!user) {
       console.log(`✨ Creando nuevo usuario: ${playerName} (📱${phone})`);
       user = await User.create({ 
         name: playerName, 
         pin: hashedPin, 
         phone, 
         groups: [groupName] 
       });
    } else {
       // El teléfono ya existe — añadir al nuevo grupo si no está
       if (!user.groups.includes(groupName)) {
           user.groups.push(groupName);
           await user.save();
       }
    }

    if (isNewGroup) {
      const existingGroup = await Group.findOne({ name: groupName });
      if (existingGroup) return res.status(400).json(createResponse('error', null, 'El grupo ya existe'));
      
      const newGroup = await Group.create({ name: groupName, admin: user._id, members: [user._id] });
      user.isAdminOf.push(groupName);
      await user.save();
    } else {
       const group = await Group.findOne({ name: groupName });
       if (group && !group.members.includes(user._id)) {
           group.members.push(user._id);
           await group.save();
       }
    }

    // Notificar cambios en el grupo por Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('group-updated', { groupName });
    }

    res.json(createResponse('success', { name: user.name }, 'Usuario registrado con éxito'));
  } catch (error) {
    console.error('❌ Error en POST /register:', error);
    if (error.code === 11000) {
      return res.status(400).json(createResponse('error', null, 'Este número de teléfono ya está registrado'));
    }
    res.status(500).json(createResponse('error', null, error.message));
  }
});


// ==========================================
// RUTAS DE GRUPOS Y REGLAS
// ==========================================

router.get('/groups', async (req, res) => {
    try {
        const { playerName, phone } = req.query;
        // Buscar por phone primero, fallback a name
        if (phone || playerName) {
            const query = phone ? { phone } : { name: playerName };
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

router.get('/groups/:groupName/players', async (req, res) => {
    try {
        // Búsqueda insensible a mayúsculas/minúsculas
        const group = await Group.findOne({ name: { $regex: new RegExp(`^${req.params.groupName}$`, 'i') } }).populate('members', 'name phone nickname');
        if (!group) {
            console.warn(`[API] Grupo no encontrado: ${req.params.groupName}`);
            return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        }

        console.log(`[API] Enviando ${group.members?.length || 0} jugadores para el grupo ${group.name}`);

        console.log(`[API] Raw members first element type: ${typeof group.members[0]}, value:`, group.members[0]);
        const players = group.members.map(m => ({
            name: m.name,
            phone: m.phone,
            nickname: m.nickname || m.name
        }));
        res.json(createResponse('success', players, 'DEBUG_OBJECTS_ACTIVE'));
    } catch (error) {
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
                phone: user.phone,
                likes: user.likes || [],
                dislikes: user.dislikes || [],
                humor_style: user.humor_style || 'Divertido y amigable',
                ai_personality: user.ai_personality || 'andres_montes',
                nickname: user.nickname || user.name
            };
        });
        res.json(createResponse('success', profiles));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/groups/:groupName/phone-mapping', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName }).populate('members', 'name phone');
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        
        const mapping = {};
        group.members.forEach(m => {
            if (m.phone && m.phone !== '000000') {
                mapping[m.phone] = m.name;
            }
        });
        res.json(createResponse('success', mapping));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/groups/:groupName/players', async (req, res) => {
    try {
        const { groupName } = req.params;
        const { playerName, phone } = req.body;
        
        console.log(`👤 [ADMIN] Añadiendo jugador: "${playerName}" (📱${phone}) al grupo: "${groupName}"`);

        if (!playerName || !phone) return res.status(400).json(createResponse('error', null, 'El nombre y teléfono del jugador son requeridos'));

        // Hashear PIN
        const hashedPin = await bcrypt.hash('1234', 10);

        // Buscar por teléfono (identificador único)
        let user = await User.findOne({ phone });
        if (!user) {
            console.log(`✨ Creando nuevo usuario: ${playerName} (📱${phone})`);
            user = await User.create({ 
                name: playerName, 
                pin: hashedPin, 
                phone, 
                groups: [groupName] 
            });
        } else {
            // Si el usuario ya existe, actualizar nombre si se proporcionó uno diferente
            if (playerName && user.name !== playerName) {
                user.name = playerName;
            }
            if (!user.groups.includes(groupName)) {
                console.log(`📝 Actualizando grupos del usuario: ${playerName}`);
                user.groups.push(groupName);
            }
            await user.save();
        }

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        // Evitar duplicados de forma robusta comparando strings de IDs
        const isAlreadyMember = group.members.some(mId => mId.toString() === user._id.toString());
        
        if (!isAlreadyMember) {
            console.log(`🔗 Vinculando usuario ${user._id} al grupo ${group._id}`);
            group.members.push(user._id);
            await group.save();
        } else {
            console.log(`ℹ️ El usuario ya es miembro del grupo`);
        }

        // Notificar cambios en el grupo
        const io = req.app.get('io');
        if (io) io.emit('group-updated', { groupName });

        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /groups/:groupName/players:', error);
        if (error.code === 11000) {
            return res.status(400).json(createResponse('error', null, 'Este número de teléfono ya está registrado con otro nombre'));
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
            // 1. Eliminar de la lista de grupos del usuario
            if (user.groups) {
                user.groups = user.groups.filter(g => g !== groupName);
                await user.save();
            }
            
            // 2. Eliminar de los miembros del grupo
            group.members = group.members.filter(m => m._id.toString() !== user._id.toString());
            await group.save();
            
            // 3. Borrar sus predicciones (Limpieza total)
            await Prediction.deleteMany({ user: user._id, group: group._id });
            
            console.log(`✅ Jugador "${playerName}" (ID: ${user._id}) desvinculado correctamente`);
        } else {
            console.warn(`⚠️ Jugador "${playerName}" no encontrado en los miembros del grupo`);
        }

        // Notificar cambios en el grupo
        const io = req.app.get('io');
        if (io) io.emit('group-updated', { groupName });

        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en DELETE /groups/:groupName/players:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});


router.get('/groups/:groupName/rules', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        
        // Devolvemos las reglas + el modo de predicción
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

            // Si cambiamos de A -> B, borramos predicciones de eliminatorias
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

// Cambiar PIN — ahora busca por teléfono
router.post('/profile/change-pin', async (req, res) => {
    try {
        const { playerName, phone, groupName, oldPin, newPin } = req.body;
        
        if (!newPin || newPin.length !== 4) {
            return res.status(400).json(createResponse('error', null, 'El nuevo PIN debe tener 4 dígitos'));
        }

        // Buscar por phone primero, fallback a name
        const query = phone ? { phone, groups: groupName } : { name: playerName, groups: groupName };
        const user = await User.findOne(query);
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

        // Verificar PIN actual (con fallback)
        let isMatch = false;
        if (user.pin.startsWith('$2a$') || user.pin.startsWith('$2b$')) {
            isMatch = await bcrypt.compare(oldPin, user.pin);
        } else {
            isMatch = (user.pin === oldPin);
        }
        
        if (!isMatch) {
            return res.status(401).json(createResponse('error', null, 'El PIN actual es incorrecto'));
        }
        
        user.pin = await bcrypt.hash(newPin, 10);
        await user.save();
        
        console.log(`🔐 PIN actualizado para ${user.name} (📱${user.phone}) en ${groupName}`);
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /profile/change-pin:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// Traspasar admin del grupo (Desde el admin actual)
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
        
        // Verificar que el solicitante sea el admin actual
        if (group.admin.toString() !== requester._id.toString()) {
            return res.status(403).json(createResponse('error', null, 'Solo el administrador actual puede traspasar el mando'));
        }
        
        // Traspaso
        // 1. Quitar al antiguo
        await User.findByIdAndUpdate(requester._id, { $pull: { isAdminOf: groupName } });
        
        // 2. Cambiar grupo
        group.admin = target._id;
        await group.save();
        
        // 3. Añadir al nuevo
        await User.findByIdAndUpdate(target._id, { $addToSet: { isAdminOf: groupName } });
        
        console.log(`👑 Traspaso de mando en ${groupName}: de ${requesterName} a ${targetName}`);
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /groups/transfer-admin:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// RUTAS DE CHAT (App Móvil)
// ==========================================

// Historial de mensajes de un grupo (paginado)
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

// ==========================================
// RUTAS DE PUSH NOTIFICATIONS
// ==========================================

// Registrar token de push notification
router.post('/push-token', async (req, res) => {
    try {
        const { phone, token, platform } = req.body;
        if (!phone || !token) {
            return res.status(400).json(createResponse('error', null, 'phone y token son requeridos'));
        }
        
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));
        
        const pushService = await import('../pushService.js');
        await pushService.registerToken(user._id.toString(), token, platform || 'android');
        
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /push-token:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// Eliminar token de push notification (logout)
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

// Ruta temporal para probar notificaciones push del Bot
router.get('/test-push/:groupName', async (req, res) => {
    try {
        const { groupName } = req.params;
        const pushService = await import('../pushService.js');
        
        await pushService.sendToGroup(
            groupName, 
            '🏆 Agente Mundial (Test)', 
            'Esta es una notificación de prueba para verificar tus ajustes de silencio.', 
            { screen: 'chat', groupName }
        );
        
        res.json(createResponse('success', { message: `Notificación de prueba enviada al grupo ${groupName}` }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// BUSCAR USUARIO POR TELÉFONO (para la app)
// ==========================================
router.get('/user/by-phone/:phone', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.params.phone });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));
        
        res.json(createResponse('success', {
            name: user.name,
            phone: user.phone,
            groups: user.groups,
            isAdminOf: user.isAdminOf || [],
            nickname: user.nickname || user.name,
        }));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// REGLAS DEL GRUPO (Admin)
// ==========================================
router.get('/groups/:groupName/rules', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        
        res.json(createResponse('success', group.rules || {}));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/groups/:groupName/rules', async (req, res) => {
    try {
        const { data, predictionMode } = req.body;
        const group = await Group.findOne({ name: req.params.groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        
        if (data) group.rules = data;
        if (predictionMode) group.predictionMode = predictionMode;
        
        await group.save();
        res.json(createResponse('success'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// PREDICCIONES
// ==========================================


router.get('/predictions', async (req, res) => {
    try {
        const { groupName, phone } = req.query;
        if (!groupName) return res.status(400).json(createResponse('error', null, 'Falta groupName'));

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        if (phone) {
            // Predicciones de un solo usuario
            const user = await User.findOne({ phone });
            if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));
            
            const pred = await Prediction.findOne({ user: user._id, group: group._id });
            return res.json(createResponse('success', pred ? pred.predictions : {}));
        } else {
            // Todas las predicciones del grupo
            const preds = await Prediction.find({ group: group._id }).populate('user', 'name');
            const result = {};
            preds.forEach(p => {
                if (p.user) result[p.user.name] = { predictions: p.predictions };
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
        // En la app mandamos playerName (que en realidad no es phone). Ah no, api.ts manda playerName.
        // Mejor cambiamos el backend para usar playerName o phone.
        const { playerName, groupName, predictions } = req.body;
        if (!playerName || !groupName || !predictions) {
            return res.status(400).json(createResponse('error', null, 'Faltan datos'));
        }

        // Buscamos al usuario por nombre en el grupo
        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        const user = await User.findOne({ name: playerName, groups: groupName });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado en este grupo'));

        let pred = await Prediction.findOne({ user: user._id, group: group._id });
        if (!pred) {
            pred = new Prediction({ user: user._id, group: group._id, predictions });
        } else {
            pred.predictions = predictions;
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
            if (p.user) playersData[p.user.name] = { predictions: p.predictions }; 
        });

        const leaderboard = scoringEngine.calculateLeaderboard(playersData, reality, group.rules);
        res.json(createResponse('success', leaderboard));
    } catch (error) {
        console.error('❌ Error obteniendo leaderboard:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// --- Proxy de GIPHY (Para ocultar la API key en el cliente) ---
router.get('/giphy/search', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        const apiKey = process.env.GIPHY_API_KEY || 'XszfwZBVBmHmmFMxmAQqY1VuQu8YDUsR';
        const response = await axios.get(`https://api.giphy.com/v1/gifs/search`, {
            params: {
                api_key: apiKey,
                q: q || 'soccer world cup',
                limit,
                rating: 'g' // Rating obligatorio para App Store
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
