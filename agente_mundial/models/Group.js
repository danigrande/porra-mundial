import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rules: {
    pts_group_sign: { type: Number, default: 1 },
    pts_group_diff: { type: Number, default: 2 },
    pts_group_exact: { type: Number, default: 3 },
    pts_group_pos: { type: Number, default: 1 },
    pts_group_qualify: { type: Number, default: 2 },
    pts_ko_sign: { type: Number, default: 2 },
    pts_ko_diff: { type: Number, default: 4 },
    pts_ko_exact: { type: Number, default: 6 },
    pts_ko_qualify: { type: Number, default: 3 },
    pts_honor_champ: { type: Number, default: 10 },
    pts_honor_runner: { type: Number, default: 7 },
    pts_honor_third: { type: Number, default: 5 },
    pts_award_gold: { type: Number, default: 5 },
    pts_award_silver: { type: Number, default: 3 },
    pts_award_bronze: { type: Number, default: 2 },
    opt_diff_adjust: { type: Boolean, default: false }
  },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  whatsappGroupId: { type: String, default: null }, // WhatsApp Group JID (ej: "120363xxxxx@g.us")
  createdAt: { type: Date, default: Date.now }
});

export const Group = mongoose.model('Group', groupSchema);
