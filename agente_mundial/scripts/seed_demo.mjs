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
import { Feedback } from '../models/Feedback.js';
import { PRD } from '../models/PRD.js';
import { AILog } from '../models/AILog.js';

const GROUP_NAME = 'Demo group';
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

  // --- Reset del grupo demo anterior (incluye nombres legacy) ---
  const LEGACY_GROUPS = [GROUP_NAME, 'La Peña'];
  for (const gname of LEGACY_GROUPS) {
    const g = await Group.findOne({ name: gname });
    if (g) {
      await Prediction.deleteMany({ group: g._id });
      await Group.deleteOne({ _id: g._id });
      console.log(`Reset: grupo "${gname}" borrado`);
    }
    await Message.deleteMany({ chatId: gname });
    await User.updateMany({}, { $pull: { groups: gname, isAdminOf: gname } });
  }
  const demoEmails = PLAYERS.map(p => `${p.name.toLowerCase().replace(/[^a-z]/g, '')}@demo.porra`);
  const demoUsers = await User.find({ email: { $in: demoEmails } });
  if (demoUsers.length) {
    const demoIds = demoUsers.map(u => u._id);
    await Prediction.deleteMany({ user: { $in: demoIds } });
    await User.deleteMany({ _id: { $in: demoIds } });
    console.log(`Reset: ${demoIds.length} jugadores demo anteriores borrados`);
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

  // --- Feedback (English, mostly pre-analysed) ---
  await Feedback.deleteMany({});
  await PRD.deleteMany({});
  const FB = [
    { type: 'bug', user: 'Liam', priority: 'P0', prd: true,
      subject: 'Scores are wrong after the last match',
      detail: 'After the last match my total does not add up: I got the result and the goal difference right but the points are too low. Looks like the difference is miscounted in the knockout rounds.',
      reason: 'Scoring is the core promise of the product; wrong points break trust.',
      analysis: 'User reports incorrect point totals after a knockout match, pointing at the goal-difference calculation.' },
    { type: 'bug', user: 'Noah', priority: 'P0', prd: false,
      subject: 'App crashes when opening the leaderboard on mobile',
      detail: 'Since the last update, opening the standings tab on my phone closes the app. It happens every time, so I cannot see the table at all.',
      reason: 'A crash on a primary screen blocks core usage on mobile.',
      analysis: 'Reproducible mobile crash when opening the leaderboard tab.' },
    { type: 'feature', user: 'Chloe', priority: 'P1', prd: true,
      subject: 'Invite friends with a link',
      detail: 'It would be great to invite my friends to the group with a direct link instead of adding them one by one. We could set up the pool in seconds.',
      reason: 'Directly drives user and group growth (strategy #2).',
      analysis: 'Request for a shareable invite link to add friends to a group.' },
    { type: 'bug', user: 'Max', priority: 'P1', prd: false,
      subject: 'Cannot edit my prediction in the knockout rounds',
      detail: 'When I try to edit a round-of-16 result it says it is already closed, but the match has not started yet. The editing window seems to close too early.',
      reason: 'Blocks a core action (editing predictions) for active users.',
      analysis: 'Editing window for knockout predictions appears to close before kick-off.' },
    { type: 'feature', user: 'Olivia', priority: 'P2', prd: true,
      subject: 'Notify me when a friend overtakes me',
      detail: 'I would like a heads-up when a friend passes me in the standings. It would make the pool feel alive and bring me back more often.',
      reason: 'Improves engagement and retention of existing users.',
      analysis: 'Request for a notification when a friend overtakes the user in the ranking.' },
    { type: 'feature', user: 'Emma', priority: 'P2', prd: false,
      subject: 'See how my position changed each matchday',
      detail: 'A small chart showing how my ranking moved matchday by matchday would be nice, so I can see if I am climbing or sliding.',
      reason: 'Nice UX improvement to an existing feature.',
      analysis: 'Request for a position-over-time chart on the leaderboard.' },
    { type: 'feature', user: 'Mia', priority: 'P2', prd: false,
      subject: 'Daily summary is too long',
      detail: 'The bot daily summary is very long. I would prefer something shorter and funnier, like three lines with the highlights of the day.',
      reason: 'Improves the chat experience (strategy #3).',
      analysis: 'Request for a shorter, funnier daily summary.' },
  ];
  const feedbackDocs = [];
  for (let i = 0; i < FB.length; i += 1) {
    const f = FB[i];
    const doc = await Feedback.create({
      userId: `demo-${f.user.toLowerCase()}`,
      userName: f.user,
      type: f.type,
      subject: f.subject,
      detail: f.detail,
      votes: f.user === 'Chloe' ? ['demo-emma', 'demo-liam'] : [],
      voteCount: f.user === 'Chloe' ? 2 : 0,
      priority: f.priority,
      priorityReason: f.reason,
      analysis: f.analysis,
      analyzedAt: new Date(now - (i + 1) * 3600000),
      langflowRunId: 'native',
    });
    feedbackDocs.push({ doc, prd: f.prd });
  }
  console.log(`  ${feedbackDocs.length} feedback (English) sembrados`);

  // --- PRDs (English, approved) ---
  let prdCount = 0;
  for (const { doc, prd } of feedbackDocs) {
    if (!prd) continue;
    await PRD.create({
      feedbackId: doc._id,
      title: doc.subject,
      status: 'approved',
      priority: doc.priority,
      problemStatement: doc.detail,
      proposedSolution: `Ship "${doc.subject}" following the flow the user described, reusing the existing screens where possible.`,
      userImpact: 'Improves the experience for active players and keeps them coming back.',
      technicalNotes: 'Frontend and API change; covered by automated tests.',
      acceptanceCriteria: ['The feature works end to end', 'Edge cases are handled', 'A test covers the new behaviour'],
      suggestedFiles: [],
      rawAnalysis: '',
      langflowRunId: 'native',
    });
    prdCount += 1;
  }
  console.log(`  ${prdCount} PRDs (English) sembrados`);

  // --- AILogs (English) so the AI Logs / Evals panels read in English ---
  await AILog.deleteMany({ groupName: GROUP_NAME });
  const PERSONAS = [
    { id: 'andres_montes', sys: 'You are "Agente Mundial", a football commentator with Andrés Montes\' streetwise, high-energy style.' },
    { id: 'trump', sys: 'You are "Agente Mundial", in a bombastic, self-congratulatory Donald Trump parody voice.' },
    { id: 'darth_vader', sys: 'You are "Agente Mundial", speaking with Darth Vader\'s solemn, menacing tone.' },
    { id: 'pedrerol', sys: 'You are "Agente Mundial", hosting like a dramatic late-night football TV show.' },
  ];
  const PROMPTS = [
    "Who's winning the pool right now?",
    'Did I move up after yesterday?',
    'Give me a quick summary of the group.',
    'Who is last this week?',
  ];
  const RESPONSES = [
    'The Captain is still on top, but Mia is closing in fast. 🎯',
    'You climbed one spot — the race is wide open. 🔥',
    'Three players separated by a single point. Nail-biting stuff. ⚽',
    'Faroliyo alert: Leo is holding the wooden spoon this week. 😅',
  ];
  const TYPES = ['response', 'response', 'judge', 'summary', 'transcreation'];
  const aiLogs = [];
  for (let i = 0; i < 30; i += 1) {
    const persona = PERSONAS[i % PERSONAS.length];
    const type = TYPES[i % TYPES.length];
    const purity = 8 + (i % 3);
    const quality = 6 + (i % 4);
    aiLogs.push({
      type,
      playerName: PLAYERS[i % PLAYERS.length].name,
      groupName: GROUP_NAME,
      systemPrompt: persona.sys,
      userPrompt: PROMPTS[i % PROMPTS.length],
      groqResponse: RESPONSES[i % RESPONSES.length],
      model: 'qwen/qwen3.8-27b',
      temperature: 0.85,
      maxTokens: 500,
      tokensUsed: 380 + i * 7,
      promptTokens: 300 + i * 5,
      completionTokens: 80 + i * 2,
      latencyMs: 700 + (i % 6) * 120,
      source: 'chat',
      callSource: type === 'judge' ? 'generateWithQualityGate' : 'generateResponse',
      success: true,
      evalScores: { language_purity: purity, quality },
      evalFeedback: quality >= 7 ? 'Good personality and language.' : 'Slightly generic — could be funnier.',
      evalMainIssue: quality >= 7 ? 'none' : 'humor',
      evalPassed: purity >= 8 && quality >= 6,
      evalAttempts: 1,
      anchorsUsed: persona.id,
      targetLanguage: persona.id === 'trump' || persona.id === 'darth_vader' ? 'en' : 'es',
      createdAt: new Date(now - i * 90000),
    });
  }
  await AILog.insertMany(aiLogs);
  console.log(`  ${aiLogs.length} AILogs (English) sembrados`);

  await mongoose.disconnect();
  console.log('\nSeed completado.');
}

main().catch(e => { console.error(e); process.exit(1); });
