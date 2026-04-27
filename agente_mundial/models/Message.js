import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: { type: String, required: true }, // ID del grupo de WhatsApp
  senderId: { type: String, required: true }, // ID/Teléfono del remitente
  senderName: { type: String }, // Nombre en WhatsApp
  text: { type: String, required: true }, // Contenido del mensaje
  embedding: { type: [Number] }, // Vector para LangChain RAG
  timestamp: { type: Date, default: Date.now }
});

export const Message = mongoose.model('Message', messageSchema);
