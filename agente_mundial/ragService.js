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

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function formatMessages(messages) {
  if (messages.length === 0) return "";
  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return messages.map(m => {
    const timeStr = new Date(m.timestamp).toLocaleTimeString();
    const content = m.text ? m.text : `[Mensaje tipo: ${m.type || 'media'}]`;
    return `[${timeStr}] ${m.senderName}: ${content}`;
  }).join('\n');
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
    // Filtrar mensajes del bot para evitar datos obsoletos en el contexto
    let finalMessages = messages.filter(m => m.senderName !== 'Agente Mundial 🏆');

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
            if (rm.senderName === 'Agente Mundial 🏆') return;
            if (!finalMessages.find(fm => fm._id.toString() === rm._id.toString())) {
                finalMessages.push(rm);
            }
        });
    }

    return formatMessages(finalMessages);

  } catch (error) {
    console.error('[RAG] Error recuperando contexto:', error.message);
    return "";
  }
}

/**
 * Búsqueda semántica por similitud de coseno in-app.
 * Si no hay embeddings disponibles, cae en retrieveContextForPlayer (regex).
 * @param {string} chatId - ID del grupo
 * @param {string} playerName - Nombre del jugador
 * @param {string} query - Texto de la consulta del usuario (para embedding)
 * @param {number} limit - Máximo de resultados
 * @returns {Promise<string>} Contexto formateado
 */
export async function semanticSearchContextForPlayer(chatId, playerName, query, limit = 10) {
  try {
    const cleanChatId = chatId ? chatId.trim() : "";
    if (!cleanChatId) return "";

    // Fallback si no hay embeddings configurados
    if (!embeddings) {
      return retrieveContextForPlayer(chatId, playerName, limit);
    }

    const chatIdRegex = new RegExp(`^${cleanChatId}$`, 'i');

    // Buscar mensajes recientes del grupo (más amplio que el regex por nombre)
    const messages = await Message.find({ chatId: { $regex: chatIdRegex } })
      .sort({ timestamp: -1 })
      .limit(100);

    if (messages.length === 0) return "";

    const withEmbeddings = messages.filter(m =>
      m.embedding && Array.isArray(m.embedding) && m.embedding.length > 0
    );

    // Si ningún mensaje tiene embedding, caer a keyword search
    if (withEmbeddings.length === 0) {
      return retrieveContextForPlayer(chatId, playerName, limit);
    }

    const queryVector = await embeddings.embedQuery(query);

    // Calcular similitud coseno, con boost si menciona al jugador
    const cleanPlayerNameLower = playerName?.trim().toLowerCase() || '';
    const scored = withEmbeddings.map(m => {
      let sim = cosineSimilarity(queryVector, m.embedding);
      // Pequeño boost semántico si el mensaje menciona al jugador
      if (cleanPlayerNameLower && m.text && m.text.toLowerCase().includes(cleanPlayerNameLower)) {
        sim = Math.min(1, sim + 0.1);
      }
      return { message: m, similarity: sim };
    });

    // Ordenar por similitud (desc), tomar top-k
    scored.sort((a, b) => b.similarity - a.similarity);
    const topK = scored.slice(0, limit);

    let finalMessages = topK
      .filter(s => s.message.senderName !== 'Agente Mundial 🏆')
      .map(s => s.message);

    if (finalMessages.length === 0) return "";

    return formatMessages(finalMessages);

  } catch (error) {
    console.error('[RAG] Error en semantic search, cayendo a keyword:', error.message);
    return retrieveContextForPlayer(chatId, playerName, limit);
  }
}
