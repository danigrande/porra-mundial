import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('⚠️ MONGODB_URI no definida en .env. Saltando conexión a la base de datos.');
      return;
    }
    
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB Exitosamente!');
    
    // Intentar eliminar el índice único de teléfono si existe
    try {
      const User = mongoose.model('User');
      await User.collection.dropIndex('phone_1');
      console.log('🗑️ Índice único "phone_1" eliminado correctamente');
    } catch (e) {
      // Si el índice no existe, lo ignoramos
      console.log('ℹ️ El índice "phone_1" no existe o ya fue eliminado');
    }
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}
