import axios from 'axios';
import { fullResolve } from './scoringEngine.js';

const OPENFOOTBALL_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

export async function fetchWorldCupJson() {
    const response = await axios.get(OPENFOOTBALL_URL, { timeout: 15000 });
    return response.data;
}

export function syncRealityFromOpenfootball(openfootballData, currentReality, groups, bracket, teamNameMap = {}) {
    const results = { ...currentReality };
    if (!results.events) results.events = {};

    const matches = openfootballData.matches || [];

    matches.forEach(m => {
        if (!m.score) return;

        const homeName = teamNameMap[m.team1] || m.team1;
        const awayName = teamNameMap[m.team2] || m.team2;

        let matchId = null;
        const isGroup = m.group && m.group.startsWith('Group');

        if (isGroup) {
            matchId = findMatchIdByTeams(homeName, awayName, groups, bracket, results);
        } else if (m.num) {
            matchId = `ko_${m.num}`;
        }

        if (!matchId) return;

        const score = m.score;

        if (score.ft) {
            results[`${matchId}_h`] = String(score.ft[0]);
            results[`${matchId}_a`] = String(score.ft[1]);
        }

        if (m.date) {
            results[`${matchId}_date`] = m.date;
        }

        if (score.p) {
            const matchNum = matchId.replace('ko_', '');
            results[`pen_${matchNum}_h`] = String(score.p[0]);
            results[`pen_${matchNum}_a`] = String(score.p[1]);
        }

        if (!results.events[matchId]) results.events[matchId] = [];

        if (m.goals1 && Array.isArray(m.goals1)) {
            m.goals1.forEach(g => {
                if (g && g.name) {
                    results.events[matchId].push({
                        time: { elapsed: g.minute || 0 },
                        team: { name: homeName },
                        player: { name: g.name },
                        type: "Goal",
                        detail: g.penalty ? "Penalty" : "Normal Goal"
                    });
                }
            });
        }

        if (m.goals2 && Array.isArray(m.goals2)) {
            m.goals2.forEach(g => {
                if (g && g.name) {
                    results.events[matchId].push({
                        time: { elapsed: g.minute || 0 },
                        team: { name: awayName },
                        player: { name: g.name },
                        type: "Goal",
                        detail: g.penalty ? "Penalty" : "Normal Goal"
                    });
                }
            });
        }
    });

    return results;
}

function findMatchIdByTeams(hName, aName, groups, bracket, currentReality = {}) {
    for (const g of groups) {
        if (g.teams.includes(hName) && g.teams.includes(aName)) {
            const pairs = [
                [g.teams[0], g.teams[1]],
                [g.teams[2], g.teams[3]],
                [g.teams[0], g.teams[2]],
                [g.teams[1], g.teams[3]],
                [g.teams[0], g.teams[3]],
                [g.teams[1], g.teams[2]]
            ];
            for (let i = 0; i < 6; i++) {
                if ((pairs[i][0] === hName && pairs[i][1] === aName) ||
                    (pairs[i][0] === aName && pairs[i][1] === hName)) {
                    return `g${g.letter}_m${i}`;
                }
            }
        }
    }

    for (const [matchNum, pairing] of Object.entries(bracket)) {
        const resolvedH = fullResolve(pairing[0], currentReality);
        const resolvedA = fullResolve(pairing[1], currentReality);
        if (resolvedH === hName && resolvedA === aName) return `ko_${matchNum}`;
        if (resolvedH === aName && resolvedA === hName) return `ko_${matchNum}`;
    }

    return null;
}
