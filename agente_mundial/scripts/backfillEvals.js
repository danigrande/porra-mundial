import mongoose from 'mongoose';
import { AILog } from '../models/AILog.js';
import { judgeResponse } from '../judgeService.js';
import { getAnchors } from '../anchors.js';
import config from '../config.js';

const BATCH_SIZE = 5;
const DELAY_MS = 1000;

async function backfill() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI required'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const total = await AILog.countDocuments({ evalPassed: { $exists: false } });
  console.log(`📊 Found ${total} AILogs without evalPassed`);

  let cursor = AILog.find({ evalPassed: { $exists: false } })
    .sort({ createdAt: -1 })
    .lean()
    .cursor();

  let batch = [];
  let processed = 0;
  let updated = 0;
  let failed = 0;

  for await (const log of cursor) {
    batch.push(log);
    processed++;

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      updated += batch.length;
      batch = [];
      console.log(`  Progress: ${processed}/${total}`);
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  if (batch.length > 0) {
    await processBatch(batch);
    updated += batch.length;
  }

  console.log(`\n✅ Done. Processed: ${processed}, Updated: ${updated}, Failed: ${failed}`);
  await mongoose.disconnect();
}

async function processBatch(logs) {
  const promises = logs.map(async (log) => {
    try {
      const personalityId = log.anchorsUsed || 'andres_montes';
      const anchors = getAnchors(personalityId);
      const targetLanguage = log.targetLanguage || 'es';
      const systemPrompt = log.systemPrompt || '';
      const response = log.groqResponse || '';

      if (!response) return;

      const judgment = await judgeResponse(
        response,
        systemPrompt,
        anchors,
        targetLanguage
      );

      await AILog.findByIdAndUpdate(log._id, {
        evalScores: judgment.scores,
        evalPassed: judgment.passed,
        evalFeedback: judgment.feedback || '',
        evalAttempts: log.evalAttempts || 1,
        anchorsUsed: personalityId,
        targetLanguage,
      });
    } catch (err) {
      console.error(`  Error on ${log._id}: ${err.message}`);
    }
  });

  await Promise.allSettled(promises);
}

backfill().catch(err => { console.error('Fatal:', err); process.exit(1); });
