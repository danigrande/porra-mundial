import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Prediction } from '../models/Prediction.js';
import { Message } from '../models/Message.js';
import { createResponse } from './helpers.js';
import { sendResetCode, isEmailConfigured, ensureInit } from '../emailService.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password, groupName } = req.body;
    if (!email || !password) {
      return res.status(400).json(createResponse('error', null, 'Email y contraseña son obligatorios'));
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json(createResponse('error', null, 'Usuario no encontrado'));
    }

    if (groupName && (!user.groups || !user.groups.includes(groupName))) {
        return res.status(401).json(createResponse('error', null, 'El usuario no pertenece a este grupo'));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json(createResponse('error', null, 'Contraseña incorrecta'));
    }

    const isAdmin = user.isAdminOf && user.isAdminOf.includes(groupName);

    console.log(`🔐 Login exitoso: ${user.name} (📧${user.email})`);

    res.json(createResponse('success', {
        isAdmin,
        name: user.name,
        userId: user._id.toString(),
        email: user.email,
        groups: user.groups || [],
        mustChangePassword: user.mustChangePassword || false
    }));
  } catch (error) {
    console.error('❌ Error en POST /login:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

router.post('/register', async (req, res) => {
  try {
    const { playerName, email, password, groupName } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json(createResponse('error', null, 'El correo electrónico no es válido'));
    }
    if (!password || password.length < 8) {
      return res.status(400).json(createResponse('error', null, 'La contraseña debe tener al menos 8 caracteres'));
    }
    if (!groupName) {
      return res.status(400).json(createResponse('error', null, 'El nombre del grupo es obligatorio'));
    }

    const existingGroup = await Group.findOne({ name: groupName });
    if (existingGroup) {
      return res.status(400).json(createResponse('error', null, `El grupo "${groupName}" ya existe. Para unirte, pídele al administrador que te añada desde la gestión de miembros.`));
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.log(`✨ Creando nuevo usuario: ${playerName} (📧${normalizedEmail})`);
      user = await User.create({
        name: playerName,
        password: await bcrypt.hash(password, 10),
        email: normalizedEmail,
        groups: [groupName],
        isAdminOf: [groupName],
      });
    } else {
      if (!user.groups.includes(groupName)) {
        user.groups.push(groupName);
      }
      if (!user.isAdminOf.includes(groupName)) {
        user.isAdminOf.push(groupName);
      }
      await user.save();
    }

    const newGroup = await Group.create({ name: groupName, admin: user._id, members: [user._id] });

    const io = req.app.get('io');
    if (io) io.emit('group-updated', { groupName });

    res.json(createResponse('success', { name: user.name, userId: user._id.toString(), email: user.email }, 'Grupo creado con éxito'));
  } catch (error) {
    console.error('❌ Error en POST /register:', error);
    if (error.code === 11000) {
      return res.status(400).json(createResponse('error', null, 'Este correo electrónico ya está registrado'));
    }
    res.status(500).json(createResponse('error', null, error.message));
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json(createResponse('error', null, 'Email requerido'));
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json(createResponse('success', { method: 'none' }, 'Si el email existe, recibirás instrucciones'));
    }

    await ensureInit();

    if (isEmailConfigured()) {
      const code = crypto.randomInt(100000, 999999).toString();
      const token = crypto.randomBytes(32).toString('hex');

      user.resetToken = token;
      user.resetCode = code;
      user.resetTokenExpires = new Date(Date.now() + 3600000);
      await user.save();

      try {
        await sendResetCode(user.email, code);
        console.log(`📧 Código de recuperación enviado a ${user.email}`);
        res.json(createResponse('success', {
          method: 'email',
          email: user.email,
          token,
          codeLength: 6
        }));
      } catch (emailErr) {
        console.error('❌ Error enviando email:', emailErr.message);
        user.resetToken = null;
        user.resetCode = null;
        user.resetTokenExpires = null;
        await user.save();
        res.json(createResponse('success', { method: 'none' }, 'Si el email existe, recibirás instrucciones'));
      }
    } else {
      const groupsData = [];
      if (user.groups && user.groups.length > 0) {
        for (const groupName of user.groups) {
          const group = await Group.findOne({ name: groupName }).populate('admin', 'name email');
          if (group && group.admin) {
            groupsData.push({
              groupName: group.name,
              admin: { name: group.admin.name, email: group.admin.email }
            });
          }
        }
      }
      if (groupsData.length === 0) {
        return res.json(createResponse('success', { method: 'none' }, 'Si el email existe, recibirás instrucciones'));
      }
      res.json(createResponse('success', { method: 'admin', groups: groupsData }));
    }
  } catch (error) {
    console.error('❌ Error en POST /forgot-password:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, code, newPassword } = req.body;

    if (!token || !code || !newPassword) {
      return res.status(400).json(createResponse('error', null, 'Token, código y nueva contraseña son requeridos'));
    }
    if (newPassword.length < 8) {
      return res.status(400).json(createResponse('error', null, 'La contraseña debe tener al menos 8 caracteres'));
    }

    const user = await User.findOne({
      resetToken: token,
      resetCode: code,
      resetTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json(createResponse('error', null, 'Código inválido o expirado. Solicita uno nuevo.'));
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetCode = null;
    user.resetTokenExpires = null;
    await user.save();

    console.log(`🔐 Contraseña restablecida para ${user.name} (📧${user.email})`);
    res.json(createResponse('success', null, 'Contraseña restablecida correctamente'));
  } catch (error) {
    console.error('❌ Error en POST /reset-password:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

router.post('/admin/reset-member-password', async (req, res) => {
  try {
    const { adminUserId, groupName, memberEmail, newPassword } = req.body;

    if (!adminUserId || !groupName || !memberEmail) {
      return res.status(400).json(createResponse('error', null, 'Faltan campos obligatorios'));
    }

    const admin = await User.findById(adminUserId);
    if (!admin || !admin.isAdminOf || !admin.isAdminOf.includes(groupName)) {
      return res.status(403).json(createResponse('error', null, 'No eres administrador de este grupo'));
    }

    const member = await User.findOne({ email: memberEmail.toLowerCase().trim(), groups: groupName });
    if (!member) {
      return res.status(404).json(createResponse('error', null, 'Usuario no encontrado en este grupo'));
    }

    const tempPassword = newPassword || crypto.randomBytes(4).toString('hex');
    if (tempPassword.length < 8) {
      return res.status(400).json(createResponse('error', null, 'La contraseña debe tener al menos 8 caracteres'));
    }

    member.password = await bcrypt.hash(tempPassword, 10);
    member.mustChangePassword = true;
    await member.save();

    console.log(`🔧 Admin ${admin.name} reseteó contraseña de ${member.name} en ${groupName}`);
    res.json(createResponse('success', { newPassword: tempPassword }, 'Contraseña del miembro restablecida correctamente'));
  } catch (error) {
    console.error('❌ Error en POST /admin/reset-member-password:', error);
    res.status(500).json(createResponse('error', null, error.message));
  }
});

router.get('/profile', async (req, res) => {
    try {
        const { playerName, userId, email } = req.query;
        let query = {};
        if (userId && userId !== 'undefined') query = { _id: userId };
        else if (email) query = { email: email.toLowerCase().trim() };
        else if (playerName) query = { name: playerName };
        else return res.status(400).json(createResponse('error', null, 'Falta identificador (userId, email o playerName)'));

        const user = await User.findOne(query);
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

        res.json(createResponse('success', {
            name: user.name,
            email: user.email,
            likes: user.likes || [],
            dislikes: user.dislikes || [],
            humor_style: user.humor_style || 'Divertido y amigable',
            ai_personality: user.ai_personality || 'andres_montes',
            nickname: user.nickname || user.name,
            notificationPreference: user.notificationPreference || 'all',
            userId: user._id.toString()
        }));
    } catch (error) {
        console.error('❌ Error en GET /profile:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/profile', async (req, res) => {
    try {
        const { playerName, userId, email, groupName, profile } = req.body;
        if (!profile) throw new Error('El perfil es requerido');

        let query = {};
        if (userId && userId !== 'undefined') query = { _id: userId };
        else if (email) query = { email: email.toLowerCase().trim() };
        else if (playerName) query = { name: playerName };
        else throw new Error('Falta identificador para actualizar perfil');

        console.log(`👤 [Profile] Actualizando preferencias para ${userId || email || playerName}:`, profile.notificationPreference);
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
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));
        res.json(createResponse('success', { notificationPreference: user.notificationPreference }));
    } catch (error) {
        console.error('❌ Error en POST /profile:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.post('/profile/change-password', async (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json(createResponse('error', null, 'La nueva contraseña debe tener al menos 8 caracteres'));
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json(createResponse('error', null, 'La contraseña actual es incorrecta'));
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.mustChangePassword = false;
        await user.save();

        console.log(`🔐 Contraseña actualizada para ${user.name} (📧${user.email})`);
        res.json(createResponse('success'));
    } catch (error) {
        console.error('❌ Error en POST /profile/change-password:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

router.delete('/profile', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json(createResponse('error', null, 'Falta userId'));

        const user = await User.findById(userId);
        if (!user) return res.status(404).json(createResponse('error', null, 'Usuario no encontrado'));

        await Prediction.deleteMany({ user: user._id });
        await Message.deleteMany({ sender: user.name });
        await User.findByIdAndDelete(user._id);

        res.json(createResponse('success', null, 'Cuenta eliminada correctamente'));
    } catch (error) {
        console.error('❌ Error DELETE /profile:', error);
        res.status(500).json(createResponse('error', null, error.message));
    }
});

export default router;
