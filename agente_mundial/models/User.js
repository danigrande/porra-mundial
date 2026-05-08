import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // Identificador único del usuario
  pin: { type: String, required: true },
  nickname: { type: String },
  likes: [{ type: String }],
  dislikes: [{ type: String }],
  humor_style: { type: String, default: 'Divertido y amigable' },
  groups: [{ type: String }],
  isAdminOf: [{ type: String }], // Grupos de los que es admin
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
