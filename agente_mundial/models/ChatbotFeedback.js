import mongoose from 'mongoose';

const chatbotFeedbackSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
  userId:    { type: String, required: true },
  userName:  { type: String, required: true },
  rating:    { type: String, enum: ['up', 'down'], required: true },
  reason:    { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

chatbotFeedbackSchema.index({ messageId: 1, userId: 1 }, { unique: true });

export const ChatbotFeedback = mongoose.model('ChatbotFeedback', chatbotFeedbackSchema);
