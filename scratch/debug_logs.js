import mongoose from 'mongoose';
import { AILog } from './agente_mundial/models/AILog.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkLogs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/porra-mundial');
    console.log('Connected to MongoDB');
    
    const logs = await AILog.find().sort({ createdAt: -1 }).limit(5);
    
    logs.forEach(log => {
      console.log('-------------------');
      console.log('ID:', log._id);
      console.log('Player:', log.playerName);
      console.log('RAG Context Length:', log.ragContext?.length || 0);
      console.log('RAG Context Preview:', JSON.stringify(log.ragContext?.substring(0, 100)));
      console.log('RAG Result Count:', log.ragResultCount);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkLogs();
