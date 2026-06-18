import 'dotenv/config';
import mongoose from 'mongoose';
import { Reality } from '../models/Reality.js';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.resolve(import.meta.dirname, '../../backup');

async function backup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI no definida en el entorno.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Conectado a MongoDB');

  const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
  if (!realityDoc) {
    console.log('No hay documento reality para backup.');
    await mongoose.disconnect();
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `reality_${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(realityDoc.toObject(), null, 2));
  console.log(`Backup guardado en: ${filePath}`);

  await mongoose.disconnect();
  console.log('Backup completado.');
}

backup().catch(err => {
  console.error('Error en backup:', err);
  process.exit(1);
});
