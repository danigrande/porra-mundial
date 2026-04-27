import { Message } from './models/Message.js';
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import dotenv from 'dotenv';

dotenv.config();

// Configurar embeddings
// Requiere HUGGINGFACEHUB_API_KEY en el archivo .env
let embeddings = null;
try {
  if (process.env.HUGGINGFACEHUB_API_KEY) {
    embeddings = new HuggingFaceInferenceEmbeddings({
        apiKey: process.env.HUGGINGFACEHUB_API_KEY,
    });
  } else {
    console.warn("⚠️ HUGGINGFACEHUB_API_KEY no encontrada. El sistema RAG se desactivará temporalmente.");
  }
} catch (e) {
  console.error("Error inicializando embeddings:", e);
}

/**
 * Guarda un mensaje de WhatsApp en MongoDB y calcula su vector (embedding)
 */
export async function saveChatMessage(chatId, senderId, senderName, text) {
  try {
    let vector = [];
    if (embeddings) {
      // Generar el embedding del texto
      const response = await embeddings.embedQuery(text);
      vector = response;
    }

    await Message.create({
      chatId,
      senderId,
      senderName,
      text,
      embedding: vector
    });

    console.log(`[RAG] Mensaje guardado y vectorizado de ${senderName || senderId}`);
  } catch (error) {
    console.error('[RAG] Error guardando mensaje:', error.message);
  }
}

/**
 * Busca mensajes relevantes sobre un jugador en el historial
 */
export async function retrieveContextForPlayer(chatId, playerName, limit = 30) {
  if (!embeddings) return "";

  try {
    // 1. Generar embedding para la consulta de búsqueda
    const query = `Información, chistes o menciones sobre ${playerName}`;
    const queryVector = await embeddings.embedQuery(query);

    // 2. Búsqueda vectorial en MongoDB (requiere Atlas Vector Search configurado en la colección)
    // Si no está configurado, hacemos un fallback a búsqueda de texto simple
    
    // Fallback simple: Buscar mensajes donde se mencione el nombre o que haya enviado él
    const messages = await Message.find({
      chatId,
      $or: [
        { senderName: { $regex: playerName, $options: 'i' } },
        { text: { $regex: playerName, $options: 'i' } }
      ]
    }).sort({ timestamp: -1 }).limit(limit);

    if (messages.length === 0) return "No hay contexto en el chat sobre este jugador.";

    // Unir los mensajes para el contexto del LLM
    const context = messages.map(m => `[${new Date(m.timestamp).toLocaleDateString()}] ${m.senderName}: ${m.text}`).join('\n');
    return context;

  } catch (error) {
    console.error('[RAG] Error recuperando contexto:', error.message);
    return "Error recuperando contexto del chat.";
  }
}
