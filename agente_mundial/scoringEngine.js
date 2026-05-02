// ============================================
// SCORING ENGINE — Motor de Puntuación
// ============================================
// Calcula la puntuación de cada jugador comparando
// sus predicciones con los resultados reales.

import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET } from './shared_data.js';

/**
 * Calcula las clasificaciones de un grupo.
 */
export function getStandings(letter, dataSource) {
  const groupData = FIXTURE_GROUPS.find(g => g.letter === letter);
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
export function fullResolve(code, dataSource) {
  if (!code || !dataSource) return code;

  // Grupo: "1A" → 1º del grupo A
  const groupMatch = code.match(/^([1-2])([A-L])$/);
  if (groupMatch) {
    return getStandings(groupMatch[2], dataSource)[parseInt(groupMatch[1]) - 1]?.name || code;
  }

  // Mejores terceros: simplificado
  if (code.startsWith('3')) return code;

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

    let winner, loser;
    if (gh > ga) {
      winner = fullResolve(pairing[0], dataSource);
      loser = fullResolve(pairing[1], dataSource);
    } else if (ga > gh) {
      winner = fullResolve(pairing[1], dataSource);
      loser = fullResolve(pairing[0], dataSource);
    } else {
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
export function resolveMatchName(prefix) {
  if (prefix.startsWith('g')) {
    const groupMatch = prefix.match(/^g([A-L])_m(\d+)$/);
    if (groupMatch) {
      const letter = groupMatch[1];
      const mIdx = parseInt(groupMatch[2]);
      const group = FIXTURE_GROUPS.find(g => g.letter === letter);
      if (group) {
        const t = group.teams;
        const pairings = [[t[0], t[1]], [t[2], t[3]], [t[3], t[1]], [t[0], t[2]], [t[3], t[0]], [t[1], t[2]]];
        const pair = pairings[mIdx];
        return pair ? `${pair[0]} vs ${pair[1]}` : `Grupo ${letter} #${mIdx + 1}`;
      }
    }
  } else if (prefix.startsWith('ko_')) {
    const num = parseInt(prefix.substring(3));
    let roundName = '';
    KNOCKOUT_BRACKET.forEach(r => { if (r.matches.includes(num)) roundName = r.name; });
    return `${roundName} (#${num})`;
  }
  return prefix;
}

/**
 * Calcula la puntuación de un jugador.
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


  const ptsRules = {
    group: { sign: getRule('pts_group_sign', 10), diff: getRule('pts_group_diff', 10), exact: getRule('pts_group_exact', 10) },
    ko: { sign: getRule('pts_ko_sign', 10), diff: getRule('pts_ko_diff', 10), exact: getRule('pts_ko_exact', 10) },
    honor: {
      champ: getRule('pts_honor_champ', 50), runner: getRule('pts_honor_runner', 30), third: getRule('pts_honor_third', 20),
      gold: getRule('pts_award_gold', 25), silver: getRule('pts_award_silver', 15), bronze: getRule('pts_award_bronze', 10),
    },
  };

  function evaluateMatch(hKey, aKey, isGroup) {
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
        const desvio = rSign === 'X' ? Math.abs(rH - pH) : Math.abs((rH - rA) - (pH - pA));
        let diffPoints = (desvio === 0) ? pRules.diff : 0;
        if (diffPoints > 0) {
          mPts += diffPoints;
          reasons.push(`Diferencia (+${Math.round(diffPoints)})`);
        }
      }
    }
    return { mPts: Math.round(mPts), reasons };
  }

  Object.keys(reality).forEach(key => {
    if (key.endsWith('_h') && !key.startsWith('pen_')) {
      const prefix = key.substring(0, key.length - 2);
      const isGroup = prefix.startsWith('g');
      const result = evaluateMatch(prefix + '_h', prefix + '_a', isGroup);
      if (result.mPts > 0) {
        history.push({ match: resolveMatchName(prefix), pts: result.mPts, reason: result.reasons.join(', ') });
        totalPts += result.mPts;
        if (isGroup) groupPts += result.mPts; else koPts += result.mPts;
      }
    }
  });

  const checkHonor = (actual, predicted, pts, label) => {
    if (actual && predicted && actual === predicted) {
      honorPts += pts; totalPts += pts;
      history.push({ match: `Honor: ${label}`, pts, reason: 'Acierto' });
    }
  };

  checkHonor(fullResolve('W104', reality), fullResolve('W104', prediction), ptsRules.honor.champ, 'Campeón');
  checkHonor(fullResolve('L104', reality), fullResolve('L104', prediction), ptsRules.honor.runner, 'Subcampeón');
  checkHonor(fullResolve('W103', reality), fullResolve('W103', prediction), ptsRules.honor.third, '3er Puesto');

  ['boot', 'ball'].forEach(cat => ['gold', 'silver', 'bronze'].forEach(rank => {
    const key = `${cat}_${rank}`;
    checkHonor(reality[key], prediction[key], ptsRules.honor[rank], (cat === 'boot' ? 'Bota' : 'Balón') + ' ' + rank);
  }));

  return { totalPts: Math.round(totalPts), exactHits, groupPts: Math.round(groupPts), koPts: Math.round(koPts), honorPts: Math.round(honorPts), history };
}

export function calculateLeaderboard(allPredictions, reality, rules = {}) {
  const results = Object.entries(allPredictions).map(([name, data]) => {
    const preds = typeof data.predictions === 'string' ? JSON.parse(data.predictions) : data.predictions;
    return { name, ...calculateScore(preds, reality, rules) };
  });
  return results.sort((a, b) => b.totalPts - a.totalPts).map((r, i) => ({ ...r, position: i + 1 }));
}
