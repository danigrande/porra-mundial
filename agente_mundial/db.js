import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('⚠️ MONGODB_URI no definida en el entorno.');
      console.warn('Las variables de entorno disponibles son:', Object.keys(process.env));
      return;
    }
    
    // Mask password in URI for logging
    const maskedUri = uri.replace(/:([^:@]+)@/, ':******@');
    console.log(`🔌 Intentando conectar a MongoDB con: ${maskedUri}`);
    
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB Exitosamente!');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}
