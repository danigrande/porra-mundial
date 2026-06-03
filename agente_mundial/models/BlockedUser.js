import mongoose from 'mongoose';

const blockedUserSchema = new mongoose.Schema({
  blockerId: { type: String, required: true },  // Quién bloquea (userId)
  blockedId: { type: String, required: true },  // A quién bloquea (userId)
  groupName: { type: String },                     // Opcional: bloqueo por grupo
  createdAt: { type: Date, default: Date.now }
});

// Índice único para evitar bloqueos duplicados
blockedUserSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export const BlockedUser = mongoose.model('BlockedUser', blockedUserSchema);
