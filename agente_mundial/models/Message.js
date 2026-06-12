import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String },
  text: { type: String },
  type: { type: String, enum: ['text', 'image', 'audio', 'sticker', 'gif', 'file'], default: 'text' },
  mediaUrl: { type: String },
  isBot: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.Mixed, default: null },
  reactions: { type: Map, of: [String], default: {} },
  edited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  deletedFor: { type: [String], default: [] },
  embedding: { type: [Number] },
  timestamp: { type: Date, default: Date.now }
});

messageSchema.index({ chatId: 1, timestamp: -1 });

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
