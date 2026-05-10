import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true }, // Nombre del grupo (antes era WhatsApp JID)
  senderId: { type: String, required: true }, // Teléfono del remitente o 'agente-mundial'
  senderName: { type: String }, // Nombre del remitente
  text: { type: String, required: true }, // Contenido del mensaje
  isBot: { type: Boolean, default: false }, // true = mensaje del Agente Mundial
  embedding: { type: [Number] }, // Vector para LangChain RAG
  timestamp: { type: Date, default: Date.now }
});

export const Message = mongoose.model('Message', messageSchema);
