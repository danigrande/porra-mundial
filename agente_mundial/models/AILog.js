import mongoose from 'mongoose';

const aiLogSchema = new mongoose.Schema({
  // Tipo de llamada a Groq
  type: { 
    type: String, 
    enum: ['response', 'summary', 'personality'], 
    required: true 
  },
  playerName: { type: String, default: 'Unknown' },
  groupName: { type: String, default: 'Unknown' },
  
  // RAG Data
  ragQuery: { type: String, default: '' },
  ragResultCount: { type: Number, default: 0 },
  ragContext: { type: String, default: '' },
  
  // Groq Prompt Data
  systemPrompt: { type: String, required: true },
  userPrompt: { type: String, required: true },
  groqResponse: { type: String, default: '' },
  
  // Model Config
  model: { type: String, default: '' },
  temperature: { type: Number, default: 0 },
  maxTokens: { type: Number, default: 0 },
  
  // Usage Metrics
  tokensUsed: { type: Number, default: 0 },
  promptTokens: { type: Number, default: 0 },
  completionTokens: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  
  // Origin
  source: { 
    type: String, 
    enum: ['chat', 'web', 'cron', 'manual'], 
    default: 'chat' 
  },
  
  // Status
  success: { type: Boolean, default: true },
  errorMessage: { type: String, default: '' },
  
  createdAt: { type: Date, default: Date.now }
});

// Índices para consultas rápidas del dashboard
aiLogSchema.index({ createdAt: -1 });
aiLogSchema.index({ playerName: 1, createdAt: -1 });
aiLogSchema.index({ type: 1, createdAt: -1 });

export const AILog = mongoose.models.AILog || mongoose.model('AILog', aiLogSchema);
