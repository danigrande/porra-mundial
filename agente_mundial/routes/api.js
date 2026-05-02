import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Prediction } from '../models/Prediction.js';
import { Summary } from '../models/Summary.js';
import { Reality } from '../models/Reality.js';
import * as scoringEngine from '../scoringEngine.js';
import * as groqEngine from '../groqEngine.js';
import * as apiFootballService from '../apiFootballService.js';
import { FIXTURE_GROUPS, BRACKET_MATCHES } from '../shared_data.js';

const router = express.Router();

// Helper para envolver las respuestas
const createResponse = (status, data = null, message = null) => {
  return { status, data, message };
};

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

router.post('/admin/simulate-match', async (req, res) => {
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

router.post('/admin/simulate-all', async (req, res) => {
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

        // Recuperar contexto RAG del chat de WhatsApp
        let chatContext = "";
        try {
            const rag = await import('../ragService.js');
            const config = await import('../config.js');
            const chatId = process.env.WHATSAPP_GROUP_ID || config.default.bot.groupId;
            chatContext = await rag.retrieveContextForPlayer(chatId, player);
            
            console.log(`\n🧠 [AUDITORÍA RAG] Lo que el bot recuerda sobre "${player}":`);
            console.log(chatContext || "No hay nada en memoria.");
            console.log("--------------------------------------------------\n");
        } catch (e) {
            console.error("❌ Error recuperando RAG Web:", e);
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
        const { playerName } = req.query;
        const user = await User.findOne({ name: playerName });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));
        
        res.json(createResponse('success', {
            phone: user.phone,
            likes: user.likes || [],
            dislikes: user.dislikes || [],
            humor_style: user.humor_style || 'Divertido y amigable',
            nickname: user.nickname || user.name
        }));
    } catch (error) {
        console.error('❌ Error en GET /profile:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/profile', async (req, res) => {
    try {
        const { playerName, groupName, profile } = req.body;
        if (!profile) throw new Error('El perfil es requerido');

        const user = await User.findOneAndUpdate(
            { name: playerName },
            { 
                $set: { 
                    phone: profile.phone || '000000',
                    nickname: profile.nickname || playerName,
                    likes: profile.likes || [],
                    dislikes: profile.dislikes || [],
                    humor_style: profile.humor_style || 'Divertido y amigable'
                }
            },
            { new: true }
        );
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /profile:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// RUTAS DE AUTENTICACIÓN Y JUGADORES
// ==========================================

// Login
router.post('/login', async (req, res) => {
  try {
    const { playerName, playerPin, groupName } = req.body;
    
    const group = await Group.findOne({ name: groupName });
    if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

    const user = await User.findOne({ name: playerName, pin: playerPin, groups: groupName });
    if (!user) return res.status(401).json(createResponse('error', null, 'PIN o Grupo incorrecto'));

    const isAdmin = group.admin && group.admin.toString() === user._id.toString();
    
    console.log(`🔐 Login: ${playerName} en ${groupName}`);
    console.log(`👑 Admin del grupo ID: ${group.admin}`);
    console.log(`👤 Usuario logueado ID: ${user._id}`);
    console.log(`❓ ¿Es Admin?: ${isAdmin}`);

    res.json(createResponse('success', { isAdmin }));
  } catch (error) {
    console.error('❌ Error en POST /login:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

// Registro
router.post('/register', async (req, res) => {
  try {
    const { playerName, playerPin, groupName, isNewGroup } = req.body;
    
    // Verificaciones y creación (simplificado por ahora)
    let user = await User.findOne({ name: playerName });
    if (!user) {
       console.log(`✨ Creando nuevo usuario: ${playerName}`);
       user = await User.create({ 
         name: playerName, 
         pin: playerPin, 
         phone: `AUTO_${Date.now()}_${Math.floor(Math.random() * 1000)}`, 
         groups: [groupName] 
       });
    } else {
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

    res.json(createResponse('success', null, 'Usuario registrado con éxito'));
  } catch (error) {
    console.error('❌ Error en POST /register:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

// ==========================================
// RUTAS DE PREDICCIONES
// ==========================================

router.get('/predictions', async (req, res) => {
    try {
        const { groupName } = req.query;
        console.log(`🔍 Buscando predicciones para el grupo: "${groupName}"`);
        
        const group = await Group.findOne({ name: groupName });
        if (!group) {
            console.error(`❌ Grupo "${groupName}" no encontrado en MongoDB`);
            return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        }

        const predictions = await Prediction.find({ group: group._id }).populate('user', 'name');
        console.log(`📈 Encontradas ${predictions.length} predicciones para el grupo ${groupName}`);
        
        const result = {};
        predictions.forEach(p => {
            if (p.user && p.user.name) {
                result[p.user.name] = {
                    timestamp: p.updatedAt,
                    predictions: p.predictions
                };
            }
        });
        res.json(createResponse('success', result));
    } catch (error) {
        console.error('❌ Error en GET /predictions:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/predictions', async (req, res) => {
    try {
        const { playerName, groupName, predictions } = req.body;
        const user = await User.findOne({ name: playerName });
        const group = await Group.findOne({ name: groupName });
        
        if (!user || !group) return res.status(404).json(createResponse('error', null, 'Usuario o Grupo no encontrado'));

        let pred = await Prediction.findOne({ user: user._id, group: group._id });
        if (pred) {
            pred.predictions = predictions;
            pred.updatedAt = new Date();
            await pred.save();
        } else {
            await Prediction.create({ user: user._id, group: group._id, predictions });
        }
        
        res.json(createResponse('success'));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// ==========================================
// RUTAS DE GRUPOS Y REGLAS
// ==========================================

router.get('/groups', async (req, res) => {
    try {
        const { playerName } = req.query;
        if (playerName) {
            const user = await User.findOne({ name: playerName });
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
        const group = await Group.findOne({ name: req.params.groupName }).populate('members', 'name');
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        res.json(createResponse('success', group.members.map(m => m.name)));
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
        const { playerName } = req.body;
        
        console.log(`👤 [ADMIN] Añadiendo jugador: "${playerName}" al grupo: "${groupName}"`);

        if (!playerName) return res.status(400).json(createResponse('error', null, 'El nombre del jugador es requerido'));

        let user = await User.findOne({ name: playerName });
        if (!user) {
            console.log(`✨ Creando nuevo usuario: ${playerName}`);
            user = await User.create({ 
                name: playerName, 
                pin: '1234', 
                phone: `AUTO_${Date.now()}_${Math.floor(Math.random() * 1000)}`, 
                groups: [groupName] 
            });
        } else if (!user.groups.includes(groupName)) {
            console.log(`📝 Actualizando grupos del usuario: ${playerName}`);
            user.groups.push(groupName);
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

        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /groups/:groupName/players:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.delete('/groups/:groupName/players/:playerName', async (req, res) => {
    try {
        const { groupName, playerName } = req.params;
        console.log(`🗑️ [ADMIN] Eliminando jugador: "${playerName}" del grupo: "${groupName}"`);

        const user = await User.findOne({ name: playerName });
        const group = await Group.findOne({ name: groupName });
        
        if (user && group) {
            // Eliminar de la lista de grupos del usuario
            if (user.groups) {
                user.groups = user.groups.filter(g => g !== groupName);
                await user.save();
            }
            
            // Eliminar de los miembros del grupo
            if (group.members) {
                group.members = group.members.filter(id => id.toString() !== user._id.toString());
                await group.save();
            }
            
            // Opcional: Podríamos borrar sus predicciones aquí si quisiéramos ser estrictos
            // await Prediction.deleteMany({ user: user._id, group: group._id });
            console.log(`✅ Jugador "${playerName}" desvinculado correctamente`);
        }
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en DELETE /groups/:groupName/players:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.get('/groups/:groupName/rules', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName });
        res.json(createResponse('success', group ? group.rules : {}));
    } catch (error) {
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/groups/:groupName/rules', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName });
        if (group) {
            group.rules = { ...group.rules, ...req.body.data };
            group.markModified('rules'); // Forzar a Mongoose a detectar el cambio en el objeto Mixed
            await group.save();
        }
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /rules:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// Cambiar PIN
router.post('/profile/change-pin', async (req, res) => {
    try {
        const { playerName, groupName, oldPin, newPin } = req.body;
        
        if (!newPin || newPin.length !== 4) {
            return res.status(400).json(createResponse('error', null, 'El nuevo PIN debe tener 4 dígitos'));
        }

        const user = await User.findOne({ name: playerName, groups: groupName });
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));
        
        if (user.pin !== oldPin) {
            return res.status(401).json(createResponse('error', null, 'El PIN actual es incorrecto'));
        }
        
        user.pin = newPin;
        await user.save();
        
        console.log(`🔐 PIN actualizado para ${playerName} en ${groupName}`);
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

export default router;
