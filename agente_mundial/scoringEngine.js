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
    const letter = groupMatch[2];
    // Verificar si el grupo ha terminado
    let groupFinished = true;
    for (let i = 0; i < 6; i++) {
      if (isNaN(parseInt(dataSource[`g${letter}_m${i}_h`])) || isNaN(parseInt(dataSource[`g${letter}_m${i}_a`]))) {
        groupFinished = false;
        break;
      }
    }
    if (!groupFinished) return code; // No resolvemos si no ha terminado el grupo
    return getStandings(letter, dataSource)[parseInt(groupMatch[1]) - 1]?.name || code;
  }

  // Mejores terceros
  if (code.startsWith('3')) {
    // Verificar si todos los grupos han terminado
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

    // Obtener los 12 terceros
    const thirds = [];
    FIXTURE_GROUPS.forEach(g => {
      const st = getStandings(g.letter, dataSource);
      if (st[2]) thirds.push({ letter: g.letter, team: st[2] });
    });
    
    // Ordenar para sacar los 8 mejores (pts, dif goles, goles a favor)
    thirds.sort((a, b) => (b.team.pts - a.team.pts) || (b.team.dg - a.team.dg) || (b.team.gf - a.team.gf));
    const best8 = thirds.slice(0, 8);

    // Asignación determinista simplificada (buscamos la primera letra del slot que esté en el top 8 y no haya sido usada)
    // Nota: Guardamos el mapeo en el objeto dataSource para que la resolución sea constante por request
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
          // Fallback por si la tabla teórica no encaja
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
    
    // Solo resolvemos si el partido se ha jugado (tiene goles)
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
 * Verifica si un nombre de equipo es un equipo real (no TBD o código).
 */
export function isRealTeam(name) {
  if (!name || name === 'TBD' || name === 'Por definir') return false;
  
  // Bloquear códigos de posición (1A, 2B, 3ABC, etc)
  if (name.match(/^[1-3][A-Z]+$/)) return false;
  
  // Bloquear códigos de eliminatorias (W95, L104, etc)
  if (name.match(/^[WL]\d+$/)) return false;

  return true;
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
    group: { 
      sign: getRule('pts_group_sign', 10), 
      diff: getRule('pts_group_diff', 10), 
      exact: getRule('pts_group_exact', 10),
      pos: getRule('pts_group_pos', 5),
      qualify: getRule('pts_group_qualify', 5)
    },
    ko: { 
      sign: getRule('pts_ko_sign', 10), 
      diff: getRule('pts_ko_diff', 10), 
      exact: getRule('pts_ko_exact', 10),
      qualify: getRule('pts_ko_qualify', 10)
    },
    honor: {
      champ: getRule('pts_honor_champ', 50), runner: getRule('pts_honor_runner', 30), third: getRule('pts_honor_third', 20),
      gold: getRule('pts_award_gold', 25), silver: getRule('pts_award_silver', 15), bronze: getRule('pts_award_bronze', 10),
    },
  };

  // --- 1. EVALUACIÓN DE PARTIDOS (Puntos por resultado) ---
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

  // --- 2. POSICIONES DE GRUPO ---
  FIXTURE_GROUPS.forEach(group => {
    // Solo dar puntos si el grupo ha terminado (6 partidos jugados)
    let groupFinished = true;
    for (let i = 0; i < 6; i++) {
      if (isNaN(parseInt(reality[`g${group.letter}_m${i}_h`])) || isNaN(parseInt(reality[`g${group.letter}_m${i}_a`]))) {
        groupFinished = false;
        break;
      }
    }

    if (groupFinished) {
      const realStandings = getStandings(group.letter, reality);
      const predStandings = getStandings(group.letter, prediction);
      
      realStandings.forEach((team, index) => {
        if (predStandings[index] && predStandings[index].name === team.name && isRealTeam(team.name)) {
          const pts = ptsRules.group.pos;
          if (pts > 0) {
            totalPts += pts;
            groupPts += pts;
            history.push({ match: `Posición ${index + 1}º Grupo ${group.letter}`, pts, reason: `Acierto (${team.name})` });
          }
        }
      });
    }
  });

  // --- 3. EQUIPOS CLASIFICADOS (KO) ---
  Object.keys(BRACKET_MATCHES).forEach(matchNum => {
    const isRoundOf32 = KNOCKOUT_BRACKET[0].matches.includes(parseInt(matchNum));
    const qualifyPts = isRoundOf32 ? ptsRules.group.qualify : ptsRules.ko.qualify;
    
    if (qualifyPts > 0) {
      const realH = fullResolve(BRACKET_MATCHES[matchNum][0], reality);
      const realA = fullResolve(BRACKET_MATCHES[matchNum][1], reality);
      
      const realTeams = [realH, realA];
      const predTeams = [fullResolve(BRACKET_MATCHES[matchNum][0], prediction), fullResolve(BRACKET_MATCHES[matchNum][1], prediction)];
      
      realTeams.forEach(realTeam => {
        // SOLO si el equipo real ya está definido (es un país, no un código)
        if (isRealTeam(realTeam) && predTeams.includes(realTeam)) {
          totalPts += qualifyPts;
          koPts += qualifyPts;
          history.push({ match: `Clasificado ${resolveMatchName('ko_' + matchNum)}`, pts: qualifyPts, reason: `Acierto (${realTeam})` });
        }
      });
    }
  });

  // --- 4. CUADRO DE HONOR ---
  const checkHonor = (actual, predicted, pts, label) => {
    if (actual && predicted && actual === predicted && isRealTeam(actual)) {
      honorPts += pts; totalPts += pts;
      history.push({ match: `Honor: ${label}`, pts, reason: 'Acierto' });
    }
  };

  checkHonor(fullResolve('W104', reality), fullResolve('W104', prediction), ptsRules.honor.champ, 'Campeón');
  checkHonor(fullResolve('L104', reality), fullResolve('L104', prediction), ptsRules.honor.runner, 'Subcampeón');
  checkHonor(fullResolve('W103', reality), fullResolve('W103', prediction), ptsRules.honor.third, '3er Puesto');

  ['boot', 'ball'].forEach(cat => ['gold', 'silver', 'bronze'].forEach(rank => {
    const key = `${cat}_${rank}`;
    if (isRealTeam(reality[key])) {
      checkHonor(reality[key], prediction[key], ptsRules.honor[rank], (cat === 'boot' ? 'Bota' : 'Balón') + ' ' + rank);
    }
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
