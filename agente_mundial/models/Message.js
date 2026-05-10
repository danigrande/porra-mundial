import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true }, // Nombre del grupo (antes era WhatsApp JID)
  senderId: { type: String, required: true }, // Teléfono del remitente o 'agente-mundial'
  senderName: { type: String }, // Nombre del remitente
  text: { type: String }, // Contenido del mensaje (opcional si hay media)
  type: { type: String, enum: ['text', 'image', 'audio', 'sticker', 'gif'], default: 'text' },
  mediaUrl: { type: String }, // URL de la imagen, audio, sticker o gif
  isBot: { type: Boolean, default: false }, // true = mensaje del Agente Mundial
  embedding: { type: [Number] }, // Vector para LangChain RAG
  timestamp: { type: Date, default: Date.now }
});

export const Message = mongoose.model('Message', messageSchema);
