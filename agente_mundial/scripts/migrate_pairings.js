import 'dotenv/config';
import mongoose from 'mongoose';
import { Reality } from '../models/Reality.js';

const GROUPS = 'ABCDEFGHIJKL'.split('');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI no definida en el entorno.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Conectado a MongoDB');

  const realityDoc = await Reality.findOne({ tournament: 'worldcup2026' });
  if (!realityDoc) {
    console.log('No hay documento reality. Nada que migrar.');
    await mongoose.disconnect();
    return;
  }

  const r = realityDoc.results;
  let swaps = 0;

  for (const letter of GROUPS) {
    const m2h = r[`g${letter}_m2_h`];
    const m2a = r[`g${letter}_m2_a`];
    const m3h = r[`g${letter}_m3_h`];
    const m3a = r[`g${letter}_m3_a`];

    if (m2h === undefined && m2a === undefined && m3h === undefined && m3a === undefined) {
      continue;
    }

    console.log(`\nGrupo ${letter}:`);
    console.log(`  g${letter}_m2: ${m2h ?? '—'} - ${m2a ?? '—'}`);
    console.log(`  g${letter}_m3: ${m3h ?? '—'} - ${m3a ?? '—'}`);

    r[`g${letter}_m2_h`] = m3h;
    r[`g${letter}_m2_a`] = m3a;
    r[`g${letter}_m3_h`] = m2h;
    r[`g${letter}_m3_a`] = m2a;

    console.log(`  → swap done`);

    if (r.events) {
      const ev2 = r.events[`g${letter}_m2`];
      const ev3 = r.events[`g${letter}_m3`];
      if (ev2 || ev3) {
        r.events[`g${letter}_m2`] = ev3;
        r.events[`g${letter}_m3`] = ev2;
        console.log(`  → events swappped`);
      }
    }

    swaps++;
  }

  realityDoc.results = r;
  realityDoc.updatedAt = new Date();
  await realityDoc.save();

  console.log(`\nMigración completada. ${swaps} grupos con swaps realizados.`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Error en migración:', err);
  process.exit(1);
});
