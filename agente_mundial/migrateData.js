import mongoose from 'mongoose';
import { connectDB } from './db.js';
import * as dataFetcher from './dataFetcher.js';
import { User } from './models/User.js';
import { Group } from './models/Group.js';
import { Prediction } from './models/Prediction.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  console.log('🔄 Iniciando migración de Google Sheets a MongoDB...');
  await connectDB();

  try {
    // 1. Limpiar la base de datos (opcional, para evitar duplicados en pruebas)
    await User.deleteMany({});
    await Group.deleteMany({});
    await Prediction.deleteMany({});
    console.log('🗑️ Base de datos MongoDB limpiada.');

    // 2. Obtener lista de grupos desde Google Sheets
    const responseGroups = await dataFetcher.apiCall({ action: 'listGroups' });
    if (responseGroups.status !== 'success') throw new Error('Error al listar grupos: ' + responseGroups.message);
    
    const groups = responseGroups.data;
    console.log(`📋 Encontrados ${groups.length} grupos:`, groups);

    for (const groupName of groups) {
      console.log(`\n⚙️ Procesando grupo: ${groupName}`);

      // Obtener reglas del grupo
      const responseRules = await dataFetcher.apiCall({ action: 'getRules', groupName });
      const rules = responseRules.status === 'success' ? responseRules.data : {};

      // Obtener jugadores del grupo
      const responsePlayers = await dataFetcher.apiCall({ action: 'getPlayers', groupName });
      const playerNames = responsePlayers.status === 'success' ? responsePlayers.data : [];

      // Obtener perfiles (info extra)
      const responseProfiles = await dataFetcher.apiCall({ action: 'getAllInfo', groupName });
      const profiles = responseProfiles.status === 'success' ? responseProfiles.data : {};

      // Crear el documento del Grupo (usaremos al primer jugador como admin temporal si no hay otro)
      let groupDoc = await Group.create({
        name: groupName,
        admin: new mongoose.Types.ObjectId(), // Placeholder, lo actualizaremos después
        rules: rules
      });

      const memberIds = [];
      let adminId = null;

      // Obtener mapeo de teléfonos
      const responsePhones = await dataFetcher.apiCall({ action: 'getPhoneMapping', groupName });
      const phoneMapping = responsePhones.status === 'success' ? responsePhones.data : {};

      // Procesar cada jugador
      for (const playerName of playerNames) {
        let userDoc = await User.findOne({ name: playerName });
        
        if (!userDoc) {
          const fakePhone = '000000000' + Math.floor(Math.random() * 1000000);
          userDoc = await User.create({
            name: playerName,
            pin: '1234', 
            phone: phoneMapping[playerName] || fakePhone,
            groups: [groupName]
          });
        } else {
          if (!userDoc.groups.includes(groupName)) {
            userDoc.groups.push(groupName);
            await userDoc.save();
          }
        }
        memberIds.push(userDoc._id);

        // Si el jugador se llama Dani o es el primero, lo hacemos admin por ahora
        if (!adminId || playerName.toLowerCase().includes('dani')) {
            adminId = userDoc._id;
        }

        // Migrar predicciones
        const responsePreds = await dataFetcher.apiCall({ action: 'getPredictions', groupName });
        const allPredictions = responsePreds.status === 'success' ? responsePreds.data : {};
        
        if (allPredictions[playerName]) {
            await Prediction.create({
                user: userDoc._id,
                group: groupDoc._id,
                predictions: allPredictions[playerName].predictions || {},
                updatedAt: allPredictions[playerName].timestamp || new Date()
            });
            console.log(`  ✅ Predicciones migradas para: ${playerName}`);
        } else {
            console.log(`  ℹ️ Sin predicciones para: ${playerName}`);
        }
      }

      // Actualizar el grupo con sus miembros y admin real
      groupDoc.members = memberIds;
      if (adminId) {
          groupDoc.admin = adminId;
          const adminUser = await User.findById(adminId);
          if (adminUser && !adminUser.isAdminOf.includes(groupName)) {
              adminUser.isAdminOf.push(groupName);
              await adminUser.save();
          }
      }
      await groupDoc.save();
      console.log(`✅ Grupo '${groupName}' migrado con ${memberIds.length} miembros.`);
    }

    console.log('\n🎉 ¡Migración completada con éxito!');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    mongoose.connection.close();
  }
}

migrate();
