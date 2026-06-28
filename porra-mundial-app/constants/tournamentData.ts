type DataSource = Record<string, any>;

export const TEAM_CODES: Record<string, string> = {
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

export const BRACKET_MATCHES: Record<string, string[]> = {
  73: ['2A', '2B'], 74: ['1E', '3D'], 75: ['1F', '2C'], 76: ['1C', '2F'],
  77: ['1I', '3F'], 78: ['2E', '2I'], 79: ['1A', '3E'], 80: ['1L', '3K'],
  81: ['1D', '3B'], 82: ['1G', '3I'], 83: ['2K', '2L'], 84: ['1H', '2J'],
  85: ['1B', '3J'], 86: ['1J', '2H'], 87: ['1K', '3L'], 88: ['2D', '2G'],
  89: ['W74', 'W77'], 90: ['W73', 'W75'], 91: ['W76', 'W78'], 92: ['W79', 'W80'],
  93: ['W83', 'W84'], 94: ['W81', 'W82'], 95: ['W86', 'W88'], 96: ['W85', 'W87'],
  97: ['W89', 'W90'], 98: ['W93', 'W94'], 99: ['W91', 'W92'], 100: ['W95', 'W96'],
  101: ['W97', 'W98'], 102: ['W99', 'W100'], 103: ['L101', 'L102'], 104: ['W101', 'W102'],
};

export const MATCH_KICKOFFS: Record<string, string> = {
  // ========== GRUPOS ==========
  'gA_m0': '2026-06-11T19:00:00Z', 'gA_m1': '2026-06-12T02:00:00Z',
  'gA_m2': '2026-06-18T16:00:00Z', 'gA_m3': '2026-06-19T01:00:00Z',
  'gA_m4': '2026-06-25T01:00:00Z', 'gA_m5': '2026-06-25T01:00:00Z',
  'gB_m0': '2026-06-12T19:00:00Z', 'gB_m1': '2026-06-13T19:00:00Z',
  'gB_m2': '2026-06-18T19:00:00Z', 'gB_m3': '2026-06-18T22:00:00Z',
  'gB_m4': '2026-06-24T19:00:00Z', 'gB_m5': '2026-06-24T19:00:00Z',
  'gC_m0': '2026-06-13T22:00:00Z', 'gC_m1': '2026-06-14T01:00:00Z',
  'gC_m2': '2026-06-19T22:00:00Z', 'gC_m3': '2026-06-20T00:30:00Z',
  'gC_m4': '2026-06-24T22:00:00Z', 'gC_m5': '2026-06-24T22:00:00Z',
  'gD_m0': '2026-06-13T01:00:00Z', 'gD_m1': '2026-06-14T04:00:00Z',
  'gD_m2': '2026-06-20T03:00:00Z', 'gD_m3': '2026-06-19T19:00:00Z',
  'gD_m4': '2026-06-26T02:00:00Z', 'gD_m5': '2026-06-26T02:00:00Z',
  'gE_m0': '2026-06-14T17:00:00Z', 'gE_m1': '2026-06-14T23:00:00Z',
  'gE_m2': '2026-06-21T00:00:00Z', 'gE_m3': '2026-06-20T20:00:00Z',
  'gE_m4': '2026-06-25T20:00:00Z', 'gE_m5': '2026-06-25T20:00:00Z',
  'gF_m0': '2026-06-14T20:00:00Z', 'gF_m1': '2026-06-15T02:00:00Z',
  'gF_m2': '2026-06-21T04:00:00Z', 'gF_m3': '2026-06-20T17:00:00Z',
  'gF_m4': '2026-06-25T23:00:00Z', 'gF_m5': '2026-06-25T23:00:00Z',
  'gG_m0': '2026-06-15T19:00:00Z', 'gG_m1': '2026-06-16T01:00:00Z',
  'gG_m2': '2026-06-22T01:00:00Z', 'gG_m3': '2026-06-21T19:00:00Z',
  'gG_m4': '2026-06-27T03:00:00Z', 'gG_m5': '2026-06-27T03:00:00Z',
  'gH_m0': '2026-06-15T16:00:00Z', 'gH_m1': '2026-06-15T22:00:00Z',
  'gH_m2': '2026-06-21T22:00:00Z', 'gH_m3': '2026-06-21T16:00:00Z',
  'gH_m4': '2026-06-27T00:00:00Z', 'gH_m5': '2026-06-27T00:00:00Z',
  'gI_m0': '2026-06-16T19:00:00Z', 'gI_m1': '2026-06-16T22:00:00Z',
  'gI_m2': '2026-06-23T00:00:00Z', 'gI_m3': '2026-06-22T21:00:00Z',
  'gI_m4': '2026-06-26T19:00:00Z', 'gI_m5': '2026-06-26T19:00:00Z',
  'gJ_m0': '2026-06-17T01:00:00Z', 'gJ_m1': '2026-06-17T04:00:00Z',
  'gJ_m2': '2026-06-23T03:00:00Z', 'gJ_m3': '2026-06-22T17:00:00Z',
  'gJ_m4': '2026-06-28T02:00:00Z', 'gJ_m5': '2026-06-28T02:00:00Z',
  'gK_m0': '2026-06-17T17:00:00Z', 'gK_m1': '2026-06-18T02:00:00Z',
  'gK_m2': '2026-06-24T02:00:00Z', 'gK_m3': '2026-06-23T17:00:00Z',
  'gK_m4': '2026-06-27T23:30:00Z', 'gK_m5': '2026-06-27T23:30:00Z',
  'gL_m0': '2026-06-17T20:00:00Z', 'gL_m1': '2026-06-17T23:00:00Z',
  'gL_m2': '2026-06-23T23:00:00Z', 'gL_m3': '2026-06-23T20:00:00Z',
  'gL_m4': '2026-06-27T21:00:00Z', 'gL_m5': '2026-06-27T21:00:00Z',
  // ========== 1/16 FINAL (R32) ==========
  'ko_73': '2026-06-28T19:00:00Z',
  'ko_74': '2026-06-29T20:00:00Z',
  'ko_75': '2026-06-30T01:00:00Z',
  'ko_76': '2026-06-29T17:00:00Z',
  'ko_77': '2026-06-30T21:00:00Z',
  'ko_78': '2026-06-30T17:00:00Z',
  'ko_79': '2026-07-01T01:00:00Z',
  'ko_80': '2026-07-01T16:00:00Z',
  'ko_81': '2026-07-02T00:00:00Z',
  'ko_82': '2026-07-01T20:00:00Z',
  'ko_83': '2026-07-02T23:00:00Z',
  'ko_84': '2026-07-02T19:00:00Z',
  'ko_85': '2026-07-03T01:00:00Z',
  'ko_86': '2026-07-03T22:00:00Z',
  'ko_87': '2026-07-04T01:30:00Z',
  'ko_88': '2026-07-03T18:00:00Z',
  // ========== 1/8 FINAL (R16) ==========
  'ko_89': '2026-07-04T21:00:00Z',
  'ko_90': '2026-07-04T17:00:00Z',
  'ko_91': '2026-07-05T20:00:00Z',
  'ko_92': '2026-07-06T00:00:00Z',
  'ko_93': '2026-07-06T19:00:00Z',
  'ko_94': '2026-07-07T00:00:00Z',
  'ko_95': '2026-07-06T16:00:00Z',
  'ko_96': '2026-07-07T20:00:00Z',
  // ========== CUARTOS ==========
  'ko_97': '2026-07-09T20:00:00Z',
  'ko_98': '2026-07-10T19:00:00Z',
  'ko_99': '2026-07-11T21:00:00Z',
  'ko_100': '2026-07-12T01:00:00Z',
  // ========== SEMIFINALES ==========
  'ko_101': '2026-07-14T19:00:00Z',
  'ko_102': '2026-07-15T19:00:00Z',
  // ========== 3º PUESTO ==========
  'ko_103': '2026-07-18T21:00:00Z',
  // ========== FINAL ==========
  'ko_104': '2026-07-19T19:00:00Z',
};

export const KNOCKOUT_BRACKET = [
  { id: 'r32', name: '1/16 Final', matches: [73, 76, 74, 75, 78, 77, 79, 80, 82, 81, 84, 83, 85, 88, 86, 87] },
  { id: 'r16', name: '1/8 Final', matches: [90, 89, 91, 92, 93, 94, 95, 96] },
  { id: 'qf', name: '1/4 Final', matches: [97, 98, 99, 100] },
  { id: 'sf', name: 'Semifinales', matches: [101, 102] },
  { id: '3rd', name: '3er Puesto', matches: [103] },
  { id: 'final', name: 'FINAL', matches: [104] },
];

export function getGroupMatches(group: { letter: string, teams: string[] }) {
  // Pairings MUST match scoringEngine.js: [[0,1],[2,3],[3,1],[0,2],[3,0],[1,2]]
  const pairings = [[0,1],[2,3],[3,1],[0,2],[3,0],[1,2]];
  const t = group.teams;
  const L = group.letter;
  return pairings.map((p, i) => ({
    id: `g${L}_m${i}`,
    team1: t[p[0]],
    team2: t[p[1]],
  }));
}

/** Calculates group standings from reality data, matching scoringEngine.js logic */
export function getGroupStandings(letter: string, reality: Record<string, any>) {
  const group = FIXTURE_GROUPS.find(g => g.letter === letter);
  if (!group) return [];

  const pairings = [[0,1],[2,3],[3,1],[0,2],[3,0],[1,2]];
  const stats: Record<string, { name: string; pts: number; gf: number; ga: number; gd: number; w: number; d: number; l: number }> = {};
  group.teams.forEach(t => { stats[t] = { name: t, pts: 0, gf: 0, ga: 0, gd: 0, w: 0, d: 0, l: 0 }; });

  for (let i = 0; i < 6; i++) {
    const gh = parseInt(reality[`g${letter}_m${i}_h`]);
    const ga = parseInt(reality[`g${letter}_m${i}_a`]);
    if (isNaN(gh) || isNaN(ga)) continue;
    const p = pairings[i];
    const hName = group.teams[p[0]];
    const aName = group.teams[p[1]];
    stats[hName].gf += gh; stats[hName].ga += ga;
    stats[aName].gf += ga; stats[aName].ga += gh;
    if (gh > ga) { stats[hName].pts += 3; stats[hName].w += 1; stats[aName].l += 1; }
    else if (ga > gh) { stats[aName].pts += 3; stats[aName].w += 1; stats[hName].l += 1; }
    else { stats[hName].pts += 1; stats[hName].d += 1; stats[aName].pts += 1; stats[aName].d += 1; }
  }

  return Object.values(stats)
    .map(s => ({ ...s, gd: s.gf - s.ga }))
    .sort((a, b) => (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf));
}

export function fullResolve(code: string, dataSource: DataSource): string {
  if (!code || !dataSource) return code;

  // Grupo: "1A" → 1º del grupo A
  const groupMatch = code.match(/^([1-2])([A-L])$/);
  if (groupMatch) {
    const letter = groupMatch[2];
    let groupFinished = true;
    for (let i = 0; i < 6; i++) {
      if (isNaN(parseInt(dataSource[`g${letter}_m${i}_h`])) || isNaN(parseInt(dataSource[`g${letter}_m${i}_a`]))) {
        groupFinished = false;
        break;
      }
    }
    if (!groupFinished) return code;
    return getGroupStandings(letter, dataSource)[parseInt(groupMatch[1]) - 1]?.name || code;
  }

  // Tercero: "3D" → 3º del grupo D
  if (code.startsWith('3')) {
    const thirdMatch = code.match(/^3([A-L])$/);
    if (thirdMatch) {
      const letter = thirdMatch[1];
      let groupFinished = true;
      for (let i = 0; i < 6; i++) {
        if (isNaN(parseInt(dataSource[`g${letter}_m${i}_h`]))) {
          groupFinished = false;
          break;
        }
      }
      if (!groupFinished) return code;
      return getGroupStandings(letter, dataSource)[2]?.name || code;
    }
    return code;
  }

  // Referencia a partido: "W95" → ganador del partido 95
  const matchRef = code.match(/^([WL])(\d+)$/);
  if (matchRef) {
    const type = matchRef[1];
    const num = matchRef[2];
    const gh = parseInt(dataSource[`ko_${num}_h`]);
    const ga = parseInt(dataSource[`ko_${num}_a`]);
    if (isNaN(gh) || isNaN(ga)) return code;

    const pairing = BRACKET_MATCHES[num];
    if (!pairing) return code;
    const homeResolved = fullResolve(pairing[0], dataSource);
    const awayResolved = fullResolve(pairing[1], dataSource);

    if (gh > ga) {
      return type === 'W' ? homeResolved : awayResolved;
    } else if (ga > gh) {
      return type === 'W' ? awayResolved : homeResolved;
    } else {
      const penH = parseInt(dataSource[`pen_${num}_h`]);
      const penA = parseInt(dataSource[`pen_${num}_a`]);
      if (isNaN(penH) || isNaN(penA)) return code;
      if (penH > penA) {
        return type === 'W' ? homeResolved : awayResolved;
      } else {
        return type === 'W' ? awayResolved : homeResolved;
      }
    }
  }

  return code;
}

export interface CalendarMatch {
  id: string;
  kickoff: string;
  team1: string;
  team2: string;
  isKnockout: boolean;
  phase: string;
}

export function getCalendarMatches(reality?: Record<string, any>): CalendarMatch[] {
  const matches: CalendarMatch[] = [];

  FIXTURE_GROUPS.forEach(g => {
    getGroupMatches(g).forEach(m => {
      matches.push({
        id: m.id,
        kickoff: MATCH_KICKOFFS[m.id] || '',
        team1: m.team1,
        team2: m.team2,
        isKnockout: false,
        phase: `Grupo ${g.letter}`,
      });
    });
  });

  KNOCKOUT_BRACKET.forEach(stage => {
    stage.matches.forEach(mId => {
      const matchId = `ko_${mId}`;
      const pairing = BRACKET_MATCHES[mId];
      if (reality) {
        const hName = reality[`${matchId}_h_team`] || (pairing ? fullResolve(pairing[0], reality) : "TBD");
        const aName = reality[`${matchId}_a_team`] || (pairing ? fullResolve(pairing[1], reality) : "TBD");
        matches.push({ id: matchId, kickoff: MATCH_KICKOFFS[matchId] || '', team1: hName, team2: aName, isKnockout: true, phase: stage.name });
      } else {
        const hName = pairing ? pairing[0] : "TBD";
        const aName = pairing ? pairing[1] : "TBD";
        matches.push({ id: matchId, kickoff: MATCH_KICKOFFS[matchId] || '', team1: hName, team2: aName, isKnockout: true, phase: stage.name });
      }
    });
  });

  matches.sort((a, b) => {
    if (!a.kickoff) return 1;
    if (!b.kickoff) return -1;
    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  });

  return matches;
}
