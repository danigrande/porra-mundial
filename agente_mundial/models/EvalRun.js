import mongoose from 'mongoose';

const evalRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  completedAt: { type: Date },
  durationMs: { type: Number },
  error: { type: String },

  model: { type: String, required: true },
  judgeModel: { type: String, required: true },
  temperature: { type: Number, default: 0 },
  datasets: [String],

  totalTests: { type: Number, default: 0 },
  passed: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  passRate: { type: Number },

  perDataset: {
    type: Map,
    of: {
      totalTests: Number,
      passed: Number,
      passRate: Number,
      avgLanguagePurity: Number,
      avgQuality: Number,
      avgAttempts: Number,
      avgLatencyMs: Number
    },
    default: {}
  },

  judgeCalibration: {
    falsePositiveRate: Number,
    falseNegativeRate: Number,
    fastPathAccuracy: Number,
    totalContaminationTests: Number
  },

  comparisonWithPrevious: {
    previousRunId: String,
    passRateDelta: Number,
    qualityDelta: Number,
    languageDelta: Number,
    regressions: [String],
    improvements: [String],
    temperatureMismatch: Boolean
  },

  results: [{
    testId: String,
    dataset: String,
    passed: Boolean,
    scores: {
      language_purity: Number,
      quality: Number
    },
    expectedScores: {
      language_purity: Number,
      quality: Number
    },
    response: String,
    goldenResponse: String,
    feedback: String,
    input: String,
    description: String,
    latencyMs: Number,
    attempts: Number,
    forceApproved: Boolean
  }]
}, { timestamps: true });

evalRunSchema.index({ timestamp: -1 });
evalRunSchema.index({ model: 1, timestamp: -1 });
evalRunSchema.index({ 'comparisonWithPrevious.regressions': 1 });

export const EvalRun = mongoose.models.EvalRun || mongoose.model('EvalRun', evalRunSchema);
