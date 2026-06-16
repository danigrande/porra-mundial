import { calculateScore, getStandings, isRealTeam } from '../../scoringEngine.js';

describe('Motor de Puntuación (Scoring Engine)', () => {
  
  describe('Evaluación de Partidos', () => {

    it('debe otorgar puntos por signo y diferencia en empate no exacto (2-2 vs 1-1)', () => {
      const reality = { gA_m0_h: 1, gA_m0_a: 1 };
      const prediction = { gA_m0_h: 2, gA_m0_a: 2 };

      const result = calculateScore(prediction, reality);
      expect(result.totalPts).toBe(20); // 10 (signo) + 10 (diferencia, desvio=0)
      expect(result.exactHits).toBe(0);
    });

    it('debe otorgar el máximo de puntos por empate exacto (1-1 vs 1-1)', () => {
      const reality = { gA_m0_h: 1, gA_m0_a: 1 };
      const prediction = { gA_m0_h: 1, gA_m0_a: 1 };

      const result = calculateScore(prediction, reality);
      expect(result.totalPts).toBe(30); // 10 (signo) + 10 (diferencia) + 10 (exacto)
      expect(result.exactHits).toBe(1);
    });

    it('debe otorgar 0 puntos si la predicción es incorrecta en signo', () => {
      // Realidad: 2-0 (Gana Local)
      const reality = { gA_m0_h: 2, gA_m0_a: 0 };
      // Predicción: 0-1 (Gana Visitante)
      const prediction = { gA_m0_h: 0, gA_m0_a: 1 };
      
      const result = calculateScore(prediction, reality);
      expect(result.totalPts).toBe(0);
    });

    it('debe otorgar puntos base por acertar el signo (ganador/empate) sin acertar la diferencia', () => {
      const reality = { gA_m0_h: 2, gA_m0_a: 1 }; // Gana Local (diferencia 1)
      const prediction = { gA_m0_h: 3, gA_m0_a: 0 }; // Gana Local (diferencia 3)
      
      const result = calculateScore(prediction, reality);
      expect(result.totalPts).toBe(10); // 10 puntos por signo, 0 por diferencia
      expect(result.exactHits).toBe(0);
    });

    it('debe otorgar puntos extra por acertar la diferencia de goles', () => {
      const reality = { gA_m0_h: 3, gA_m0_a: 1 }; // Gana Local por 2 goles
      const prediction = { gA_m0_h: 2, gA_m0_a: 0 }; // Gana Local por 2 goles
      
      const result = calculateScore(prediction, reality);
      expect(result.totalPts).toBe(20); // 10 (signo) + 10 (diferencia)
      expect(result.exactHits).toBe(0);
    });

    it('debe otorgar el máximo de puntos por resultado exacto', () => {
      const reality = { gA_m0_h: 2, gA_m0_a: 1 };
      const prediction = { gA_m0_h: 2, gA_m0_a: 1 };
      
      const result = calculateScore(prediction, reality);
      expect(result.totalPts).toBe(30); // 10 (signo) + 10 (diferencia) + 10 (exacto)
      expect(result.exactHits).toBe(1);
    });

  });

  describe('Clasificación y Grupos', () => {
    it('debe calcular correctamente los puntos de una tabla de grupo', () => {
      // Simulamos los 6 partidos del Grupo A
      // A1 vs A2 (2-0), A3 vs A4 (1-1)
      // A4 vs A2 (0-1), A1 vs A3 (1-0)
      // A4 vs A1 (0-0), A2 vs A3 (2-1)
      const groupAData = {
        gA_m0_h: 2, gA_m0_a: 0,
        gA_m1_h: 1, gA_m1_a: 1,
        gA_m2_h: 0, gA_m2_a: 1,
        gA_m3_h: 1, gA_m3_a: 0,
        gA_m4_h: 0, gA_m4_a: 0,
        gA_m5_h: 2, gA_m5_a: 1,
      };

      const standings = getStandings('A', groupAData);
      
      // El equipo A1 gana 2, empata 1 -> 7 pts
      expect(standings[0].pts).toBe(7);
      
      // El equipo A2 pierde 1, gana 2 -> 6 pts
      expect(standings[1].pts).toBe(6);
    });
  });

  describe('Validación de Equipos Reales', () => {
    it('debe identificar códigos de posición y TBD como no reales', () => {
      expect(isRealTeam('TBD')).toBe(false);
      expect(isRealTeam('1A')).toBe(false);
      expect(isRealTeam('W95')).toBe(false);
      expect(isRealTeam('L104')).toBe(false);
    });

    it('debe identificar nombres de países como equipos reales', () => {
      expect(isRealTeam('España')).toBe(true);
      expect(isRealTeam('Argentina')).toBe(true);
      expect(isRealTeam('Brasil')).toBe(true);
    });
  });

});
