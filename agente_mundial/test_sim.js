import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './db.js';
import { triggerAutoSimulationIfNeeded } from './autoSimulator.js';
import { Reality } from './models/Reality.js';

async function run() {
  await connectDB();
  process.env.TEST_MODE = 'true';
  console.log("Corriendo triggerAutoSimulationIfNeeded...");
  await triggerAutoSimulationIfNeeded();
  const r = await Reality.findOne({ tournament: 'worldcup2026' });
  console.log("Resultado final en BD:", r ? r.autoPopulatedPhases : 'No hay documento');
  process.exit(0);
}

run();
