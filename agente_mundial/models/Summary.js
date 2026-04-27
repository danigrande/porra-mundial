import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema({
  playerName: { type: String, required: true }, // "Global" o el nombre del jugador
  groupName: { type: String, required: true },
  text: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

// Índice para búsqueda rápida
summarySchema.index({ playerName: 1, groupName: 1 });

export const Summary = mongoose.model('Summary', summarySchema);
