import mongoose from 'mongoose';

const correctionSchema = new mongoose.Schema({
  originalResponse: { type: String, required: true },
  correctedText:    { type: String, required: true },
  userId:           { type: String, required: true },
  userName:         { type: String },
  groupName:        { type: String, required: true },
  personalityId:    { type: String },
  targetLanguage:   { type: String, default: 'es' },
  context:          { type: String },
  originalJudgeScores: {
    language_purity: Number,
    quality: Number
  },
  detectorConfidence: { type: Number, min: 0, max: 1 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'promoted'], default: 'pending' },
  promotedToGolden: { type: Boolean, default: false },
  reviewedBy: String,
  reviewedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

correctionSchema.index({ status: 1, createdAt: -1 });
correctionSchema.index({ personalityId: 1, status: 1 });
correctionSchema.index({ groupName: 1, createdAt: -1 });

export const Correction = mongoose.models.Correction || mongoose.model('Correction', correctionSchema);
