import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/i18n';

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
            hasStarted={tournamentState?.hasStarted}
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

function PredictionList({ predictions, isMe, hasStarted }: { predictions: any, isMe: boolean, hasStarted: boolean }) {
  const { t } = useTranslation();
  // Aquí deberíamos mapear las predicciones a nombres de partidos reales
  // Para V1, mostramos un resumen por grupos
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  
  if (!isMe && !hasStarted) {
    return (
      <View style={styles.lockedCard}>
        <Ionicons name="lock-closed" size={48} color="#64748b" />
        <Text style={styles.lockedTitle}>{t('pool.locked_title')}</Text>
        <Text style={styles.lockedDesc}>{t('pool.locked_desc')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map(g => (
        <View key={g} style={styles.groupSection}>
          <Text style={styles.groupLabel}>{t('common.group')} {g}</Text>
          <View style={styles.row}>
            <Text style={styles.matchLabel}>Partido 1:</Text>
            <Text style={styles.scoreText}>{predictions[`g${g}_m0_h`] ?? '?'} - {predictions[`g${g}_m0_a`] ?? '?'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.matchLabel}>Partido 2:</Text>
            <Text style={styles.scoreText}>{predictions[`g${g}_m1_h`] ?? '?'} - {predictions[`g${g}_m1_a`] ?? '?'}</Text>
          </View>
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
