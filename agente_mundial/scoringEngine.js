// ============================================
// SCORING ENGINE — Motor de Puntuación
// ============================================
// Portado de la lógica de player_scores.html
// Calcula la puntuación de cada jugador comparando
// sus predicciones con los resultados reales.

// Metadata de grupos del Mundial 2026
const fixtureGroups = [
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

// Bracket de eliminatorias
const bracketMatches = {
  73: ['2A', '2B'], 76: ['1C', '2F'], 74: ['1E', '3ABCDF'], 75: ['1F', '2C'],
  78: ['2E', '2I'], 77: ['1I', '3CDFGH'], 79: ['1A', '3CEFHI'], 80: ['1L', '3EHIJK'],
  82: ['1G', '3AEHIJ'], 81: ['1D', '3BEFIJ'], 84: ['1H', '2J'], 83: ['2K', '2L'],
  85: ['1B', '3EFGIJ'], 88: ['2D', '2G'], 86: ['1J', '2H'], 87: ['1K', '3DEIJL'],
  90: ['W73', 'W75'], 89: ['W74', 'W77'], 91: ['W76', 'W78'], 92: ['W79', 'W80'],
  93: ['W83', 'W84'], 94: ['W81', 'W82'], 95: ['W86', 'W88'], 96: ['W85', 'W87'],
  97: ['W89', 'W90'], 98: ['W93', 'W94'], 99: ['W91', 'W92'], 100: ['W95', 'W96'],
  101: ['W97', 'W98'], 102: ['W99', 'W100'], 103: ['L101', 'L102'], 104: ['W101', 'W102'],
};

const knockoutBracket = [
  { name: '1/16 Final', matches: [73, 76, 74, 75, 78, 77, 79, 80, 82, 81, 84, 83, 85, 88, 86, 87] },
  { name: '1/8 Final', matches: [90, 89, 91, 92, 93, 94, 95, 96] },
  { name: '1/4 Final', matches: [97, 98, 99, 100] },
  { name: 'Semifinales', matches: [101, 102] },
  { name: '3er Puesto', matches: [103] },
  { name: 'FINAL', matches: [104] },
];

/**
 * Calcula las clasificaciones de un grupo.
 */
function getStandings(letter, dataSource) {
  const groupData = fixtureGroups.find(g => g.letter === letter);
  if (!groupData) return [];

  const stats = {};
  groupData.teams.forEach(t => { stats[t] = { name: t, pts: 0, gf: 0, ga: 0, dg: 0 }; });

  const pairings = [[0, 1], [2, 3], [3, 1], [0, 2], [3, 0], [1, 2]];

  for (let i = 0; i < 6; i++) {
    const hKey = `g${letter}_m${i}_h`;
    const aKey = `g${letter}_m${i}_a`;
    const gh = parseInt(dataSource[hKey]);
    const ga = parseInt(dataSource[aKey]);
    if (isNaN(gh) || isNaN(ga)) continue;

    const p = pairings[i];
    const hName = groupData.teams[p[0]];
    const aName = groupData.teams[p[1]];
    stats[hName].gf += gh; stats[hName].ga += ga;
    stats[aName].gf += ga; stats[aName].ga += gh;
    if (gh > ga) stats[hName].pts += 3;
    else if (ga > gh) stats[aName].pts += 3;
    else { stats[hName].pts += 1; stats[aName].pts += 1; }
  }

  Object.values(stats).forEach(s => { s.dg = s.gf - s.ga; });
  return Object.values(stats).sort((a, b) => (b.pts - a.pts) || (b.dg - a.dg) || (b.gf - a.gf));
}

/**
 * Resuelve un código de equipo (ej: "W104", "1A") a un nombre de equipo.
 */
function fullResolve(code, dataSource) {
  if (!code || !dataSource) return code;

  // Grupo: "1A" → 1º del grupo A
  const groupMatch = code.match(/^([1-2])([A-L])$/);
  if (groupMatch) {
    return getStandings(groupMatch[2], dataSource)[parseInt(groupMatch[1]) - 1]?.name || code;
  }

  // Mejores terceros: skip por complejidad
  if (code.startsWith('3')) return code;

  // Referencia a partido: "W95" → ganador del partido 95
  const matchRef = code.match(/^([WL])(\d+)$/);
  if (matchRef) {
    const type = matchRef[1];
    const num = matchRef[2];
    const gh = parseInt(dataSource[`ko_${num}_h`]);
    const ga = parseInt(dataSource[`ko_${num}_a`]);
    if (isNaN(gh) || isNaN(ga)) return code;

    const pairing = bracketMatches[num];
    if (!pairing) return code;

    let winner, loser;
    if (gh > ga) {
      winner = fullResolve(pairing[0], dataSource);
      loser = fullResolve(pairing[1], dataSource);
    } else if (ga > gh) {
      winner = fullResolve(pairing[1], dataSource);
      loser = fullResolve(pairing[0], dataSource);
    } else {
      // Empate → penaltis
      const ph = parseInt(dataSource[`pen_${num}_h`]);
      const pa = parseInt(dataSource[`pen_${num}_a`]);
      if (ph > pa) {
        winner = fullResolve(pairing[0], dataSource);
        loser = fullResolve(pairing[1], dataSource);
      } else {
        winner = fullResolve(pairing[1], dataSource);
        loser = fullResolve(pairing[0], dataSource);
      }
    }
    return type === 'W' ? winner : loser;
  }

  return code;
}

/**
 * Resuelve el nombre legible de un partido.
 */
function resolveMatchName(prefix) {
  if (prefix.startsWith('g')) {
    const groupMatch = prefix.match(/^g([A-L])_m(\d+)$/);
    if (groupMatch) {
      const letter = groupMatch[1];
      const mIdx = parseInt(groupMatch[2]);
      const group = fixtureGroups.find(g => g.letter === letter);
      if (group) {
        const t = group.teams;
        const pairings = [
          [t[0], t[1]], [t[2], t[3]],
          [t[3], t[1]], [t[0], t[2]],
          [t[3], t[0]], [t[1], t[2]],
        ];
        const pair = pairings[mIdx];
        return pair ? `${pair[0]} vs ${pair[1]}` : `Grupo ${letter} #${mIdx + 1}`;
      }
    }
  } else if (prefix.startsWith('ko_')) {
    const num = prefix.substring(3);
    let roundName = '';
    knockoutBracket.forEach(r => {
      if (r.matches.includes(parseInt(num))) roundName = r.name;
    });
    return `${roundName} (#${num})`;
  }
  return prefix;
}

/**
 * Calcula la puntuación de un jugador comparando predicciones vs realidad.
 * @param {Object} prediction - Las predicciones del jugador
 * @param {Object} reality - Los resultados reales
 * @param {Object} rules - Reglas de puntuación (opcionales)
 * @returns {{ totalPts, exactHits, groupPts, koPts, honorPts, history }}
 */
export function calculateScore(prediction, reality, rules = {}) {
  let totalPts = 0;
  let exactHits = 0;
  let groupPts = 0;
  let koPts = 0;
  let honorPts = 0;
  const history = [];

  if (!reality || !prediction) return { totalPts, exactHits, groupPts, koPts, honorPts, history };

  const getRule = (id, fallback) => rules[id] !== undefined ? parseFloat(rules[id]) : fallback;
  const opt_diff_adjust = getRule('opt_diff_adjust', 0) / 100;

  const ptsRules = {
    group: {
      sign: getRule('pts_group_sign', 10),
      diff: getRule('pts_group_diff', 10),
      exact: getRule('pts_group_exact', 10),
    },
    ko: {
      sign: getRule('pts_ko_sign', 10),
      diff: getRule('pts_ko_diff', 10),
      exact: getRule('pts_ko_exact', 10),
    },
    honor: {
      champ: getRule('pts_honor_champ', 50),
      runner: getRule('pts_honor_runner', 30),
      third: getRule('pts_honor_third', 20),
      gold: getRule('pts_award_gold', 25),
      silver: getRule('pts_award_silver', 15),
      bronze: getRule('pts_award_bronze', 10),
    },
  };

  function evaluateMatch(matchPrefix, hKey, aKey, isGroup) {
    const pRules = isGroup ? ptsRules.group : ptsRules.ko;
    const rH = parseInt(reality[hKey]);
    const rA = parseInt(reality[aKey]);
    const pH = parseInt(prediction[hKey]);
    const pA = parseInt(prediction[aKey]);

    if (isNaN(rH) || isNaN(rA) || isNaN(pH) || isNaN(pA)) return { mPts: 0, reasons: [] };

    let mPts = 0;
    const reasons = [];

    const rSign = rH > rA ? '1' : rH === rA ? 'X' : '2';
    const pSign = pH > pA ? '1' : pH === pA ? 'X' : '2';

    if (rSign === pSign) {
      mPts += pRules.sign;
      reasons.push(`Signo (${pRules.sign})`);

      if (rH === pH && rA === pA) {
        mPts += (pRules.exact + pRules.diff);
        reasons.push(`Exacto (+${pRules.exact + pRules.diff})`);
        exactHits++;
      } else {
        const rDiff = rH - rA;
        const pDiff = pH - pA;
        const desvio = rSign === 'X' ? Math.abs(rH - pH) : Math.abs(rDiff - pDiff);

        let diffPoints = 0;
        if (opt_diff_adjust === 0) {
          if (desvio === 0) diffPoints = pRules.diff;
        } else {
          diffPoints = pRules.diff - (desvio * opt_diff_adjust * pRules.diff);
        }
        if (diffPoints > 0) {
          mPts += diffPoints;
          reasons.push(`Diferencia (+${Math.round(diffPoints)})`);
        }
      }
    }

    return { mPts: Math.round(mPts), reasons };
  }

  // Evaluar todos los partidos
  Object.keys(reality).forEach(key => {
    if (key.endsWith('_h')) {
      const matchPrefix = key.substring(0, key.length - 2);
      const hKey = matchPrefix + '_h';
      const aKey = matchPrefix + '_a';

      if (matchPrefix.startsWith('pen_')) return;

      const isGroup = matchPrefix.startsWith('g');
      const result = evaluateMatch(matchPrefix, hKey, aKey, isGroup);
      const pts = result.mPts;

      if (pts > 0) {
        history.push({
          match: resolveMatchName(matchPrefix),
          pts,
          reason: result.reasons.join(', '),
        });
      }

      totalPts += pts;
      if (isGroup) groupPts += pts;
      else koPts += pts;
    }
  });

  // Cuadro de Honor
  const checkHonor = (actual, predicted, pts, label) => {
    if (actual && predicted && actual === predicted) {
      honorPts += pts;
      totalPts += pts;
      history.push({ match: `Honor: ${label}`, pts, reason: 'Acierto' });
    }
  };

  checkHonor(fullResolve('W104', reality), fullResolve('W104', prediction), ptsRules.honor.champ, 'Campeón');
  checkHonor(fullResolve('L104', reality), fullResolve('L104', prediction), ptsRules.honor.runner, 'Subcampeón');
  checkHonor(fullResolve('W103', reality), fullResolve('W103', prediction), ptsRules.honor.third, '3er Puesto');

  ['boot', 'ball'].forEach(cat => {
    ['gold', 'silver', 'bronze'].forEach(rank => {
      const key = `${cat}_${rank}`;
      const label = (cat === 'boot' ? 'Bota' : 'Balón') + ' ' + rank;
      checkHonor(reality[key], prediction[key], ptsRules.honor[rank], label);
    });
  });

  return {
    totalPts: Math.round(totalPts),
    exactHits,
    groupPts: Math.round(groupPts),
    koPts: Math.round(koPts),
    honorPts: Math.round(honorPts),
    history,
  };
}

/**
 * Calcula el leaderboard completo.
 * @param {Object} allPredictions - { "Dani": { predictions: {...} }, ... }
 * @param {Object} reality - Los resultados reales
 * @param {Object} rules - Reglas de puntuación
 * @returns {Array} Ranking ordenado por puntos
 */
export function calculateLeaderboard(allPredictions, reality, rules = {}) {
  const results = [];

  for (const [playerName, playerData] of Object.entries(allPredictions)) {
    const preds = typeof playerData.predictions === 'string'
      ? JSON.parse(playerData.predictions)
      : playerData.predictions;

    const score = calculateScore(preds, reality, rules);
    results.push({
      name: playerName,
      ...score,
    });
  }

  // Ordenar por puntos (mayor a menor)
  results.sort((a, b) => b.totalPts - a.totalPts);

  // Añadir posición
  results.forEach((r, idx) => { r.position = idx + 1; });

  return results;
}
