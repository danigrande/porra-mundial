import mongoose from 'mongoose';

const humanReviewSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['user_downvote', 'judge_disagree', 'force_approved', 'manual'],
    required: true
  },

  aiLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'AILog' },
  chatbotFeedbackId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatbotFeedback' },

  query: String,
  response: String,
  personalityId: String,
  targetLanguage: String,

  judgeScores: {
    language_purity: Number,
    quality: Number
  },
  judgePassed: Boolean,

  status: { type: String, enum: ['pending', 'reviewed', 'promoted'], default: 'pending' },
  humanPassed: Boolean,
  humanConfidence: { type: Number, min: 1, max: 5 },
  humanScores: {
    language_purity: Number,
    quality: Number
  },
  humanNotes: String,
  reviewedBy: String,
  reviewedAt: Date,

  promotedToGolden: Boolean,
  goldenDatasetCategory: String,

  createdAt: { type: Date, default: Date.now }
});

humanReviewSchema.index({ status: 1, createdAt: -1 });
humanReviewSchema.index({ source: 1, status: 1 });
humanReviewSchema.index({ aiLogId: 1 });

export const HumanReview = mongoose.models.HumanReview || mongoose.model('HumanReview', humanReviewSchema);
