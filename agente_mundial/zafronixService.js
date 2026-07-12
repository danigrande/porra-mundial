import axios from 'axios';
import { MATCH_KICKOFFS, FIXTURE_GROUPS } from './shared_data.js';

const ZAFRONIX_BASE = 'https://api.zafronix.com/fifa/worldcup/v1';

const ZAFRONIX_TEAM_MAP = {
  'Algeria': 'Argelia',
  'Argentina': 'Argentina',
  'Australia': 'Australia',
  'Austria': 'Austria',
  'Belgium': 'Bélgica',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  'Brazil': 'Brasil',
  'Cabo Verde': 'Cabo Verde',
  'Canada': 'Canadá',
  'Colombia': 'Colombia',
  'Congo DR': 'RD Congo',
  'Croatia': 'Croacia',
  'Curaçao': 'Curazao',
  'Czechia': 'República Checa',
  'Côte d\'Ivoire': 'Costa de Marfil',
  'Ecuador': 'Ecuador',
  'Egypt': 'Egipto',
  'England': 'Inglaterra',
  'France': 'Francia',
  'Germany': 'Alemania',
  'Ghana': 'Ghana',
  'Haiti': 'Haití',
  'IR Iran': 'Irán',
  'Iraq': 'Irak',
  'Japan': 'Japón',
  'Jordan': 'Jordania',
  'Korea Republic': 'Corea del Sur',
  'Mexico': 'México',
  'Morocco': 'Marruecos',
  'Netherlands': 'Países Bajos',
  'New Zealand': 'Nueva Zelanda',
  'Norway': 'Noruega',
  'Panama': 'Panamá',
  'Paraguay': 'Paraguay',
  'Portugal': 'Portugal',
  'Qatar': 'Catar',
  'Saudi Arabia': 'Arabia Saudita',
  'Scotland': 'Escocia',
  'Senegal': 'Senegal',
  'South Africa': 'Sudáfrica',
  'Spain': 'España',
  'Sweden': 'Suecia',
  'Switzerland': 'Suiza',
  'Tunisia': 'Túnez',
  'Türkiye': 'Turquía',
  'USA': 'Estados Unidos',
  'Uruguay': 'Uruguay',
  'Uzbekistan': 'Uzbekistán',
};

export async function fetchZafronixMatches(apiKey) {
  const response = await axios.get(`${ZAFRONIX_BASE}/matches?year=2026`, {
    headers: { 'X-API-Key': apiKey },
    timeout: 15000,
  });
  return response.data;
}

