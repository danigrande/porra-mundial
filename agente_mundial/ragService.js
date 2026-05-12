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
        modelName: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    });
  } else {
    console.warn("⚠️ HUGGINGFACEHUB_API_KEY no encontrada. El sistema RAG se desactivará temporalmente.");
  }
} catch (e) {
  console.error("Error inicializando embeddings:", e);
}

/**
 * Calcula el vector (embedding) de un mensaje ya existente y lo actualiza
 */
export async function vectorizeMessage(messageId, text) {
  try {
    if (!embeddings) return;

    // Generar el embedding del texto
    const vector = await embeddings.embedQuery(text);

    await Message.findByIdAndUpdate(messageId, { embedding: vector });
    console.log(`[RAG] Mensaje ${messageId} vectorizado correctamente.`);
  } catch (error) {
    console.error('[RAG] Error vectorizando mensaje:', error.message);
  }
}

/**
 * Busca mensajes relevantes sobre un jugador en el historial
 */
export async function retrieveContextForPlayer(chatId, playerName, limit = 30) {
  try {
    let queryVector = null;
    
    // Si hay embeddings configurados, lo usamos (para el futuro)
    if (embeddings) {
        const query = `Información, chistes o menciones sobre ${playerName}`;
        queryVector = await embeddings.embedQuery(query);
    }
    
    // 2. Búsqueda vectorial en MongoDB (requiere Atlas Vector Search configurado en la colección)
    // Si no está configurado, hacemos un fallback a búsqueda de texto simple
    
    // Fallback simple: Buscar mensajes donde se mencione el nombre o que haya enviado él
    console.log(`[RAG] Buscando mensajes para chatId: "${chatId}", playerName: "${playerName}"`);
    
    const messages = await Message.find({
      chatId,
      $or: [
        { senderName: { $regex: playerName, $options: 'i' } },
        { text: { $regex: playerName, $options: 'i' } }
      ]
    }).sort({ timestamp: -1 }).limit(limit);

    let finalMessages = [...messages];

    // Si no hay muchos mensajes sobre el jugador, traer los últimos 5 del grupo para contexto reciente
    if (finalMessages.length < 5) {
        const recentMessages = await Message.find({ chatId })
            .sort({ timestamp: -1 })
            .limit(5);
        
        // Evitar duplicados
        recentMessages.forEach(rm => {
            if (!finalMessages.find(fm => fm._id.toString() === rm._id.toString())) {
                finalMessages.push(rm);
            }
        });
        // Re-ordenar por tiempo
        finalMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    console.log(`[RAG] Mensajes finales para contexto: ${finalMessages.length}`);

    if (finalMessages.length === 0) return "";

    const context = finalMessages.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.senderName}: ${m.text}`).join('\n');
    return context;

  } catch (error) {
    console.error('[RAG] Error recuperando contexto:', error.message);
    return "Error recuperando contexto del chat.";
  }
}
