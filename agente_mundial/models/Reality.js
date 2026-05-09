import mongoose from 'mongoose';

const realitySchema = new mongoose.Schema({
  tournament: { type: String, default: 'worldcup2026', unique: true },
  results: { type: Object, default: {} },
  autoPopulatedPhases: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

export const Reality = mongoose.model('Reality', realitySchema);
