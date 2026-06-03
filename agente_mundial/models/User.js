import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true }, // Identificador único del usuario (email)
  password: { type: String, required: true },
  nickname: { type: String },
  likes: [{ type: String }],
  dislikes: [{ type: String }],
  humor_style: { type: String, default: 'Divertido y amigable' },
  ai_personality: { type: String, default: 'andres_montes' },
  groups: [{ type: String }],
  isAdminOf: [{ type: String }], // Grupos de los que es admin
  notificationPreference: { 
    type: String, 
    enum: ['all', 'agent-mentions', 'mentions', 'none'], 
    default: 'all' 
  },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
