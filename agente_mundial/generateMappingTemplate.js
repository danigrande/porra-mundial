import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { User } from './models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateTemplate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  // Find users that still have the old `phone` field (not yet migrated)
  const users = await User.find({ phone: { $exists: true } }).lean();

  if (users.length === 0) {
    // Try to find users by name as fallback (some might already be partially migrated)
    const allUsers = await User.find({}).select('name email phone pin').lean();
    if (allUsers.length === 0) {
      console.log('No users found in the database.');
      await mongoose.disconnect();
      return;
    }
    console.log(`Found ${allUsers.length} users (may already be migrated).`);
    console.log('\nUsers in DB (for reference):');
    allUsers.forEach(u => {
      console.log(`  ${u.name} | email: ${u.email || '(none)'} | phone: ${u.phone || '(none)'}`);
    });

    const outputPath = path.join(__dirname, 'phone-to-email.template.json');
    const template = {};
    allUsers.forEach(u => {
      const phone = u.phone || `${u.name.replace(/\s+/g, '').toLowerCase()}_legacy`;
      template[phone] = {
        email: `${u.name.replace(/\s+/g, '').toLowerCase()}@example.com`,
        password: 'PrediccionMundial'
      };
    });
    fs.writeFileSync(outputPath, JSON.stringify(template, null, 2));
    console.log(`\nTemplate written to: ${outputPath}`);
    console.log('Edit this file with the real email addresses before running migrateToEmail.js');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${users.length} users with old phone field.\n`);

  const template = {};
  users.forEach(u => {
    const phone = u.phone || 'unknown';
    const suggestedEmail = `${u.name.replace(/\s+/g, '').toLowerCase()}@example.com`;
    template[phone] = {
      email: suggestedEmail,
      password: 'PrediccionMundial'
    };
    console.log(`  ${u.name}: phone=${phone} → suggested: ${suggestedEmail}`);
  });

  const outputPath = path.join(__dirname, 'phone-to-email.template.json');
  fs.writeFileSync(outputPath, JSON.stringify(template, null, 2));
  console.log(`\n✅ Template written to: ${outputPath}`);
  console.log('📝 Edit the email addresses in that file, then run:');
  console.log('   node migrateToEmail.js phone-to-email.template.json');
  
  await mongoose.disconnect();
}

generateTemplate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
