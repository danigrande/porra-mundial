import {
  AGENT_PROMPTS,
  extractPRDFromAnalysis,
  parseJson,
  simulateAnalysis,
} from '../../prdPipeline.js';

describe('PRD Pipeline (Feedback → PRD nativo)', () => {
  describe('parseJson', () => {
    it('parsea un JSON plano', () => {
      expect(parseJson('{"priority":"P1","reason":"core"}')).toEqual({
        priority: 'P1',
        reason: 'core',
      });
    });

    it('tolera fences de markdown', () => {
      const raw = '```json\n{"status":"prd_generated","priority":"P0"}\n```';
      expect(parseJson(raw)).toEqual({ status: 'prd_generated', priority: 'P0' });
    });

    it('extrae el objeto JSON embebido en texto', () => {
      const raw = 'Aquí tienes el resultado:\n{"type":"bug","priority":"P0"}\nGracias.';
      expect(parseJson(raw)).toEqual({ type: 'bug', priority: 'P0' });
    });

    it('devuelve null si no hay JSON válido', () => {
      expect(parseJson('no hay json aquí')).toBeNull();
      expect(parseJson('')).toBeNull();
      expect(parseJson(null)).toBeNull();
      expect(parseJson('{roto: }')).toBeNull();
    });
  });

  describe('simulateAnalysis (fallback sin LLM)', () => {
    it('marca P0 ante un bug', () => {
      const result = simulateAnalysis('[bug] La app falla al puntuar');
      expect(result.simulated).toBe(true);
      expect(result.analysis.priority).toBe('P0');
    });

    it('marca P1 ante un problema de scoring/login', () => {
      expect(simulateAnalysis('[bug] el login no funciona').analysis.priority).toBe('P0');
      expect(simulateAnalysis('los scores están mal').analysis.priority).toBe('P1');
    });

    it('marca P2 ante una mejora de chat/UI', () => {
      expect(simulateAnalysis('mejorar el chat del grupo').analysis.priority).toBe('P2');
    });

    it('marca P3 ante una sugerencia menor', () => {
      expect(simulateAnalysis('podríais añadir más emojis').analysis.priority).toBe('P3');
    });

    it('nunca genera PRD en el fallback', () => {
      expect(simulateAnalysis('[bug] falla todo').prd).toBeNull();
    });
  });

  describe('extractPRDFromAnalysis', () => {
    it('convierte la salida del orquestador en el modelo de PRD', () => {
      const raw = JSON.stringify({
        status: 'prd_generated',
        priority: 'P1',
        title: 'Arreglar el login',
        problemStatement: 'El login falla',
        proposedSolution: 'Corregir el endpoint',
        userImpact: 'Los usuarios no pueden entrar',
        technicalNotes: 'auth.js',
        acceptanceCriteria: ['El login funciona', 'Hay test'],
        suggestedFiles: ['auth.js'],
      });
      const prd = extractPRDFromAnalysis(raw);
      expect(prd.title).toBe('Arreglar el login');
      expect(prd.priority).toBe('P1');
      expect(prd.acceptanceCriteria).toEqual(['El login funciona', 'Hay test']);
    });

    it('acepta un objeto ya parseado', () => {
      expect(extractPRDFromAnalysis({ title: 'X', priority: 'P2' }).title).toBe('X');
    });

    it('devuelve null si no hay JSON', () => {
      expect(extractPRDFromAnalysis('sin json')).toBeNull();
    });
  });

  describe('prompts de los agentes', () => {
    it('incluye los tres agentes del flow', () => {
      expect(AGENT_PROMPTS.strategyOwner).toContain('Strategy Owner');
      expect(AGENT_PROMPTS.prdWriter).toContain('PRD Writer');
      expect(AGENT_PROMPTS.orchestrator).toContain('PM-Agent-Orchestrator');
    });

    it('el Strategy Owner define la rúbrica P0–P3 y P-PENDING', () => {
      const p = AGENT_PROMPTS.strategyOwner;
      ['P0', 'P1', 'P2', 'P3', 'P-PENDING'].forEach((tier) => expect(p).toContain(tier));
    });
  });
});
