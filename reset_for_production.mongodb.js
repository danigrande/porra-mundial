// ============================================
// RESET PARA PRODUCCIÓN — Porra Mundial 2026
// ============================================
// Ejecutar contra la BD de producción en MongoDB Atlas
// Conectarse primero con: mongosh "mongodb+srv://..."
//
// Conserva: users, groups, pushtokens
// Borra: predictions, messages, reality, summaries, feedback, prds,
//        ailogs, reports, seenarticles, blockedusers
//
// USO:
//   mongosh "mongodb+srv://<user>:<pass>@cluster0.xxx.mongodb.net" reset_for_production.mongodb.js

const DB_NAME = 'porra_mundial'; // Ajustar si es otro nombre

print('========================================');
print('RESET PARA PRODUCCIÓN');
print('========================================');
print('');

const collectionsToDrop = [
  'predictions',
  'messages',
  'summaries',
  'feedback',
  'prds',
  'ailogs',
  'reports',
  'seenarticles',
];

print('Colecciones a BORRAR (conservando users, groups, pushtokens):');
collectionsToDrop.forEach(c => print(`  - ${c}`));

print('');
print('¿Continuar? (Ctrl+C para cancelar, Enter para continuar)');
// En mongosh script, espera 3 segundos y continúa

sleep(3000);

print('');
print('Borrando colecciones...');

collectionsToDrop.forEach(name => {
  const result = db.getCollection(name).deleteMany({});
  print(`  ✅ ${name}: ${result.deletedCount} documentos borrados`);
});

// Reality: documento único del torneo
const realityResult = db.getCollection('reality').deleteOne({ tournament: 'worldcup2026' });
print(`  ✅ reality: ${realityResult.deletedCount} documento(s) borrado(s)`);

// Resetear campos de notificación en grupos
const groupsResult = db.getCollection('groups').updateMany(
  {},
  { $set: { lastAnnouncedPhase: null, lastReminderPhase: null } }
);
print(`  ✅ groups: ${groupsResult.modifiedCount} grupo(s) reseteados (notificaciones)`);

print('');
print('========================================');
print('RESET COMPLETADO');
print('========================================');
print('Conservado: users, groups, pushtokens');
print('');
print('Recordatorio: Verificar que TEST_MODE=false y hacer deploy');
