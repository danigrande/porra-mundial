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

  // Mejores terceros
  if (code.startsWith('3')) {
    let allFinished = true;
    for (const g of FIXTURE_GROUPS) {
      for (let i = 0; i < 6; i++) {
        if (isNaN(parseInt(dataSource[`g${g.letter}_m${i}_h`]))) {
          allFinished = false;
          break;
        }
      }
    }
    if (!allFinished) return code;

    const thirds: { letter: string; team: any }[] = [];
    FIXTURE_GROUPS.forEach(g => {
      const st = getGroupStandings(g.letter, dataSource);
      if (st[2]) thirds.push({ letter: g.letter, team: st[2] });
    });

    thirds.sort((a, b) => (b.team.pts - a.team.pts) || (b.team.gd - a.team.gd) || (b.team.gf - a.team.gf));
    const best8 = thirds.slice(0, 8);

    if (!dataSource._thirdsMapping) {
      dataSource._thirdsMapping = {};
      const slots = ['3ABCDF', '3CDFGH', '3CEFHI', '3EHIJK', '3AEHIJ', '3BEFIJ', '3EFGIJ', '3DEIJL'];
      slots.forEach(slot => {
        const letters = slot.substring(1).split('');
        const match = best8.find(t => !t.used && letters.includes(t.letter));
        if (match) {
          match.used = true;
          dataSource._thirdsMapping[slot] = match.team.name;
        } else {
          const fallback = best8.find(t => !t.used);
          if (fallback) {
            fallback.used = true;
            dataSource._thirdsMapping[slot] = fallback.team.name;
          }
        }
      });
    }

    return dataSource._thirdsMapping[code] || code;
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
