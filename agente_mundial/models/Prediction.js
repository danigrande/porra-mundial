import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  predictions: { type: Object, default: {} }, // Guardamos el JSON de las predicciones aquí
  updatedAt: { type: Date, default: Date.now }
});

// Índice compuesto para que un usuario solo tenga una predicción por grupo
predictionSchema.index({ user: 1, group: 1 }, { unique: true });

export const Prediction = mongoose.model('Prediction', predictionSchema);
