// ============================================
// API FOOTBALL SERVICE — Simulación y Fetching
// ============================================

import axios from 'axios';
import { fullResolve } from './scoringEngine.js';

// Función para obtener la URL base de API-Football (v3)
const API_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

// Nombres falsos para simular goleadores y tarjetas
const mockPlayers = [
    "Juan", "Carlos", "Luis", "Pedro", "Diego", 
    "Andrés", "Miguel", "Alex", "David", "José",
    "John", "Mike", "Steve", "James", "Robert"
];

const getRandomPlayer = () => mockPlayers[Math.floor(Math.random() * mockPlayers.length)] + " " + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + ".";

/**
 * Función real que se usaría para traer datos (NO USADA HASTA QUE EMPIECE EL MUNDIAL)
 */
export async function fetchWorldCupFixtures() {
    try {
        const response = await axios.get(`${API_URL}/fixtures?league=1&season=2026`, {
            headers: {
                'x-apisports-key': API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching real API-football data:", error);
        throw error;
    }
}

/**
 * Simula el resultado y los eventos de un partido específico
 * @param {string} matchId El ID interno del partido (ej. gA_m0)
 * @param {string} homeTeam Nombre del equipo local
 * @param {string} awayTeam Nombre del equipo visitante
 * @param {string} date Fecha del partido (ISO string)
 * @returns {Object} Objeto con resultado y eventos
 */
export function simulateMatchEvents(matchId, homeTeam, awayTeam, date = null) {
    if (!date) {
        // Por defecto, hoy a las 18:00
        const d = new Date();
        d.setHours(18, 0, 0, 0);
        date = d.toISOString();
    }
    const isKnockout = matchId.startsWith('ko_');
    const homeGoals = Math.floor(Math.random() * 5);
    let awayGoals = Math.floor(Math.random() * 5);
    
    // Si es eliminatoria y empatan, desempatamos en penalties (simulado)
    let homePen = null;
    let awayPen = null;

    if (isKnockout && homeGoals === awayGoals) {
        homePen = Math.floor(Math.random() * 5) + 1;
        awayPen = Math.floor(Math.random() * 5) + 1;
        if (homePen === awayPen) homePen++; // Asegurar ganador
    }

    const events = [];

    // Generar eventos de gol para local
    for (let i = 0; i < homeGoals; i++) {
        events.push({
            time: { elapsed: Math.floor(Math.random() * 90) + 1 },
            team: { name: homeTeam },
            player: { name: getRandomPlayer() },
            type: "Goal",
            detail: "Normal Goal"
        });
    }

    // Generar eventos de gol para visitante
    for (let i = 0; i < awayGoals; i++) {
        events.push({
            time: { elapsed: Math.floor(Math.random() * 90) + 1 },
            team: { name: awayTeam },
            player: { name: getRandomPlayer() },
            type: "Goal",
            detail: "Normal Goal"
        });
    }

    // Generar tarjetas aleatorias
    const numCards = Math.floor(Math.random() * 4); // 0 a 3 tarjetas
    for (let i = 0; i < numCards; i++) {
        const isHome = Math.random() > 0.5;
        const isRed = Math.random() > 0.8;
        events.push({
            time: { elapsed: Math.floor(Math.random() * 90) + 1 },
            team: { name: isHome ? homeTeam : awayTeam },
            player: { name: getRandomPlayer() },
            type: "Card",
            detail: isRed ? "Red Card" : "Yellow Card"
        });
    }

    // Ordenar eventos por minuto
    events.sort((a, b) => a.time.elapsed - b.time.elapsed);

    return {
        homeTeam,
        awayTeam,
        goals: {
            home: homeGoals,
            away: awayGoals
        },
        penalties: (homePen !== null) ? { home: homePen, away: awayPen } : null,
        events,
        date
    };
}

/**
 * Simula resultados solo para una fase específica
 */
export function simulatePhaseResults(phaseId, currentReality, groups, bracket, matchesData) {
    const results = { ...currentReality };
    if (!results.events) results.events = {};

    if (phaseId === 'groups') {
        groups.forEach(g => {
            for (let mIdx = 0; mIdx < 6; mIdx++) {
                const matchId = `g${g.letter}_m${mIdx}`;
                const hName = g.teams[mIdx % 4];
                const aName = g.teams[(mIdx + 1) % 4];
                const sim = simulateMatchEvents(matchId, hName, aName);
                results[`${matchId}_h`] = sim.goals.home.toString();
                results[`${matchId}_a`] = sim.goals.away.toString();
                results.events[matchId] = sim.events;
            }
        });
    } else {
        // Encontrar qué partidos pertenecen a esta fase (r32, r16, qf, sf, 3rd, final)
        const round = matchesData.find(r => r.id === phaseId);
        if (round) {
            round.matches.forEach(matchNum => {
                const matchId = `ko_${matchNum}`;
                const pairing = bracket[matchNum];
                const resolvedH = pairing ? fullResolve(pairing[0], results) : "TBD";
                const resolvedA = pairing ? fullResolve(pairing[1], results) : "TBD";
                const sim = simulateMatchEvents(matchId, resolvedH, resolvedA);
                results[`${matchId}_h`] = sim.goals.home.toString();
                results[`${matchId}_a`] = sim.goals.away.toString();
                results[`${matchId}_h_team`] = resolvedH;
                results[`${matchId}_a_team`] = resolvedA;
                if (sim.penalties) {
                    results[`pen_${matchNum}_h`] = sim.penalties.home.toString();
                    results[`pen_${matchNum}_a`] = sim.penalties.away.toString();
                }
                results.events[matchId] = sim.events;
            });
        }
    }

    return results;
}

/**
 * Traduce la respuesta de API-Football a nuestro formato Reality
 */
export function syncRealityFromApi(apiResponse, currentReality, groups, bracket) {
    const results = { ...currentReality };
    if (!results.events) results.events = {};

    const fixtures = apiResponse.response || [];

    fixtures.forEach(item => {
        const f = item.fixture;
        const teams = item.teams;
        const goals = item.goals;
        const score = item.score;
        const events = item.events || [];

        // 1. Identificar el partido en nuestro sistema
        const matchId = findMatchIdByTeams(teams.home.name, teams.away.name, groups, bracket, currentReality);
        
        if (matchId) {
            console.log(`🔗 Mapeando partido API: ${teams.home.name} vs ${teams.away.name} -> ID: ${matchId}`);
            
            results[`${matchId}_h`] = (goals.home ?? 0).toString();
            results[`${matchId}_a`] = (goals.away ?? 0).toString();
            results[`${matchId}_date`] = f.date;

            // Penaltis
            if (score && score.penalty && score.penalty.home !== null) {
                const matchNum = matchId.replace('ko_', '');
                results[`pen_${matchNum}_h`] = score.penalty.home.toString();
                results[`pen_${matchNum}_a`] = score.penalty.away.toString();
            }

            // Eventos
            results.events[matchId] = events.map(e => ({
                time: { elapsed: e.time.elapsed, extra: e.time.extra },
                team: { name: e.team.name },
                player: { name: e.player?.name || "Jugador" },
                type: e.type,
                detail: e.detail
            }));
        }
    });

    return results;
}

/**
 * Función auxiliar para encontrar nuestro ID de partido basado en nombres de equipos
 */
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

    // KO: resolver bracket con resultados actuales y buscar coincidencia
    for (const [matchNum, pairing] of Object.entries(bracket)) {
        const resolvedH = fullResolve(pairing[0], currentReality);
        const resolvedA = fullResolve(pairing[1], currentReality);
        if (resolvedH === hName && resolvedA === aName) return `ko_${matchNum}`;
        if (resolvedH === aName && resolvedA === hName) return `ko_${matchNum}`;
    }

    return null;
}

export function simulateAllMatches(groups, bracket) {
    const results = { events: {} };

    // 1. Grupos
    // Vamos a repartir los partidos en varios días. 
    // Empezamos ayer, hoy y mañana para que haya datos para el test del cron.
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 2); // Empezar hace 2 días

    let matchCount = 0;
    groups.forEach(g => {
        for (let mIdx = 0; mIdx < 6; mIdx++) {
            const matchId = `g${g.letter}_m${mIdx}`;
            const hName = g.teams[mIdx % 4];
            const aName = g.teams[(mIdx + 1) % 4];
            
            // Avanzar un día cada 12 partidos
            const matchDate = new Date(baseDate);
            matchDate.setDate(baseDate.getDate() + Math.floor(matchCount / 12));
            matchDate.setHours(12 + (matchCount % 12), 0, 0, 0);

            const sim = simulateMatchEvents(matchId, hName, aName, matchDate.toISOString());
            
            results[`${matchId}_h`] = sim.goals.home.toString();
            results[`${matchId}_a`] = sim.goals.away.toString();
            results[`${matchId}_date`] = sim.date;
            results.events[matchId] = sim.events;
            matchCount++;
        }
    });

    // 2. Knockout
    Object.keys(bracket).forEach((matchNum, idx) => {
        const matchId = `ko_${matchNum}`;
        const matchDate = new Date(baseDate);
        matchDate.setDate(baseDate.getDate() + 10 + Math.floor(idx / 4)); // Después de grupos

        const pairing = bracket[matchNum];
        const resolvedH = fullResolve(pairing[0], results);
        const resolvedA = fullResolve(pairing[1], results);
        const sim = simulateMatchEvents(matchId, resolvedH, resolvedA, matchDate.toISOString());
        results[`${matchId}_h`] = sim.goals.home.toString();
        results[`${matchId}_a`] = sim.goals.away.toString();
        results[`${matchId}_h_team`] = resolvedH;
        results[`${matchId}_a_team`] = resolvedA;
        results[`${matchId}_date`] = sim.date;
        if (sim.penalties) {
            results[`pen_${matchNum}_h`] = sim.penalties.home.toString();
            results[`pen_${matchNum}_a`] = sim.penalties.away.toString();
        }
        results.events[matchId] = sim.events;
    });

    return results;
}

/**
 * Regenera eventos (goles/tarjetas) para todos los partidos con resultado,
 * preservando los marcadores exactos pero actualizando los nombres de equipo,
 * minutos y jugadores.
 */
export function regenerateEvents(results, groups, bracket) {
    const updated = { ...results };
    if (!updated.events) updated.events = {};

    const matchIds = new Set();
    for (const key of Object.keys(updated)) {
        if (/^g[A-L]_m\d_h$/.test(key) || /^ko_\d+_h$/.test(key)) {
            matchIds.add(key.replace(/_h$/, ''));
        }
    }

    const pairings = [[0,1],[2,3],[3,1],[0,2],[3,0],[1,2]];

    for (const matchId of matchIds) {
        const hScore = parseInt(updated[`${matchId}_h`]);
        const aScore = parseInt(updated[`${matchId}_a`]);
        if (isNaN(hScore) || isNaN(aScore)) continue;

        let hName, aName;
        if (matchId.startsWith('ko_')) {
            const matchNum = matchId.replace('ko_', '');
            const pairing = bracket[matchNum];
            if (pairing) {
                hName = fullResolve(pairing[0], updated);
                aName = fullResolve(pairing[1], updated);
            } else {
                hName = updated[`${matchId}_h_team`] || "Local";
                aName = updated[`${matchId}_a_team`] || "Visitante";
            }
        } else {
            const m = matchId.match(/^g([A-L])_m(\d)$/);
            if (m) {
                const g = groups.find(g => g.letter === m[1]);
                if (g) {
                    const p = pairings[parseInt(m[2])];
                    hName = g.teams[p[0]];
                    aName = g.teams[p[1]];
                }
            }
        }
        if (!hName || !aName) continue;

        const events = [];
        for (let i = 0; i < hScore; i++) {
            events.push({
                time: { elapsed: Math.floor(Math.random() * 90) + 1 },
                team: { name: hName },
                player: { name: getRandomPlayer() },
                type: "Goal",
                detail: "Normal Goal"
            });
        }
        for (let i = 0; i < aScore; i++) {
            events.push({
                time: { elapsed: Math.floor(Math.random() * 90) + 1 },
                team: { name: aName },
                player: { name: getRandomPlayer() },
                type: "Goal",
                detail: "Normal Goal"
            });
        }
        const numCards = Math.floor(Math.random() * 4);
        for (let i = 0; i < numCards; i++) {
            const isHome = Math.random() > 0.5;
            const isRed = Math.random() > 0.8;
            events.push({
                time: { elapsed: Math.floor(Math.random() * 90) + 1 },
                team: { name: isHome ? hName : aName },
                player: { name: getRandomPlayer() },
                type: "Card",
                detail: isRed ? "Red Card" : "Yellow Card"
            });
        }
        events.sort((a, b) => a.time.elapsed - b.time.elapsed);
        updated.events[matchId] = events;
    }

    return updated;
}
