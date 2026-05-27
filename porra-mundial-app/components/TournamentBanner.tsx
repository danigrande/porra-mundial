import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TournamentBannerProps {
  state: {
    id: string;
    name: string;
    deadline: string;
    timeRemainingMs: number;
    isPredictionWindow: boolean;
  } | null;
}

export default function TournamentBanner({ state }: TournamentBannerProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!state?.deadline) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(state.deadline).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('CERRADO');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let str = '';
      if (days > 0) str += `${days}d `;
      str += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setTimeLeft(str);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [state?.deadline]);

  if (!state) return null;

  const getPhaseIcon = (id: string) => {
    if (id.includes('GROUP')) return '⚽';
    if (id.includes('WAITING')) return '⏳';
    if (id.includes('FINALS')) return '🏆';
    return '🗓️';
  };

  const isClosed = !state.isPredictionWindow;
  const isFinished = state.id === 'POST_TOURNAMENT';

  return (
    <View style={styles.banner}>
      <View style={styles.leftBorder} />
      <View style={styles.container}>
        <View style={styles.phaseInfo}>
          <Text style={styles.phaseIcon}>{getPhaseIcon(state.id)}</Text>
          <View>
            <Text style={styles.phaseName}>{state.name}</Text>
            <Text style={styles.phaseStatus}>
              {state.isPredictionWindow ? '🟠 Ventana Abierta' : '🔵 Fase en Juego'}
            </Text>
          </View>
        </View>

        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>
            {isFinished ? 'ESTADO:' : isClosed ? 'PRÓXIMA VENTANA EN:' : 'CIERRE EN:'}
          </Text>
          <Text style={[styles.timerText, isFinished && { color: '#8b949e' }]}>
            {isFinished ? 'FINALIZADO' : timeLeft}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#151a3a',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  leftBorder: {
    width: 5,
    backgroundColor: '#3b82f6',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  phaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phaseIcon: {
    fontSize: 28,
  },
  phaseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  phaseStatus: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  countdownBox: {
    alignItems: 'flex-end',
  },
  countdownLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  timerText: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  }
});
