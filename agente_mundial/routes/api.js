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
import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET } from '../shared_data.js';
import { getTournamentState } from '../tournamentState.js';

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
// RUTAS DE DESARROLLO (Testing Go-Live)
// ==========================================

router.post('/dev/populate-reality', async (req, res) => {
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

router.post('/dev/reset-test', async (req, res) => {
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
            nickname: user.nickname || user.name
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
        const user = await User.findOneAndUpdate(
            query,
            { 
                $set: { 
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

// Login — ahora por teléfono + PIN
router.post('/login', async (req, res) => {
  try {
    const { phone, playerPin, groupName } = req.body;
    
    const group = await Group.findOne({ name: groupName });
    if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

    const user = await User.findOne({ phone, pin: playerPin, groups: groupName });
    if (!user) return res.status(401).json(createResponse('error', null, 'Teléfono, PIN o Grupo incorrecto'));

    const isAdmin = group.admin && group.admin.toString() === user._id.toString();
    
    console.log(`🔐 Login: ${user.name} (📱${phone}) en ${groupName}`);
    console.log(`👑 Admin del grupo ID: ${group.admin}`);
    console.log(`👤 Usuario logueado ID: ${user._id}`);
    console.log(`❓ ¿Es Admin?: ${isAdmin}`);

    res.json(createResponse('success', { isAdmin, name: user.name }));
  } catch (error) {
    console.error('❌ Error en POST /login:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

// Registro — ahora con teléfono como identificador único
router.post('/register', async (req, res) => {
  try {
    const { playerName, phone, playerPin, groupName, isNewGroup } = req.body;
    
    if (!phone || phone.length < 7) {
      return res.status(400).json(createResponse('error', null, 'El número de teléfono es obligatorio'));
    }

    // Buscar por teléfono (identificador único)
    let user = await User.findOne({ phone });
    if (!user) {
       console.log(`✨ Creando nuevo usuario: ${playerName} (📱${phone})`);
       user = await User.create({ 
         name: playerName, 
         pin: playerPin, 
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
        const { playerName, phone } = req.body;
        
        console.log(`👤 [ADMIN] Añadiendo jugador: "${playerName}" (📱${phone}) al grupo: "${groupName}"`);

        if (!playerName || !phone) return res.status(400).json(createResponse('error', null, 'El nombre y teléfono del jugador son requeridos'));

        // Buscar por teléfono (identificador único)
        let user = await User.findOne({ phone });
        if (!user) {
            console.log(`✨ Creando nuevo usuario: ${playerName} (📱${phone})`);
            user = await User.create({ 
                name: playerName, 
                pin: '1234', 
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
        
        if (user.pin !== oldPin) {
            return res.status(401).json(createResponse('error', null, 'El PIN actual es incorrecto'));
        }
        
        user.pin = newPin;
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
// RUTAS DE WHATSAPP — Vincular bot a grupo
// ==========================================

// Estado de WhatsApp para un grupo
router.get('/groups/:groupName/whatsapp-status', async (req, res) => {
    try {
        const group = await Group.findOne({ name: req.params.groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        
        const botConnected = !!(global.whatsappSock?.user);
        
        // Verificar si está vinculado en la BD
        let linked = !!group.whatsappGroupId;
        let whatsappGroupId = group.whatsappGroupId || null;
        let whatsappGroupName = null;
        
        // Si no está en la BD, verificar si está en config.js (compatibilidad)
        if (!linked) {
            const config = (await import('../config.js')).default;
            if (config.groups) {
                const configEntry = Object.entries(config.groups).find(([jid, name]) => name === req.params.groupName);
                if (configEntry) {
                    linked = true;
                    whatsappGroupId = configEntry[0];
                    // Guardar en la BD para futuras consultas
                    group.whatsappGroupId = whatsappGroupId;
                    await group.save();
                }
            }
        }

        // Si está vinculado y el bot conectado, intentar sacar el NOMBRE real del grupo de WhatsApp
        if (linked && botConnected && global.whatsappSock) {
            try {
                const metadata = await global.whatsappSock.groupMetadata(whatsappGroupId);
                whatsappGroupName = metadata.subject;
            } catch (e) {
                console.warn(`[WhatsApp] No se pudo obtener metadata del grupo ${whatsappGroupId}:`, e.message);
            }
        }
        
        res.json(createResponse('success', {
            linked,
            whatsappGroupId,
            whatsappGroupName,
            botConnected
        }));
    } catch (error) {
        console.error('❌ Error en GET /whatsapp-status:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// Vincular bot a un grupo de WhatsApp mediante enlace de invitación
router.post('/groups/:groupName/join-whatsapp', async (req, res) => {
    try {
        const { groupName } = req.params;
        const { inviteLink } = req.body;
        
        if (!inviteLink) {
            return res.status(400).json(createResponse('error', null, 'El enlace de invitación es requerido'));
        }

        // Extraer código de invitación del enlace
        // Formatos: https://chat.whatsapp.com/CODE o solo CODE
        const match = inviteLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
        const inviteCode = match ? match[1] : inviteLink.trim();
        
        if (!inviteCode || inviteCode.length < 10) {
            return res.status(400).json(createResponse('error', null, 'Enlace de invitación inválido'));
        }

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));

        // Verificar que el bot está conectado
        if (!global.whatsappSock?.user) {
            return res.status(503).json(createResponse('error', null, 'El bot de WhatsApp no está conectado. Inténtalo más tarde.'));
        }

        console.log(`🔗 [WhatsApp] Intentando unir bot al grupo "${groupName}" con código: ${inviteCode}`);

        try {
            // Intentar unirse al grupo
            const groupJid = await global.whatsappSock.groupAcceptInvite(inviteCode);
            console.log(`✅ [WhatsApp] Bot unido al grupo. JID: ${groupJid}`);
            
            // Guardar el JID en el grupo
            group.whatsappGroupId = groupJid;
            await group.save();
            
            res.json(createResponse('success', { whatsappGroupId: groupJid }));
        } catch (waError) {
            console.error('❌ [WhatsApp] Error al unirse:', waError.message);
            
            // Si el error es que ya está en el grupo, intentar obtener el JID
            if (waError.message?.includes('already') || waError.message?.includes('conflict') || waError.message?.includes('bad-request')) {
                // Intentar obtener info del grupo con el código de invitación
                try {
                    const groupInfo = await global.whatsappSock.groupGetInviteInfo(inviteCode);
                    if (groupInfo?.id) {
                        group.whatsappGroupId = groupInfo.id;
                        await group.save();
                        console.log(`✅ [WhatsApp] Bot ya estaba en el grupo. JID: ${groupInfo.id}`);
                        return res.json(createResponse('success', { whatsappGroupId: groupInfo.id, alreadyMember: true }));
                    }
                } catch (infoError) {
                    console.error('❌ [WhatsApp] Error obteniendo info del grupo:', infoError.message);
                }
            }
            
            return res.status(400).json(createResponse('error', null, `No se pudo unir al grupo: ${waError.message}`));
        }
    } catch (error) {
        console.error('❌ Error en POST /join-whatsapp:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

// Desvincular bot de un grupo de WhatsApp
router.post('/groups/:groupName/leave-whatsapp', async (req, res) => {
    try {
        const { groupName } = req.params;
        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(404).json(createResponse('error', null, 'Grupo no encontrado'));
        
        if (!group.whatsappGroupId) {
            return res.status(400).json(createResponse('error', null, 'El grupo no tiene WhatsApp vinculado'));
        }

        // Intentar salir del grupo de WhatsApp
        if (global.whatsappSock?.user) {
            try {
                await global.whatsappSock.groupLeave(group.whatsappGroupId);
                console.log(`👋 [WhatsApp] Bot salió del grupo "${groupName}" (${group.whatsappGroupId})`);
            } catch (waError) {
                console.warn(`⚠️ [WhatsApp] Error al salir del grupo (puede que ya no estemos): ${waError.message}`);
            }
        }
        
        // Limpiar el campo en la BD
        group.whatsappGroupId = null;
        await group.save();
        
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /leave-whatsapp:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

export default router;

