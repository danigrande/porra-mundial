// ============================================
// SHARED DATA — Datos maestros del Mundial 2026
// ============================================

export const TEAM_CODES = {
  'México': 'mx', 'Sudáfrica': 'za', 'Corea del Sur': 'kr', 'República Checa': 'cz',
  'Canadá': 'ca', 'Bosnia y Herzegovina': 'ba', 'Catar': 'qa', 'Suiza': 'ch',
  'Brasil': 'br', 'Marruecos': 'ma', 'Haití': 'ht', 'Escocia': 'gb-sct',
  'Estados Unidos': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turquía': 'tr',
  'Alemania': 'de', 'Curazao': 'cw', 'Costa de Marfil': 'ci', 'Ecuador': 'ec',
  'Países Bajos': 'nl', 'Japón': 'jp', 'Suecia': 'se', 'Túnez': 'tn',
  'Bélgica': 'be', 'Egipto': 'eg', 'Irán': 'ir', 'Nueva Zelanda': 'nz',
  'España': 'es', 'Cabo Verde': 'cv', 'Arabia Saudita': 'sa', 'Uruguay': 'uy',
  'Francia': 'fr', 'Senegal': 'sn', 'Irak': 'iq', 'Noruega': 'no',
  'Argentina': 'ar', 'Argelia': 'dz', 'Austria': 'at', 'Jordania': 'jo',
  'Portugal': 'pt', 'RD Congo': 'cd', 'Uzbekistán': 'uz', 'Colombia': 'co',
  'Inglaterra': 'gb-eng', 'Croacia': 'hr', 'Ghana': 'gh', 'Panamá': 'pa'
};

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

export const BRACKET_MATCHES = {
  73: ['2A', '2B'], 76: ['1C', '2F'], 74: ['1E', '3ABCDF'], 75: ['1F', '2C'],
  78: ['2E', '2I'], 77: ['1I', '3CDFGH'], 79: ['1A', '3CEFHI'], 80: ['1L', '3EHIJK'],
  82: ['1G', '3AEHIJ'], 81: ['1D', '3BEFIJ'], 84: ['1H', '2J'], 83: ['2K', '2L'],
  85: ['1B', '3EFGIJ'], 88: ['2D', '2G'], 86: ['1J', '2H'], 87: ['1K', '3DEIJL'],
  90: ['W73', 'W75'], 89: ['W74', 'W77'], 91: ['W76', 'W78'], 92: ['W79', 'W80'],
  93: ['W83', 'W84'], 94: ['W81', 'W82'], 95: ['W86', 'W88'], 96: ['W85', 'W87'],
  97: ['W89', 'W90'], 98: ['W93', 'W94'], 99: ['W91', 'W92'], 100: ['W95', 'W96'],
  101: ['W97', 'W98'], 102: ['W99', 'W100'], 103: ['L101', 'L102'], 104: ['W101', 'W102'],
};

export const KNOCKOUT_BRACKET = [
  { id: 'r32', name: '1/16 Final', matches: [73, 76, 74, 75, 78, 77, 79, 80, 82, 81, 84, 83, 85, 88, 86, 87] },
  { id: 'r16', name: '1/8 Final', matches: [90, 89, 91, 92, 93, 94, 95, 96] },
  { id: 'qf', name: '1/4 Final', matches: [97, 98, 99, 100] },
  { id: 'sf', name: 'Semifinales', matches: [101, 102] },
  { id: '3rd', name: '3er Puesto', matches: [103] },
  { id: 'final', name: 'FINAL', matches: [104] },
];
