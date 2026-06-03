import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { User } from './models/User.js';
import { Message } from './models/Message.js';
import { BlockedUser } from './models/BlockedUser.js';
import { Report } from './models/Report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const args = process.argv.slice(2);
  const mappingFile = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!mappingFile) {
    console.error('Usage: node migrateToEmail.js <mapping-file.json> [--dry-run]');
    process.exit(1);
  }

  // Load mapping
  const mappingPath = path.resolve(__dirname, mappingFile);
  if (!fs.existsSync(mappingPath)) {
    console.error(`Mapping file not found: ${mappingPath}`);
    process.exit(1);
  }
  const phoneToEmail = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

  // Connect to DB
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  const stats = { migrated: 0, skipped: 0, failed: 0, messages: 0, blocks: 0, reports: 0 };

  // 1. Migrate Users
  console.log('=== Migrating Users ===');
  for (const [phone, data] of Object.entries(phoneToEmail)) {
    const user = await User.findOne({ phone });
    if (!user) {
      console.log(`  ⏭️  User with phone ${phone} not found, skipping`);
      stats.skipped++;
      continue;
    }

    const hashedPassword = await bcrypt.hash(data.password || 'PrediccionMundial', 10);

    if (dryRun) {
      console.log(`  🔄 [DRY-RUN] Would migrate: ${user.name} (${phone}) → ${data.email}`);
      stats.migrated++;
      continue;
    }

    try {
      // Check for existing email
      const existingEmail = await User.findOne({ email: data.email.toLowerCase().trim() });
      if (existingEmail && existingEmail._id.toString() !== user._id.toString()) {
        console.log(`  ⚠️  Email ${data.email} already taken by another user, merging groups`);
        // Merge groups and delete this user
        for (const g of user.groups || []) {
          if (!existingEmail.groups.includes(g)) {
            existingEmail.groups.push(g);
          }
        }
        await existingEmail.save();
        // Reassign messages, predictions etc. to existingEmail
        await Message.updateMany({ senderId: phone }, { senderId: existingEmail._id.toString() });
        await BlockedUser.updateMany({ $or: [{ blockerPhone: phone }, { blockedPhone: phone }] }, { $set: { blockerId: existingEmail._id.toString(), blockedId: existingEmail._id.toString() } });
        await Report.updateMany({ reporterPhone: phone }, { reporterId: existingEmail._id.toString() });
        // Delete old user
        await User.findByIdAndDelete(user._id);
        console.log(`  🔀 Merged ${user.name} into existing account ${data.email}`);
        stats.migrated++;
        continue;
      }

      // Update user fields
      user.email = data.email.toLowerCase().trim();
      user.password = hashedPassword;
      // Remove old fields if they exist
      if (user.phone !== undefined) {
        user.phone = undefined;
      }
      if (user.pin !== undefined) {
        user.pin = undefined;
      }
      await user.save();
      console.log(`  ✅ Migrated: ${user.name} (${phone}) → ${data.email}`);
      stats.migrated++;
    } catch (err) {
      console.error(`  ❌ Failed to migrate ${phone}: ${err.message}`);
      stats.failed++;
    }
  }

  // 2. Migrate Message senderId (phone → userId)
  console.log('\n=== Migrating Messages ===');
  for (const [phone] of Object.entries(phoneToEmail)) {
    const user = await User.findOne({ email: phoneToEmail[phone].email.toLowerCase().trim() });
    if (!user) continue;

    if (dryRun) {
      const count = await Message.countDocuments({ senderId: phone });
      if (count > 0) console.log(`  🔄 [DRY-RUN] Would update ${count} messages from ${phone} to ${user._id}`);
      stats.messages += count;
      continue;
    }

    const result = await Message.updateMany(
      { senderId: phone },
      { $set: { senderId: user._id.toString() } }
    );
    if (result.modifiedCount > 0) {
      console.log(`  ✅ Updated ${result.modifiedCount} messages from ${phone} to ${user._id}`);
      stats.messages += result.modifiedCount;
    }
  }

  // 3. Migrate BlockedUser
  console.log('\n=== Migrating BlockedUsers ===');
  // First, add new fields to existing documents
  const blocksToMigrate = await BlockedUser.find({ $or: [{ blockerPhone: { $exists: true } }, { blockedPhone: { $exists: true } }] });
  for (const block of blocksToMigrate) {
    if (dryRun) {
      console.log(`  🔄 [DRY-RUN] Would migrate block: ${block.blockerPhone || '?'} → ${block.blockedPhone || '?'}`);
      stats.blocks++;
      continue;
    }

    try {
      const blockerPhone = block.blockerPhone;
      const blockedPhone = block.blockedPhone;
      const blockerMapping = phoneToEmail[blockerPhone];
      const blockedMapping = phoneToEmail[blockedPhone];
      
      let blockerId = block.blockerId;
      let blockedId = block.blockedId;

      if (blockerMapping) {
        const blocker = await User.findOne({ email: blockerMapping.email.toLowerCase().trim() });
        if (blocker) blockerId = blocker._id.toString();
      }
      if (blockedMapping) {
        const blocked = await User.findOne({ email: blockedMapping.email.toLowerCase().trim() });
        if (blocked) blockedId = blocked._id.toString();
      }

      block.blockerId = blockerId;
      block.blockedId = blockedId;
      block.blockerPhone = undefined;
      block.blockedPhone = undefined;
      await block.save();
      console.log(`  ✅ Migrated block: ${blockerPhone || '?'} → ${blockedPhone || '?'}`);
      stats.blocks++;
    } catch (err) {
      console.error(`  ❌ Failed to migrate block: ${err.message}`);
    }
  }

  // 4. Migrate Report
  console.log('\n=== Migrating Reports ===');
  const reportsToMigrate = await Report.find({ reporterPhone: { $exists: true } });
  for (const report of reportsToMigrate) {
    if (dryRun) {
      console.log(`  🔄 [DRY-RUN] Would migrate report from phone: ${report.reporterPhone}`);
      stats.reports++;
      continue;
    }

    try {
      const mapping = phoneToEmail[report.reporterPhone];
      if (mapping) {
        const user = await User.findOne({ email: mapping.email.toLowerCase().trim() });
        if (user) {
          report.reporterId = user._id.toString();
          report.reporterPhone = undefined;
          await report.save();
          console.log(`  ✅ Migrated report from ${report.reporterPhone} to ${user._id}`);
          stats.reports++;
        }
      }
    } catch (err) {
      console.error(`  ❌ Failed to migrate report: ${err.message}`);
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===');
  console.log(`  Users migrated:     ${stats.migrated}`);
  console.log(`  Users skipped:      ${stats.skipped}`);
  console.log(`  Users failed:       ${stats.failed}`);
  console.log(`  Messages updated:   ${stats.messages}`);
  console.log(`  Blocks migrated:    ${stats.blocks}`);
  console.log(`  Reports migrated:   ${stats.reports}`);
  if (dryRun) console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.');

  await mongoose.disconnect();
  console.log('\nMigration complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
