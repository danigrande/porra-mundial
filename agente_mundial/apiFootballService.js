// ============================================
// API FOOTBALL SERVICE — Simulación y Fetching
// ============================================

import axios from 'axios';

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
 * @returns {Object} Objeto con resultado y eventos
 */
export function simulateMatchEvents(matchId, homeTeam, awayTeam) {
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
        events
    };
}
