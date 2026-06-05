import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  type: { type: String, required: true, enum: ['bug', 'feature', 'improvement', 'other'] },
  subject: { type: String, required: true, maxlength: 100 },
  detail: { type: String, required: true, maxlength: 2000 },
  votes: [{ type: String }],
  voteCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  priority: { type: String, enum: ['P0', 'P1', 'P2', 'P3', 'P-PENDING'], default: 'P-PENDING' },
  priorityReason: { type: String, default: '' },
  analysis: { type: String, default: '' },
  langflowRunId: { type: String, default: '' },
  analyzedAt: { type: Date },
  prdGenerated: { type: Boolean, default: false }
});

feedbackSchema.pre('save', function () {
  this.voteCount = this.votes.length;
});

export const Feedback = mongoose.model('Feedback', feedbackSchema);
