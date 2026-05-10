import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import TournamentBanner from '../../components/TournamentBanner';

export default function DashboardScreen() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [tournamentState, setTournamentState] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';

  const loadData = useCallback(async () => {
    try {
      // For now, we fetch predictions, reality, and rules to calculate the basic ranking
      // In a real app, you might want an endpoint that just returns the pre-calculated ranking
      const [predictionsRes, realityRes, rulesRes, stateRes] = await Promise.all([
        api.getPredictions(groupName),
        api.getReality(),
        api.getGroupRules(groupName),
        api.getTournamentState(groupName)
      ]);

      setTournamentState(stateRes);
      
      // Basic mock ranking just to show UI structure until we port scoringEngine logic to app or backend endpoint
      // The web dashboard does this in JS, we should ideally add an endpoint in api.js: GET /groups/:group/leaderboard
      // But for now, let's just display the users we got from predictions
      
      const users = Object.keys(predictionsRes || {});
      const mockRanking = users.map((u, index) => ({
        name: u,
        points: (users.length - index) * 10, // Mock points
        exact: Math.floor(Math.random() * 5),
        trend: index === 0 ? 'up' : index === users.length - 1 ? 'down' : 'same'
      }));
      
      setRanking(mockRanking.sort((a, b) => b.points - a.points));
    } catch (e) {
      console.error('Error loading dashboard', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupName]);

  useEffect(() => {
    if (auth) loadData();
  }, [auth, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5a623" />}
    >
      <TournamentBanner state={tournamentState} />

      <View style={styles.header}>
        <Text style={styles.groupName}>{groupName}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 Clasificación General</Text>
        
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colRank]}>#</Text>
          <Text style={[styles.th, styles.colName]}>Jugador</Text>
          <Text style={[styles.th, styles.colPts]}>Pts</Text>
          <Text style={[styles.th, styles.colExact]}>Ex</Text>
        </View>

        {ranking.map((player, index) => (
          <View key={player.name} style={[styles.tableRow, player.name === auth?.name && styles.myRow]}>
            <Text style={[styles.td, styles.colRank, index < 3 && styles.topRank]}>
              {index + 1}
            </Text>
            <View style={styles.colName}>
              <Text style={[styles.tdName, player.name === auth?.name && styles.myText]}>
                {player.name}
              </Text>
            </View>
            <Text style={[styles.td, styles.colPts, styles.bold]}>{player.points}</Text>
            <Text style={[styles.td, styles.colExact]}>{player.exact}</Text>
          </View>
        ))}
        
        {ranking.length === 0 && (
          <Text style={styles.emptyText}>Aún no hay predicciones en este grupo.</Text>
        )}
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤖 Resumen de IA</Text>
        <Text style={styles.aiText}>
          Ve a la pestaña de "Chat" y menciona al @agente para pedir un resumen personalizado de tu rendimiento o insultar a tus amigos.
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2a5a',
  },
  groupName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  phaseBadge: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  phaseText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#151a3a',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f5a623',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2a5a',
    paddingBottom: 8,
    marginBottom: 8,
  },
  th: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2a5a',
    alignItems: 'center',
  },
  myRow: {
    backgroundColor: '#1e40af33',
    borderRadius: 8,
  },
  td: {
    color: '#fff',
    fontSize: 15,
  },
  tdName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  myText: {
    color: '#f5a623',
    fontWeight: 'bold',
  },
  bold: {
    fontWeight: 'bold',
  },
  topRank: {
    color: '#f5a623',
    fontWeight: 'bold',
  },
  colRank: { width: 30, textAlign: 'center' },
  colName: { flex: 1, paddingHorizontal: 8 },
  colPts: { width: 40, textAlign: 'center' },
  colExact: { width: 30, textAlign: 'center' },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  aiText: {
    color: '#ccc',
    lineHeight: 22,
    fontSize: 15,
  }
});
