import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true }, // ID del canal/grupo de chat nativo
  senderId: { type: String, required: true }, // ID del remitente (teléfono) o 'agente-mundial'
  senderName: { type: String }, // Nombre del remitente
  text: { type: String }, // Contenido del mensaje (opcional si hay media)
  type: { type: String, enum: ['text', 'image', 'audio', 'sticker', 'gif'], default: 'text' },
  mediaUrl: { type: String }, // URL de la imagen, audio, sticker o gif
  isBot: { type: Boolean, default: false }, // true = mensaje del Agente Mundial
  embedding: { type: [Number] }, // Vector para LangChain RAG
  timestamp: { type: Date, default: Date.now }
});

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
