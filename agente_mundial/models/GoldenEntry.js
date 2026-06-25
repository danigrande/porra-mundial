import mongoose from 'mongoose';

const goldenEntrySchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['promoted_from_hitl', 'correction', 'manual'],
    required: true
  },
  category: {
    type: String,
    enum: ['personality', 'intent'],
    default: 'personality'
  },
  query: String,
  personalityId: String,
  targetLanguage: String,
  mockContext: {
    leaderboard: Array,
    playerStats: mongoose.Schema.Types.Mixed,
  },
  expectations: {
    minLanguagePurity: Number,
    minQuality: Number,
    maxLength: Number,
    mustNotContain: [String],
  },
  goldenResponse: String,
  goldenJudgeScores: {
    language_purity: Number,
    quality: Number,
  },
  tags: [String],
  originalReviewId: { type: mongoose.Schema.Types.ObjectId },
  promotedAt: { type: Date, default: Date.now },
});

goldenEntrySchema.index({ category: 1, promotedAt: -1 });
goldenEntrySchema.index({ originalReviewId: 1 });

export const GoldenEntry = mongoose.models.GoldenEntry || mongoose.model('GoldenEntry', goldenEntrySchema);
