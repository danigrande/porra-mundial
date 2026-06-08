import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI no definida en el entorno.');
    console.warn('Las variables de entorno disponibles son:', Object.keys(process.env));
    return;
  }

  const maskedUri = uri.replace(/:([^:@]+)@/, ':******@');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔌 Intento ${attempt}/${MAX_RETRIES} — Conectando a MongoDB: ${maskedUri}`);
      await mongoose.connect(uri);
      console.log('✅ Conectado a MongoDB Exitosamente!');
      return;
    } catch (error) {
      console.error(`❌ Error conectando a MongoDB (intento ${attempt}/${MAX_RETRIES}):`, error.message);
      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Reintentando en ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.error('🛑 No se pudo conectar a MongoDB tras múltiples intentos. Abortando.');
        process.exit(1);
      }
    }
  }
}