export function syncRealityFromZafronix(zafronixData, currentReality) {
  const results = { ...currentReality };
  if (!results.events) results.events = {};

  const idMap = buildMatchIdMapping(zafronixData);
  const matches = zafronixData.data || [];

  matches.forEach(m => {
    if (m.homeScore === null || m.awayScore === null) return;

    const matchId = idMap[m.matchNo];
    if (!matchId) return;

    results[`${matchId}_h`] = String(m.homeScore);
    results[`${matchId}_a`] = String(m.awayScore);

    if (m.date) {
      results[`${matchId}_date`] = m.date;
    }

    if (m.matchNo >= 73) {
      // Overwrite ko_* with regulation goals (extraTime:false) when available
      // so scoring reflects the 90-minute result regardless of API's raw scores
      if (m.goals && Array.isArray(m.goals) && m.goals.length > 0) {
        let regH = 0, regA = 0;
        let hasETGoal = false;
        for (const g of m.goals) {
          if (!g || g.scorer == null) continue;
          if (g.extraTime) {
            hasETGoal = true;
            continue;
          }
          if (g.team === 'home') regH++;
          else if (g.team === 'away') regA++;
        }
        if (hasETGoal) {
          results[`ko_${m.matchNo}_h`] = String(regH);
          results[`ko_${m.matchNo}_a`] = String(regA);
        }
      }

      // Store extraTime flag and ET result for bracket resolution
      const hasExtraTime = m.extraTime === true;
      results[`ko_${m.matchNo}_et`] = hasExtraTime ? "true" : "false";

      if (hasExtraTime && m.goals && Array.isArray(m.goals) && m.goals.length > 0) {
        let etH = 0, etA = 0;
        for (const g of m.goals) {
          if (!g || g.scorer == null) continue;
          if (g.team === 'home') etH++;
          else if (g.team === 'away') etA++;
        }
        results[`et_${m.matchNo}_h`] = String(etH);
        results[`et_${m.matchNo}_a`] = String(etA);
      }
    }

    const shootout = m.penaltyShootout || m.penalties;
    if (shootout && m.matchNo >= 73) {
      const ph = shootout.home;
      const pa = shootout.away;
      if (ph != null && pa != null) {
        results[`pen_${m.matchNo}_h`] = String(ph);
        results[`pen_${m.matchNo}_a`] = String(pa);
      } else {
        delete results[`pen_${m.matchNo}_h`];
        delete results[`pen_${m.matchNo}_a`];
      }
    }

    results.events[matchId] = [];

    if (m.goals && Array.isArray(m.goals)) {
      m.goals.forEach(g => {
        if (!g || !g.scorer) return;
        const teamName = g.team === 'home' ? m.homeTeam : m.awayTeam;
        const spanishName = ZAFRONIX_TEAM_MAP[teamName] || teamName;
        results.events[matchId].push({
          time: { elapsed: g.minute || 0 },
          team: { name: spanishName },
          player: { name: g.scorer },
          type: 'Goal',
          detail: mapGoalType(g.type),
        });
      });
    }

    if (m.cards && Array.isArray(m.cards)) {
      m.cards.forEach(c => {
        if (!c || !c.player) return;
        const teamName = c.team === 'home' ? m.homeTeam : m.awayTeam;
        const spanishName = ZAFRONIX_TEAM_MAP[teamName] || teamName;
        results.events[matchId].push({
          time: { elapsed: c.minute || 0 },
          team: { name: spanishName },
          player: { name: c.player },
          type: 'Card',
          detail: c.color === 'red' ? 'Red Card' : 'Yellow Card',
        });
      });
    }
  });

  return results;
}

function mapGoalType(type) {
  switch (type) {
    case 'penalty': return 'Penalty';
    case 'header': return 'Header';
    case 'own_goal': return 'Own Goal';
    default: return 'Normal Goal';
  }
}

function buildMatchIdMapping(zafronixData) {
  const matches = zafronixData.data || [];
  const mapping = {};

  const internalMatchTeams = {};
  for (const g of FIXTURE_GROUPS) {
    const pairs = [
      [g.teams[0], g.teams[1]],
      [g.teams[2], g.teams[3]],
      [g.teams[3], g.teams[1]],
      [g.teams[0], g.teams[2]],
      [g.teams[3], g.teams[0]],
      [g.teams[1], g.teams[2]],
    ];
    pairs.forEach((pair, i) => {
      const id = `g${g.letter}_m${i}`;
      internalMatchTeams[id] = {
        teams: pair,
        kickoff: MATCH_KICKOFFS[id],
      };
    });
  }

  matches.forEach(m => {
    if (m.matchNo >= 73) {
      mapping[m.matchNo] = `ko_${m.matchNo}`;
      return;
    }

    if (!m.homeTeam || !m.awayTeam) return;

    const homeEs = ZAFRONIX_TEAM_MAP[m.homeTeam] || m.homeTeam;
    const awayEs = ZAFRONIX_TEAM_MAP[m.awayTeam] || m.awayTeam;
    let matched = false;

    for (const [id, info] of Object.entries(internalMatchTeams)) {
      if (!info) continue;
      if (info.kickoff !== m.kickoffUtc) continue;
      const [t1, t2] = info.teams;
      if ((t1 === homeEs && t2 === awayEs) || (t1 === awayEs && t2 === homeEs)) {
        mapping[m.matchNo] = id;
        delete internalMatchTeams[id];
        matched = true;
        break;
      }
    }

    if (!matched) {
      for (const [id, info] of Object.entries(internalMatchTeams)) {
        if (!info) continue;
        const [t1, t2] = info.teams;
        if ((t1 === homeEs && t2 === awayEs) || (t1 === awayEs && t2 === homeEs)) {
          mapping[m.matchNo] = id;
          delete internalMatchTeams[id];
          break;
        }
      }
    }
  });

  return mapping;
}
