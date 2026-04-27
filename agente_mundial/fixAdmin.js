import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';
import { Group } from './models/Group.js';

dotenv.config();

async function fixAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const user = await User.findOne({ name: 'Dani' });
    const group = await Group.findOne({ name: 'Los amigos de Dani' });

    if (!user || !group) {
      console.error('❌ No se encontró al usuario Dani o al grupo.');
      process.exit(1);
    }

    group.admin = user._id;
    // Asegurarnos de que el usuario está en el grupo
    if (!user.groups.includes(group.name)) {
        user.groups.push(group.name);
        await user.save();
    }
    
    await group.save();

    console.log(`⭐ ¡Éxito! Ahora Dani (${user._id}) es el admin de "${group.name}"`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAdmin();
