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
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}
