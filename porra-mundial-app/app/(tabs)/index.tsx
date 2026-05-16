import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import TournamentBanner from '../../components/TournamentBanner';
import { useTranslation } from '../../i18n/i18n';

export default function DashboardScreen() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [tournamentState, setTournamentState] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';
  const { t } = useTranslation();

  const loadData = useCallback(async () => {
    try {
      const [leaderboardRes, stateRes] = await Promise.all([
        api.getLeaderboard(groupName),
        api.getTournamentState(groupName)
      ]);

      setTournamentState(stateRes);
      setRanking(leaderboardRes);
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

  const toggleExpand = (name: string) => {
    setExpandedPlayer(expandedPlayer === name ? null : name);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
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
        <Text style={styles.cardTitle}>{t('leaderboard.title')}</Text>
        
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colRank]}>#</Text>
          <Text style={[styles.th, styles.colName]}>{t('leaderboard.player')}</Text>
          <Text style={[styles.th, styles.colPts]}>{t('leaderboard.pts')}</Text>
          <Text style={[styles.th, styles.colExact]}>{t('leaderboard.exact')}</Text>
        </View>

        {ranking.map((player, index) => (
          <View key={player.name}>
            <TouchableOpacity 
              style={[styles.tableRow, player.name === auth?.name && styles.myRow]}
              onPress={() => toggleExpand(player.name)}
              activeOpacity={0.7}
            >
              <Text style={[styles.td, styles.colRank, index < 3 && styles.topRank]}>
                {index + 1}
              </Text>
              <View style={styles.colName}>
                <Text style={[styles.tdName, player.name === auth?.name && styles.myText]}>
                  {player.name}
                </Text>
              </View>
              <Text style={[styles.td, styles.colPts, styles.bold]}>{player.totalPts}</Text>
              <Text style={[styles.td, styles.colExact]}>{player.exactHits}</Text>
            </TouchableOpacity>

            {/* DESGLOSE EXPANDIDO */}
            {expandedPlayer === player.name && (
              <View style={styles.expandedContent}>
                <Text style={styles.expandedTitle}>{t('leaderboard.detailed_points')}</Text>
                {player.history && player.history.length > 0 ? (
                  player.history.map((h: any, i: number) => (
                    <View key={i} style={styles.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyMatch} numberOfLines={1}>{h.match}</Text>
                        <Text style={styles.reasonText}>{h.reason || t('leaderboard.points_label')}</Text>
                      </View>
                      <View style={styles.historyBadge}>
                        <Text style={styles.historyPts}>+{h.pts}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noHistory}>{t('leaderboard.no_history')}</Text>
                )}
              </View>
            )}
          </View>
        ))}
        
        {ranking.length === 0 && (
          <Text style={styles.emptyText}>{t('leaderboard.no_predictions')}</Text>
        )}
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('leaderboard.ai_summary_title')}</Text>
        <Text style={styles.aiText}>
          {t('leaderboard.ai_summary_desc')}
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
  aiText: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
  
  // ESTILOS EXPANDIDO
  expandedContent: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  expandedTitle: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  historyMatch: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600'
  },
  reasonText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  historyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyPts: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700'
  },
  noHistory: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10
  }
});
