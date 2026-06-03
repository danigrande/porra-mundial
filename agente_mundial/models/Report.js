import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true },
  reportedId: { type: String, required: true },
  messageId: { type: String },
  messageText: { type: String },
  reason: { type: String, required: true, enum: ['Spam', 'Acoso', 'Contenido inapropiado', 'Otro'] },
  groupName: { type: String },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed', 'actioned'], default: 'pending' },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export const Report = mongoose.model('Report', reportSchema);
