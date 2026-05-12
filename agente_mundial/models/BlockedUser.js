import mongoose from 'mongoose';

const blockedUserSchema = new mongoose.Schema({
  blockerPhone: { type: String, required: true },  // Quién bloquea
  blockedPhone: { type: String, required: true },  // A quién bloquea
  groupName: { type: String },                     // Opcional: bloqueo por grupo
  createdAt: { type: Date, default: Date.now }
});

// Índice único para evitar bloqueos duplicados
blockedUserSchema.index({ blockerPhone: 1, blockedPhone: 1 }, { unique: true });

export const BlockedUser = mongoose.model('BlockedUser', blockedUserSchema);
