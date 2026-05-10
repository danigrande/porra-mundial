// ============================================
// FIXTURES — Datos maestros del Mundial 2026 (Copia local)
// ============================================

export const FIXTURE_GROUPS = [
  { letter: 'A', teams: ['México', 'Sudáfrica', 'Corea del Sur', 'República Checa'] },
  { letter: 'B', teams: ['Canadá', 'Bosnia y Herzegovina', 'Catar', 'Suiza'] },
  { letter: 'C', teams: ['Brasil', 'Marruecos', 'Haití', 'Escocia'] },
  { letter: 'D', teams: ['Estados Unidos', 'Paraguay', 'Australia', 'Turquía'] },
  { letter: 'E', teams: ['Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador'] },
  { letter: 'F', teams: ['Países Bajos', 'Japón', 'Suecia', 'Túnez'] },
  { letter: 'G', teams: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'] },
  { letter: 'H', teams: ['España', 'Cabo Verde', 'Arabia Saudita', 'Uruguay'] },
  { letter: 'I', teams: ['Francia', 'Senegal', 'Irak', 'Noruega'] },
  { letter: 'J', teams: ['Argentina', 'Argelia', 'Austria', 'Jordania'] },
  { letter: 'K', teams: ['Portugal', 'RD Congo', 'Uzbekistán', 'Colombia'] },
  { letter: 'L', teams: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá'] },
];

export function getGroupMatches(group: { letter: string, teams: string[] }) {
  const matches = [];
  const t = group.teams;
  const L = group.letter;
  matches.push({ id: `g${L}_m0`, team1: t[0], team2: t[1] });
  matches.push({ id: `g${L}_m1`, team1: t[2], team2: t[3] });
  matches.push({ id: `g${L}_m2`, team1: t[0], team2: t[2] });
  matches.push({ id: `g${L}_m3`, team1: t[1], team2: t[3] });
  matches.push({ id: `g${L}_m4`, team1: t[3], team2: t[0] });
  matches.push({ id: `g${L}_m5`, team1: t[1], team2: t[2] });
  return matches;
}
