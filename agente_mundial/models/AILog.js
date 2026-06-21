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
    enum: ['chat', 'web', 'cron', 'manual', 'eval_runner'], 
    default: 'chat' 
  },
  
  // Status
  success: { type: Boolean, default: true },
  errorMessage: { type: String, default: '' },

  // ── Eval System (LLM-as-a-Judge) ──
  evalScores: {
    language_purity: { type: Number },
    quality: { type: Number }
  },
  evalFeedback: { type: String, default: '' },
  evalMainIssue: {
    type: String,
    enum: ['language', 'humor', 'personality', 'factuality', 'none', ''],
    default: ''
  },
  evalPassed: { type: Boolean },
  evalAttempts: { type: Number, default: 1 },
  evalSkipped: { type: Boolean, default: false },   // true si saltó por sample rate
  anchorsUsed: { type: String, default: '' },        // personalityId

  // ── Language & Transcreation ──
  targetLanguage: { type: String, default: 'es' },
  wasTranscreated: { type: Boolean, default: false },
  transcreationSource: { type: String, default: '' }, // texto fuente antes de transcreación
  transcreationFallback: { type: Boolean, default: false }, // true si se usó fallback al original
  
  createdAt: { type: Date, default: Date.now }
});

// Índices para consultas rápidas del dashboard
aiLogSchema.index({ createdAt: -1 });
aiLogSchema.index({ playerName: 1, createdAt: -1 });
aiLogSchema.index({ type: 1, createdAt: -1 });
aiLogSchema.index({ evalPassed: 1, createdAt: -1 });      // para dashboard de evals
aiLogSchema.index({ targetLanguage: 1, createdAt: -1 });  // para breakdown por idioma

export const AILog = mongoose.models.AILog || mongoose.model('AILog', aiLogSchema);

