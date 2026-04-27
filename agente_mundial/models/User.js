import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  pin: { type: String, required: true },
  groups: [{ type: String }],
  isAdminOf: [{ type: String }], // Grupos de los que es admin
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
