import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation, tTeam } from '../../i18n/i18n';
import { FIXTURE_GROUPS, getGroupMatches } from '../../constants/tournamentData';

export default function PoolScreen() {
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [cloudData, setCloudData] = useState<any>({});
  const [tournamentState, setTournamentState] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  useEffect(() => {
    if (!groupName) return;
    
    setLoading(true);
    Promise.all([
      api.getPredictions(groupName),
      api.getTournamentState(groupName)
    ]).then(([preds, state]) => {
      setCloudData(preds || {});
      setTournamentState(state);
      
      // Auto-seleccionar al primer jugador
      const players = Object.keys(preds || {}).sort();
      if (players.length > 0) setSelectedPlayer(players[0]);
    })
    .catch(e => {
      console.error(e);
      Alert.alert(t('common.error'), t('pool.load_error'));
    })
    .finally(() => setLoading(false));
  }, [groupName]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
      </View>
    );
  }

  const players = Object.keys(cloudData).sort();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('pool.title')}</Text>
        <Text style={styles.subtitle}>{t('pool.subtitle')}</Text>
      </View>

      {/* Selector de Jugador (Horizontal) */}
      <View style={styles.selectorWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selector}>
          {players.map(p => (
            <TouchableOpacity 
              key={p} 
              style={[styles.playerTab, selectedPlayer === p && styles.playerTabActive]}
              onPress={() => setSelectedPlayer(p)}
            >
              <Text style={[styles.playerTabText, selectedPlayer === p && styles.playerTabActiveText]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Listado de Predicciones */}
      <ScrollView contentContainerStyle={styles.scroll}>
        {selectedPlayer && cloudData[selectedPlayer] ? (
          <PredictionList 
            predictions={cloudData[selectedPlayer].predictions || {}} 
            isMe={selectedPlayer === auth?.name}
            tournamentState={tournamentState}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('pool.no_predictions')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PredictionList({ predictions, isMe, tournamentState }: { predictions: any, isMe: boolean, tournamentState: any }) {
  const { t } = useTranslation();
  
  const hasStarted = tournamentState?.hasStarted;
  const unlocks = tournamentState?.unlocks || [];

  if (!isMe && !hasStarted) {
    return (
      <View style={styles.lockedCard}>
        <Ionicons name="lock-closed" size={48} color="#64748b" />
        <Text style={styles.lockedTitle}>{t('pool.locked_title')}</Text>
        <Text style={styles.lockedDesc}>{t('pool.locked_desc')}</Text>
      </View>
    );
  }

  // Helper para mostrar un partido
  const renderMatchRow = (matchId: string, team1: string, team2: string, phaseId: string) => {
    // Si la fase está actualmente abierta (en unlocks) y no soy yo, ocultamos el resultado
    const isHidden = !isMe && unlocks.includes(phaseId);
    
    let scoreText = '? - ?';
    if (!isHidden) {
      const sH = predictions[`${matchId}_h`];
      const sA = predictions[`${matchId}_a`];
      if (sH !== undefined && sA !== undefined) {
        scoreText = `${sH} - ${sA}`;
      } else {
        scoreText = '-'; // No lo rellenó
      }
    }

    return (
      <View key={matchId} style={styles.row}>
        <Text style={styles.matchLabel}>{team1} - {team2}</Text>
        <Text style={styles.scoreText}>{scoreText}</Text>
      </View>
    );
  };

  return (
    <View style={styles.list}>
      {/* Fase de Grupos */}
      {FIXTURE_GROUPS.map(g => {
        const matches = getGroupMatches(g);
        return (
          <View key={g.letter} style={styles.groupSection}>
            <Text style={styles.groupLabel}>{t('common.group')} {g.letter}</Text>
            {matches.map(m => renderMatchRow(m.id, tTeam(m.team1), tTeam(m.team2), 'groups'))}
          </View>
        );
      })}

      {/* Fases Eliminatorias */}
      {tournamentState?.knockoutBracket?.map((kb: any) => (
        <View key={kb.id} style={styles.groupSection}>
          <Text style={styles.groupLabel}>{kb.name}</Text>
          {kb.matches.map((mId: number) => {
            const teams = tournamentState?.bracketMatches?.[mId] || ['TBD', 'TBD'];
            const team1Name = teams[0].match(/^[1-3][A-Z]+$/) ? t('predictions.best_third') : tTeam(teams[0]);
            const team2Name = teams[1].match(/^[1-3][A-Z]+$/) ? t('predictions.best_third') : tTeam(teams[1]);
            return renderMatchRow(`ko_${mId}`, team1Name, team2Name, kb.id);
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, paddingTop: 10 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  selectorWrapper: { backgroundColor: 'rgba(255,255,255,0.02)', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  selector: { paddingHorizontal: 16, gap: 8 },
  playerTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  playerTabActive: { backgroundColor: '#f5a623', borderColor: '#f5a623' },
  playerTabText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  playerTabActiveText: { color: '#0a0e27' },
  scroll: { padding: 16 },
  list: { gap: 16 },
  groupSection: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  groupLabel: { color: '#f5a623', fontWeight: '700', fontSize: 13, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  matchLabel: { color: '#94a3b8', fontSize: 14 },
  scoreText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#64748b' },
  lockedCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 32, alignItems: 'center', marginTop: 40, borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  lockedTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 16 },
  lockedDesc: { color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
