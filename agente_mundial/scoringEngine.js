// ============================================
// SCORING ENGINE — Motor de Puntuación
// ============================================
// Calcula la puntuación de cada jugador comparando
// sus predicciones con los resultados reales.

import { FIXTURE_GROUPS, BRACKET_MATCHES, KNOCKOUT_BRACKET, MATCH_KICKOFFS } from './shared_data.js';

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
      return getStandings(letter, dataSource)[2]?.name || code;
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
      const eth = parseInt(dataSource[`et_${num}_h`]);
      const eta = parseInt(dataSource[`et_${num}_a`]);
      if (!isNaN(eth) && !isNaN(eta) && eth !== eta) {
        if (eth > eta) {
          winner = fullResolve(pairing[0], dataSource);
          loser = fullResolve(pairing[1], dataSource);
        } else {
          winner = fullResolve(pairing[1], dataSource);
          loser = fullResolve(pairing[0], dataSource);
        }
      } else {
        const ph = parseInt(dataSource[`pen_${num}_h`]);
        const pa = parseInt(dataSource[`pen_${num}_a`]);
        if (isNaN(ph) || isNaN(pa)) return code;
        if (ph > pa) {
          winner = fullResolve(pairing[0], dataSource);
          loser = fullResolve(pairing[1], dataSource);
        } else {
          winner = fullResolve(pairing[1], dataSource);
          loser = fullResolve(pairing[0], dataSource);
        }
      }
    }
    return type === 'W' ? winner : loser;
  }

  return code;
}

/**
 * Resuelve un código de bracket para clasificación usando predicción
 * para determinar ganadores/perdedores pero REALIDAD para nombres de equipos.
 * Esto evita que un error en predicción de posiciones de grupo arrastre
 * incorrectamente los puntos de clasificación en rondas KO.
 */
export function resolveQualification(code, prediction, reality) {
  if (!code || !prediction || !reality) return code;

  const groupMatch = code.match(/^([1-3])([A-L])$/);
  if (groupMatch) return fullResolve(code, reality);

  const matchRef = code.match(/^([WL])(\d+)$/);
  if (matchRef) {
    const type = matchRef[1];
    const num = matchRef[2];
    const ph = parseInt(prediction[`ko_${num}_h`]);
    const pa = parseInt(prediction[`ko_${num}_a`]);

    if (isNaN(ph) || isNaN(pa)) return code;

    const pairing = BRACKET_MATCHES[num];
    if (!pairing) return code;

    let winnerSlot, loserSlot;
    if (ph > pa) {
      winnerSlot = pairing[0];
      loserSlot = pairing[1];
    } else if (pa > ph) {
      winnerSlot = pairing[1];
      loserSlot = pairing[0];
    } else {
      const petH = parseInt(prediction[`et_${num}_h`]);
      const petA = parseInt(prediction[`et_${num}_a`]);
      if (!isNaN(petH) && !isNaN(petA) && petH !== petA) {
        if (petH > petA) {
          winnerSlot = pairing[0];
          loserSlot = pairing[1];
        } else {
          winnerSlot = pairing[1];
          loserSlot = pairing[0];
        }
      } else {
        const pph = parseInt(prediction[`pen_${num}_h`]);
        const ppa = parseInt(prediction[`pen_${num}_a`]);
        if (isNaN(pph) || isNaN(ppa)) return code;
        if (pph > ppa) {
          winnerSlot = pairing[0];
          loserSlot = pairing[1];
        } else {
          winnerSlot = pairing[1];
          loserSlot = pairing[0];
        }
      }
    }

    const targetSlot = type === 'W' ? winnerSlot : loserSlot;
    return resolveQualification(targetSlot, prediction, reality);
  }

  return code;
}

/**
 * Resuelve un código de bracket para clasificación usando predicción
 * para determinar ganadores/perdedores, pero nombres de equipos desde REALIDAD.
 * Usado en Mode B donde el formulario muestra equipos reales.
 */
