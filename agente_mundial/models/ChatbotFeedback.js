import mongoose from 'mongoose';

const chatbotFeedbackSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
  userId:    { type: String, required: true },
  userName:  { type: String, required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  reason:    { type: String, default: null },
  aiLogId:   { type: mongoose.Schema.Types.ObjectId, ref: 'AILog', default: null },
  createdAt: { type: Date, default: Date.now }
});

chatbotFeedbackSchema.index({ messageId: 1, userId: 1 }, { unique: true });

export const ChatbotFeedback = mongoose.model('ChatbotFeedback', chatbotFeedbackSchema);

// Rating semántica:
// 1 = terrible (downvote fuerte) → HITL user_downvote
// 2 = mala (downvote leve) → HITL user_downvote
// 3 = neutral → no action
// 4 = buena → estadística positiva; si judge fail → HITL judge_disagree
// 5 = excelente → estadística positiva; si judge fail → HITL judge_disagree
