import mongoose from 'mongoose';

const seenArticleSchema = new mongoose.Schema({
  guid: { type: String, required: true, unique: true },
  title: { type: String },
  seenAt: { type: Date, default: Date.now },
});

export const SeenArticle = mongoose.model('SeenArticle', seenArticleSchema);
