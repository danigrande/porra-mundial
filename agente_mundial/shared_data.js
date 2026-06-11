// ============================================
// SHARED DATA — Datos maestros del Mundial 2026
// ============================================

// Horas de kick-off en UTC para cada partido de grupos.
// Formato: { [matchId]: ISO timestamp UTC }
// Se usa para bloquear partidos en cuanto empiezan (sin esperar resultado).
export const MATCH_KICKOFFS = {
  // Grupo A — 11-12 jun / 24 jun
  'gA_m0': '2026-06-11T19:00:00Z', // México vs Sudáfrica
  'gA_m1': '2026-06-12T02:00:00Z', // Corea del Sur vs Rep. Checa
  'gA_m2': '2026-06-18T23:00:00Z', // Rep. Checa vs Sudáfrica
  'gA_m3': '2026-06-19T01:00:00Z', // México vs Corea del Sur
  'gA_m4': '2026-06-25T01:00:00Z', // Rep. Checa vs México
  'gA_m5': '2026-06-25T01:00:00Z', // Sudáfrica vs Corea del Sur
  // Grupo B — 12-13 jun / 19 jun / 25 jun
  'gB_m0': '2026-06-12T19:00:00Z', // Canadá vs Bosnia y Herzegovina
  'gB_m1': '2026-06-12T22:00:00Z', // Catar vs Suiza
  'gB_m2': '2026-06-18T19:00:00Z', // Suiza vs Bosnia y Herzegovina
  'gB_m3': '2026-06-18T22:00:00Z', // Canadá vs Catar
  'gB_m4': '2026-06-25T22:00:00Z', // Bosnia vs Canadá
  'gB_m5': '2026-06-25T22:00:00Z', // Catar vs Suiza... wait
  // Grupo C — 13 jun / 19 jun / 25 jun
  'gC_m0': '2026-06-13T15:00:00Z', // Brasil vs Marruecos
  'gC_m1': '2026-06-13T22:00:00Z', // Haití vs Escocia
  'gC_m2': '2026-06-19T15:00:00Z', // Marruecos vs Haití
  'gC_m3': '2026-06-19T22:00:00Z', // Brasil vs Escocia
  'gC_m4': '2026-06-26T01:00:00Z', // Marruecos vs Brasil... wait
  'gC_m5': '2026-06-26T01:00:00Z', // Escocia vs Haití
  // Grupo D — 13-14 jun / 20 jun / 26 jun
  'gD_m0': '2026-06-13T19:00:00Z', // EE.UU. vs Paraguay
  'gD_m1': '2026-06-14T01:00:00Z', // Australia vs Turquía
  'gD_m2': '2026-06-20T19:00:00Z', // Turquía vs Paraguay
  'gD_m3': '2026-06-20T22:00:00Z', // EE.UU. vs Australia
  'gD_m4': '2026-06-27T01:00:00Z', // Turquía vs EE.UU.
  'gD_m5': '2026-06-27T01:00:00Z', // Paraguay vs Australia
  // Grupo E — 14-15 jun / 21 jun / 27 jun
  'gE_m0': '2026-06-14T19:00:00Z', // Alemania vs Curazao
  'gE_m1': '2026-06-15T01:00:00Z', // Costa de Marfil vs Ecuador
  'gE_m2': '2026-06-21T19:00:00Z', // Curazao vs Costa de Marfil
  'gE_m3': '2026-06-21T22:00:00Z', // Alemania vs Ecuador
  'gE_m4': '2026-06-27T22:00:00Z', // Curazao vs Alemania
  'gE_m5': '2026-06-27T22:00:00Z', // Ecuador vs Costa de Marfil
  // Grupo F — 15-16 jun / 21 jun / 28 jun
  'gF_m0': '2026-06-15T19:00:00Z', // Países Bajos vs Japón
  'gF_m1': '2026-06-16T01:00:00Z', // Suecia vs Túnez
  'gF_m2': '2026-06-21T15:00:00Z', // Japón vs Suecia
  'gF_m3': '2026-06-21T23:00:00Z', // Países Bajos vs Túnez
  'gF_m4': '2026-06-28T01:00:00Z', // Japón vs Países Bajos
  'gF_m5': '2026-06-28T01:00:00Z', // Túnez vs Suecia
  // Grupo G — 16-17 jun / 22 jun / 28 jun
  'gG_m0': '2026-06-16T19:00:00Z', // Bélgica vs Egipto
  'gG_m1': '2026-06-17T01:00:00Z', // Irán vs Nueva Zelanda
  'gG_m2': '2026-06-22T19:00:00Z', // Egipto vs Irán
  'gG_m3': '2026-06-22T22:00:00Z', // Bélgica vs Nueva Zelanda
  'gG_m4': '2026-06-29T01:00:00Z', // Egipto vs Bélgica
  'gG_m5': '2026-06-29T01:00:00Z', // Nueva Zelanda vs Irán
  // Grupo H — 17-18 jun / 23 jun / 29 jun
  'gH_m0': '2026-06-17T19:00:00Z', // España vs Cabo Verde
  'gH_m1': '2026-06-17T22:00:00Z', // Arabia Saudita vs Uruguay
  'gH_m2': '2026-06-23T19:00:00Z', // Cabo Verde vs Arabia Saudita
  'gH_m3': '2026-06-23T22:00:00Z', // España vs Uruguay
  'gH_m4': '2026-06-29T22:00:00Z', // Cabo Verde vs España
  'gH_m5': '2026-06-29T22:00:00Z', // Uruguay vs Arabia Saudita
  // Grupo I — 18-19 jun / 24 jun / 30 jun
  'gI_m0': '2026-06-18T01:00:00Z', // Francia vs Senegal
  'gI_m1': '2026-06-18T16:00:00Z', // Irak vs Noruega
  'gI_m2': '2026-06-24T15:00:00Z', // Senegal vs Irak
  'gI_m3': '2026-06-24T19:00:00Z', // Francia vs Noruega
  'gI_m4': '2026-06-30T19:00:00Z', // Senegal vs Francia
  'gI_m5': '2026-06-30T19:00:00Z', // Noruega vs Irak
  // Grupo J — 19-20 jun / 25 jun / 1 jul
  'gJ_m0': '2026-06-19T19:00:00Z', // Argentina vs Argelia
  'gJ_m1': '2026-06-20T01:00:00Z', // Austria vs Jordania
  'gJ_m2': '2026-06-25T19:00:00Z', // Argelia vs Austria
  'gJ_m3': '2026-06-25T22:00:00Z', // Argentina vs Jordania
  'gJ_m4': '2026-07-01T22:00:00Z', // Argelia vs Argentina
  'gJ_m5': '2026-07-01T22:00:00Z', // Jordania vs Austria
  // Grupo K — 20-21 jun / 26 jun / 2 jul
  'gK_m0': '2026-06-20T15:00:00Z', // Portugal vs RD Congo
  'gK_m1': '2026-06-20T22:00:00Z', // Uzbekistán vs Colombia
  'gK_m2': '2026-06-26T15:00:00Z', // RD Congo vs Uzbekistán
  'gK_m3': '2026-06-26T22:00:00Z', // Portugal vs Colombia
  'gK_m4': '2026-07-02T22:00:00Z', // RD Congo vs Portugal
  'gK_m5': '2026-07-02T22:00:00Z', // Colombia vs Uzbekistán
  // Grupo L — 21-22 jun / 26-27 jun / 3 jul
  'gL_m0': '2026-06-21T19:00:00Z', // Inglaterra vs Croacia
  'gL_m1': '2026-06-22T01:00:00Z', // Ghana vs Panamá
  'gL_m2': '2026-06-26T19:00:00Z', // Croacia vs Ghana
  'gL_m3': '2026-06-27T01:00:00Z', // Inglaterra vs Panamá
  'gL_m4': '2026-07-03T01:00:00Z', // Croacia vs Inglaterra
  'gL_m5': '2026-07-03T01:00:00Z', // Panamá vs Ghana
};

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