export function resolveQualificationModeB(code, prediction, reality) {
  if (!code || !prediction || !reality) return code;

  const groupMatch = code.match(/^([1-3])([A-L])$/);
  if (groupMatch) return fullResolve(code, reality);

  const matchRef = code.match(/^([WL])(\d+)$/);
  if (matchRef) {
    const type = matchRef[1];
    const num = matchRef[2];
    const ph = parseInt(prediction[`ko_${num}_h`]);
    const pa = parseInt(prediction[`ko_${num}_a`]);

    if (isNaN(ph) || isNaN(pa)) return code;

    const pairing = BRACKET_MATCHES[num];
    if (!pairing) return code;

    let winnerSlot, loserSlot;
    if (ph > pa) {
      winnerSlot = pairing[0];
      loserSlot = pairing[1];
    } else if (pa > ph) {
      winnerSlot = pairing[1];
      loserSlot = pairing[0];
    } else {
      const petH = parseInt(prediction[`et_${num}_h`]);
      const petA = parseInt(prediction[`et_${num}_a`]);
      if (!isNaN(petH) && !isNaN(petA) && petH !== petA) {
        if (petH > petA) {
          winnerSlot = pairing[0];
          loserSlot = pairing[1];
        } else {
          winnerSlot = pairing[1];
          loserSlot = pairing[0];
        }
      } else {
        const pph = parseInt(prediction[`pen_${num}_h`]);
        const ppa = parseInt(prediction[`pen_${num}_a`]);
        if (isNaN(pph) || isNaN(ppa)) return code;
        if (pph > ppa) {
          winnerSlot = pairing[0];
          loserSlot = pairing[1];
        } else {
          winnerSlot = pairing[1];
          loserSlot = pairing[0];
        }
      }
    }

    const targetSlot = type === 'W' ? winnerSlot : loserSlot;
    // KEY DIFFERENCE: resolve from REALITY, not from prediction chain
    return fullResolve(targetSlot, reality);
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
export function resolveMatchName(prefix, data) {
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
    if (data && BRACKET_MATCHES[num]) {
      const hTeam = fullResolve(BRACKET_MATCHES[num][0], data);
      const aTeam = fullResolve(BRACKET_MATCHES[num][1], data);
      if (isRealTeam(hTeam) && isRealTeam(aTeam)) {
        return `${roundName}: ${hTeam} vs ${aTeam}`;
      }
      if (isRealTeam(hTeam) || isRealTeam(aTeam)) {
        return `${roundName}: ${isRealTeam(hTeam) ? hTeam : '?'} vs ${isRealTeam(aTeam) ? aTeam : '?'}`;
      }
    }
    return `${roundName} (#${num})`;
  }
  return prefix;
}

/**
 * Calcula la puntuación de un jugador.
 */
export function calculateScore(prediction, reality, rules = {}, predictionMode = 'A') {
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
        const desvio = Math.abs((rH - rA) - (pH - pA));
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
        history.push({ match: resolveMatchName(prefix, reality), pts: result.mPts, reason: result.reasons.join(', '), date: MATCH_KICKOFFS[prefix] });
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
            history.push({ match: `Posición ${index + 1}º Grupo ${group.letter}`, pts, reason: `Acierto (${team.name})`, date: MATCH_KICKOFFS[`g${group.letter}_m5`] });
          }
          const qualifyPts = ptsRules.group.qualify;
          if (qualifyPts > 0) {
            totalPts += qualifyPts;
            groupPts += qualifyPts;
            history.push({ match: team.name, pts: qualifyPts, reason: `Clasificado a KO (${index + 1}º Grupo ${group.letter})`, date: MATCH_KICKOFFS[`g${group.letter}_m5`] });
          }
        }
      });
    }
  });

  // --- 3. EQUIPOS CLASIFICADOS (KO) — solo rondas KO reales ---
  Object.keys(BRACKET_MATCHES).forEach(matchNum => {
    const n = parseInt(matchNum);
    if (n < 89) return; // 1/16 ya pagado con puntos de grupo
    
    // Eliminado: if (reality[`ko_${n}_h`] === undefined) return; 
    // Los puntos de clasificación deben otorgarse en cuanto se conocen los equipos,
    // no cuando se juega el partido de la ronda a la que clasificaron.

    const qualifyPts = ptsRules.ko.qualify;
    
    if (qualifyPts > 0) {
      const realH = fullResolve(BRACKET_MATCHES[matchNum][0], reality);
      const realA = fullResolve(BRACKET_MATCHES[matchNum][1], reality);
      
      const realTeams = [realH, realA];
      const qualFn = predictionMode === 'B' ? resolveQualificationModeB : resolveQualification;
      const predTeams = BRACKET_MATCHES[matchNum].map(code =>
        /^([WL])/.test(code)
          ? qualFn(code, prediction, reality)
          : fullResolve(code, prediction)
      );
      
      realTeams.forEach((realTeam, index) => {
        // SOLO si el equipo real ya está definido (es un país, no un código)
        if (isRealTeam(realTeam) && predTeams.includes(realTeam)) {
          const slot = BRACKET_MATCHES[matchNum][index];
          const slotMatch = slot.match(/^([WL])(\d+)$/);
          const sourceNum = slotMatch ? parseInt(slotMatch[2], 10) : parseInt(matchNum, 10);
          totalPts += qualifyPts;
          koPts += qualifyPts;
          history.push({ match: realTeam, pts: qualifyPts, reason: `Clasificado (${resolveMatchName('ko_' + sourceNum, reality)})`, date: MATCH_KICKOFFS['ko_' + sourceNum] });
        }
      });
    }
  });

  // --- 4. CUADRO DE HONOR ---
  const checkHonor = (actual, predicted, pts, label, date) => {
    if (actual && predicted && actual === predicted && isRealTeam(actual)) {
      honorPts += pts; totalPts += pts;
      history.push({ match: `Honor: ${label}`, pts, reason: 'Acierto', date });
    }
  };

  const honorQualFn = predictionMode === 'B' ? resolveQualificationModeB : resolveQualification;
  checkHonor(fullResolve('W104', reality), honorQualFn('W104', prediction, reality), ptsRules.honor.champ, 'Campeón', MATCH_KICKOFFS['ko_104']);
  checkHonor(fullResolve('L104', reality), honorQualFn('L104', prediction, reality), ptsRules.honor.runner, 'Subcampeón', MATCH_KICKOFFS['ko_104']);
  checkHonor(fullResolve('W103', reality), honorQualFn('W103', prediction, reality), ptsRules.honor.third, '3er Puesto', MATCH_KICKOFFS['ko_103']);

  ['boot', 'ball'].forEach(cat => ['gold', 'silver', 'bronze'].forEach(rank => {
    const key = `${cat}_${rank}`;
    if (isRealTeam(reality[key])) {
      checkHonor(reality[key], prediction[key], ptsRules.honor[rank], (cat === 'boot' ? 'Bota' : 'Balón') + ' ' + rank);
    }
  }));

  history.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  return { totalPts: Math.round(totalPts), exactHits, groupPts: Math.round(groupPts), koPts: Math.round(koPts), honorPts: Math.round(honorPts), history };
}

export function calculateLeaderboard(allPredictions, reality, rules = {}, predictionMode = 'A') {
  const results = Object.entries(allPredictions).map(([name, data]) => {
    const preds = typeof data.predictions === 'string' ? JSON.parse(data.predictions) : data.predictions;
    return { name, ...calculateScore(preds, reality, rules, predictionMode) };
  });
  return results.sort((a, b) => b.totalPts - a.totalPts).map((r, i) => ({ ...r, position: i + 1 }));
}
