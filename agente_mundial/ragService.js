import { Message } from './models/Message.js';
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import dotenv from 'dotenv';

dotenv.config();

// Configurar embeddings
let embeddings = null;
try {
  if (process.env.HUGGINGFACEHUB_API_KEY) {
    embeddings = new HuggingFaceInferenceEmbeddings({
        apiKey: process.env.HUGGINGFACEHUB_API_KEY,
        modelName: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    });
  }
} catch (e) {
  console.error("[RAG] Error inicializando embeddings:", e);
}

/**
 * Calcula el vector (embedding) de un mensaje ya existente y lo actualiza
 */
export async function vectorizeMessage(messageId, text) {
  try {
    if (!embeddings) return;
    const vector = await embeddings.embedQuery(text);
    await Message.findByIdAndUpdate(messageId, { embedding: vector });
  } catch (error) {
    console.error('[RAG] Error vectorizando mensaje:', error.message);
  }
}

/**
 * Busca mensajes relevantes sobre un jugador en el historial
 */
export async function retrieveContextForPlayer(chatId, playerName, limit = 30) {
  try {
    const cleanChatId = chatId ? chatId.trim() : "";
    const cleanPlayerName = playerName ? playerName.trim() : "";

    if (!cleanChatId) return "";

    // Búsqueda insensible a mayúsculas/minúsculas para el grupo
    const chatIdRegex = new RegExp(`^${cleanChatId}$`, 'i');
    
    // Términos de búsqueda por nombre
    const nameTerms = [cleanPlayerName];
    if (cleanPlayerName.includes(' ')) {
        nameTerms.push(cleanPlayerName.split(' ')[0]);
    }

    // 1. Búsqueda por palabras clave del jugador
    const query = {
      chatId: { $regex: chatIdRegex },
      $or: [
        { senderName: { $in: nameTerms } },
        { senderName: { $regex: cleanPlayerName, $options: 'i' } },
        { text: { $regex: cleanPlayerName, $options: 'i' } }
      ]
    };

    const messages = await Message.find(query).sort({ timestamp: -1 }).limit(limit);
    let finalMessages = [...messages];

    // 2. Si no hay suficientes mensajes específicos, traer los últimos del grupo (contexto reciente)
    if (finalMessages.length < 5) {
        let recentMessages = await Message.find({ chatId: { $regex: chatIdRegex } })
            .sort({ timestamp: -1 })
            .limit(10);
        
        // Búsqueda parcial si el ID de grupo parece fallar
        if (recentMessages.length === 0 && cleanChatId.length > 3) {
            recentMessages = await Message.find({ chatId: { $regex: cleanChatId.split(' ')[0], $options: 'i' } })
                .sort({ timestamp: -1 })
                .limit(5);
        }

        recentMessages.forEach(rm => {
            if (!finalMessages.find(fm => fm._id.toString() === rm._id.toString())) {
                finalMessages.push(rm);
            }
        });
    }

    if (finalMessages.length === 0) return "";

    // Ordenar cronológicamente para el prompt
    finalMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const context = finalMessages.map(m => {
      const timeStr = new Date(m.timestamp).toLocaleTimeString();
      const content = m.text ? m.text : `[Mensaje tipo: ${m.type || 'media'}]`;
      return `[${timeStr}] ${m.senderName}: ${content}`;
    }).join('\n');
    
    return context;

  } catch (error) {
    console.error('[RAG] Error recuperando contexto:', error.message);
    return "";
  }
}
