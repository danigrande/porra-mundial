import mongoose from 'mongoose';

const prdSchema = new mongoose.Schema({
  feedbackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Feedback', required: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['draft', 'approved', 'rejected', 'implemented'], default: 'draft' },
  priority: { type: String, enum: ['P0', 'P1', 'P2', 'P3'], default: 'P2' },
  problemStatement: { type: String, default: '' },
  proposedSolution: { type: String, default: '' },
  userImpact: { type: String, default: '' },
  technicalNotes: { type: String, default: '' },
  acceptanceCriteria: [{ type: String }],
  suggestedFiles: [{ type: String }],
  rawAnalysis: { type: String, default: '' },
  langflowRunId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

prdSchema.pre('save', function () {
  this.updatedAt = new Date();
});

export const PRD = mongoose.model('PRD', prdSchema);