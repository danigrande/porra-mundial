// ============================================
// SEED DEMO — Crea un grupo de demo con jugadores ficticios,
// predicciones (a partir de la realidad real) e historial de chat.
// Repetible: borra y recrea el grupo "La Peña" en cada ejecución.
// Uso:  node scripts/seed_demo.mjs   (desde agente_mundial/)
// ============================================

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Prediction } from '../models/Prediction.js';
import { Reality } from '../models/Reality.js';
import { Message } from '../models/Message.js';

const GROUP_NAME = 'La Peña';
const ADMIN_EMAIL = 'danigrande@live.com'; // usuario "Arafat" (login real)

// Jugadores ficticios (nombre, nickname, likes, dislikes, humor, skill 0..1)
const PLAYERS = [
  { name: 'Emma',   nickname: 'The Captain',  likes: ['Winning', 'Spain', 'Nailing the scores'], dislikes: ['Goal-less draws', 'VAR'], humor_style: 'Competitive and witty', skill: 0.72 },
  { name: 'Liam',   nickname: 'The Stat Nerd', likes: ['Stats', 'Argentina', 'Calling the exact score'], dislikes: ['Losing by one goal'], humor_style: 'Analytical and dry', skill: 0.60 },
  { name: 'Chloe',  nickname: 'Lucky Chloe',  likes: ['Upsets', 'Brazil', 'Penalty shootouts'], dislikes: ['Favorites'], humor_style: 'Sunny and chaotic', skill: 0.55 },
  { name: 'Max',    nickname: 'Maxi',         likes: ['Mexico', 'Tacos and football'], dislikes: ['Finishing last'], humor_style: 'Life of the party', skill: 0.50 },
  { name: 'Olivia', nickname: 'Liv',          likes: ['France', 'Mbappé', 'Overhead kicks'], dislikes: ['Offside'], humor_style: 'Lively and competitive', skill: 0.42 },
  { name: 'Noah',   nickname: 'The Tactician', likes: ['England', 'Bellingham', 'Tactical football'], dislikes: ['Draws'], humor_style: 'Serious and precise', skill: 0.35 },
  { name: 'Mia',    nickname: 'Mia',          likes: ['Runs in behind', 'Portugal', 'Ronaldo'], dislikes: ['Losing'], humor_style: 'Cheerful', skill: 0.28 },
  { name: 'Leo',    nickname: 'Leo the Loyal', likes: ['Backing the draw', 'The drama'], dislikes: ['Getting it right'], humor_style: 'Pessimistic and funny', skill: 0.18 },
];

const ADMIN_SKILL = 0.55;

const RULES = {
  pts_group_sign: 10, pts_group_diff: 10, pts_group_exact: 10, pts_group_pos: 5, pts_group_qualify: 5,
  pts_ko_sign: 10, pts_ko_diff: 10, pts_ko_exact: 10, pts_ko_qualify: 10,
  pts_honor_champ: 50, pts_honor_runner: 30, pts_honor_third: 20,
  pts_award_gold: 25, pts_award_silver: 15, pts_award_bronze: 10,
  opt_diff_adjust: false,
};

const NAME_POOL = [
  'Kylian Mbappé', 'Lionel Messi', 'Jude Bellingham', 'Rodri',
  'Erling Haaland', 'Vinícius Júnior', 'Lamine Yamal', 'Harry Kane',
  'Cristiano Ronaldo', 'Neymar',
];

const sign = (h, a) => (h > a ? 1 : h < a ? 2 : 0);

function predictMatch(rH, rA, skill) {
  const roll = Math.random();
  if (roll < skill * 0.5) return [rH, rA];
  const rs = sign(rH, rA);
  if (roll < skill * 0.8) {
    for (let t = 0; t < 25; t++) {
      const h = Math.floor(Math.random() * 5);
      const a = Math.floor(Math.random() * 5);
      if (sign(h, a) === rs && (h !== rH || a !== rA)) return [h, a];
    }
    return [rH, rA];
  }
  return [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)];
}

function randomName(exclude) {
  let n;
  do { n = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]; } while (n === exclude);
  return n;
}

