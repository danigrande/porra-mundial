import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  type: { type: String, required: true, enum: ['bug', 'feature'] },
  subject: { type: String, required: true, maxlength: 100 },
  detail: { type: String, required: true, maxlength: 1500 },
  votes: [{ type: String }],
  voteCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

feedbackSchema.pre('save', function () {
  this.voteCount = this.votes.length;
});

export const Feedback = mongoose.model('Feedback', feedbackSchema);
