import mongoose from 'mongoose';

const pushTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true }, // Expo push token
  platform: { type: String, enum: ['ios', 'android', 'web'], default: 'android' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const PushToken = mongoose.model('PushToken', pushTokenSchema);