function buildPredictions(reality, skill) {
  const pred = {};
  for (const k of Object.keys(reality)) {
    if (!k.endsWith('_h')) continue;
    if (k.startsWith('pen_') || k.startsWith('et_')) continue;
    const prefix = k.slice(0, -2);
    const rH = parseInt(reality[`${prefix}_h`], 10);
    const rA = parseInt(reality[`${prefix}_a`], 10);
    if (Number.isNaN(rH) || Number.isNaN(rA)) continue;
    const [pH, pA] = predictMatch(rH, rA, skill);
    pred[`${prefix}_h`] = String(pH);
    pred[`${prefix}_a`] = String(pA);
  }
  for (const k of ['boot_gold', 'boot_silver', 'boot_bronze', 'ball_gold', 'ball_silver', 'ball_bronze']) {
    const real = reality[k];
    if (typeof real === 'string' && real) {
      pred[k] = Math.random() < skill ? real : randomName(real);
    }
  }
  return pred;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('No MONGODB_URI'); process.exit(1); }
  await mongoose.connect(uri);

  const admin = await User.findOne({ email: ADMIN_EMAIL });
  if (!admin) { console.error(`Admin ${ADMIN_EMAIL} no encontrado`); process.exit(1); }
  const oldAdminName = admin.name;
  if (admin.name !== 'Dani') {
    admin.name = 'Dani';
    await admin.save();
    console.log(`Admin renombrado: "${oldAdminName}" -> "Dani"`);
  }
  console.log(`Admin: ${admin.name} <${admin.email}>`);

  const reality = await Reality.findOne({ tournament: 'worldcup2026' });
  if (!reality || !reality.results) { console.error('No hay realidad'); process.exit(1); }
  console.log(`Realidad: ${Object.keys(reality.results).length} claves`);

  // --- Reset del grupo demo anterior ---
  const oldGroup = await Group.findOne({ name: GROUP_NAME });
  if (oldGroup) {
    await Prediction.deleteMany({ group: oldGroup._id });
    await Message.deleteMany({ chatId: GROUP_NAME });
    await User.updateMany({ groups: GROUP_NAME }, { $pull: { groups: GROUP_NAME }, $pull: { isAdminOf: GROUP_NAME } });
    const oldMembers = oldGroup.members || [];
    await Group.deleteOne({ _id: oldGroup._id });
    // Borrar usuarios ficticios del seed
    for (const p of PLAYERS) {
      await User.deleteMany({ email: `${p.name.toLowerCase().replace(/[^a-z]/g, '')}@demo.porra` });
    }
    console.log(`Reset: grupo "${GROUP_NAME}" anterior borrado (${oldMembers.length} miembros)`);
  }

  // --- Crear usuarios ficticios ---
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const members = [];
  for (const p of PLAYERS) {
    const email = `${p.name.toLowerCase().replace(/[^a-z]/g, '')}@demo.porra`;
    const u = await User.create({
      name: p.name,
      email,
      password: passwordHash,
      nickname: p.nickname,
      likes: p.likes,
      dislikes: p.dislikes,
      humor_style: p.humor_style,
      ai_personality: 'andres_montes',
      groups: [GROUP_NAME],
    });
    members.push({ u, skill: p.skill });
    console.log(`  + jugador ${p.name} (${email})`);
  }

  // --- Crear grupo ---
  const group = await Group.create({
    name: GROUP_NAME,
    admin: admin._id,
    rules: RULES,
    predictionMode: 'A',
    members: [admin._id, ...members.map(m => m.u._id)],
  });
  console.log(`Grupo "${GROUP_NAME}" creado (admin=${admin.name})`);

  // --- Añadir el grupo al admin ---
  await User.findByIdAndUpdate(admin._id, { $addToSet: { groups: GROUP_NAME, isAdminOf: GROUP_NAME } });

  // --- Predicciones (admin + ficticios) ---
  const adminPred = buildPredictions(reality.results, ADMIN_SKILL);
  await Prediction.create({ user: admin._id, group: group._id, predictions: adminPred });
  console.log(`  predicción admin (${admin.name}): ${Object.keys(adminPred).length} claves`);

  for (const { u, skill } of members) {
    const pred = buildPredictions(reality.results, skill);
    await Prediction.create({ user: u._id, group: group._id, predictions: pred });
  }

  // --- Historial de chat ---
  const now = Date.now();
  const bot = (text, minsAgo) => ({
    chatId: GROUP_NAME, senderId: 'agente-mundial', senderName: 'Agente Mundial 🏆',
    text, isBot: true, timestamp: new Date(now - minsAgo * 60000),
  });
  const userMsg = (name, id, text, minsAgo) => ({
    chatId: GROUP_NAME, senderId: id, senderName: name,
    text, isBot: false, timestamp: new Date(now - minsAgo * 60000),
  });
  const mia = members.find(m => m.u.name === 'Mia').u;
  const max = members.find(m => m.u.name === 'Max').u;
  const leo = members.find(m => m.u.name === 'Leo').u;

  const chat = [
    userMsg('Mia', mia._id.toString(), "Hey! Who's winning the pool?", 40),
    bot('The Captain is on top… but Mia is closing in fast. 🎯', 39),
    userMsg('Leo', leo._id.toString(), "I'm probably last again, as usual 😅", 30),
    bot('Faroliyo alert… but don\'t worry Leo, even the underdogs have their night. ⚽', 29),
    userMsg('Max', max._id.toString(), 'I bet I win the next round, haha', 20),
    bot('With that confidence, Maxi — you\'re a guaranteed starter. 😎', 19),
  ];
  await Message.insertMany(chat);
  console.log(`  ${chat.length} mensajes de chat sembrados`);

  await mongoose.disconnect();
  console.log('\nSeed completado.');
}

main().catch(e => { console.error(e); process.exit(1); });
