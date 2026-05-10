import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FIXTURE_GROUPS, TEAM_CODES, KNOCKOUT_BRACKET } from '../../constants/tournamentData';

export default function ResultsScreen() {
  const auth = getAuth();
  const isAdmin = auth?.isAdmin || false;
  
  const [loading, setLoading] = useState(true);
  const [reality, setReality] = useState<any>({ events: {} });
  const [state, setState] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'groups' | 'knockout'>('groups');

  const simSteps = [
    { phase: 'groups', label: '18 May: Grupos' },
    { phase: 'r32', label: '20 May: 1/16' },
    { phase: 'r16', label: '22 May: Octavos' },
    { phase: 'qf', label: '24 May: Cuartos' },
    { phase: 'sf', label: '26 May: Semis' },
    { phase: '3rd', label: '27 May: 3º Puesto' },
    { phase: 'final', label: '28 May: Final' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [realityRes, stateRes] = await Promise.all([
        api.getReality(),
        api.getTournamentState(auth?.currentGroup || '')
      ]);
      console.log('[Results] State:', stateRes);
      setReality(realityRes || { events: {} });
      setState(stateRes);
    } catch (e) {
      console.error('[Results] Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    Alert.alert(
      'Resetear Torneo',
      '¿Seguro que quieres borrar todos los resultados y eventos de la nube?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Resetear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.saveReality({ events: {} });
              fetchData();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  }

  async function handleSimulate(matchId: string, hName: string, aName: string) {
    if (!isAdmin) return;
    try {
      const res = await api.simulateMatch(matchId, hName, aName);
      // Actualizamos reality con la respuesta del server (que ya guardó el cambio)
      if (res) {
          fetchData(); // Recargamos para estar sincronizados
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
        <Text style={{ color: '#8b949e', marginTop: 10 }}>Cargando resultados...</Text>
      </View>
    );
  }

  const isTestMode = state?.isTestMode === true;
  const injected = reality?.autoPopulatedPhases || [];

  return (
    <View style={styles.container}>
      {/* HEADER DINÁMICO (Como en la Web) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isTestMode ? 'Resultados – Control Oficial' : 'Resultados del Torneo'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isTestMode 
            ? 'Control total del torneo. Modo simulación activo.' 
            : 'Consulta los marcadores oficiales y el estado del torneo.'}
        </Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]} 
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>Fase Grupos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'knockout' && styles.tabActive]} 
          onPress={() => setActiveTab('knockout')}
        >
          <Text style={[styles.tabText, activeTab === 'knockout' && styles.tabTextActive]}>Eliminatorias</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* PANEL DE SIMULACIÓN "GO-LIVE" */}
        {isTestMode && (
          <View style={styles.simPanel}>
            <View style={styles.simHeader}>
              <View>
                <View style={styles.simBadge}>
                  <Text style={styles.simBadgeText}>🚀 PANEL DE SIMULACIÓN "GO-LIVE"</Text>
                </View>
                <View style={styles.simStatusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.simStatusText}>MOTOR DE AUTO-POBLACIÓN: ACTIVO</Text>
                </View>
              </View>
              {isAdmin && (
                <TouchableOpacity onPress={handleReset} style={styles.miniResetBtn}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.simMetrics}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>TIEMPO SIMULADO</Text>
                <Text style={styles.metricVal}>
                  {state?.currentTime ? new Date(state.currentTime).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' }) : '--'}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>FASES INYECTADAS</Text>
                <Text style={[styles.metricVal, {color: '#3b82f6'}]}>{injected.length}/7</Text>
              </View>
            </View>

            <View style={styles.timeline}>
              <Text style={styles.timelineTitle}>CALENDARIO DE SIMULACIÓN:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
                {simSteps.map(step => {
                  const isActive = injected.includes(step.phase);
                  return (
                    <View key={step.phase} style={[styles.timelineStep, isActive && styles.timelineStepActive]}>
                      <Text style={[styles.timelineStepText, isActive && styles.timelineStepTextActive]}>
                        {isActive ? '✅ ' : '📅 '}{step.label}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* LISTADO DE PARTIDOS */}
        {activeTab === 'groups' ? (
          FIXTURE_GROUPS.map(g => (
            <View key={g.letter} style={styles.groupCard}>
              <View style={styles.groupHead}>
                <View style={styles.letterCircle}><Text style={styles.letterText}>{g.letter}</Text></View>
                <Text style={styles.groupTitle}>Grupo {g.letter}</Text>
              </View>
              {[0, 1, 2, 3, 4, 5].map(mIdx => {
                const matchId = `g${g.letter}_m${mIdx}`;
                const hName = g.teams[mIdx % 4];
                const aName = g.teams[(mIdx + 1) % 4];
                return (
                  <MatchRow 
                    key={matchId}
                    matchId={matchId} hName={hName} aName={aName} 
                    reality={reality} onSimulate={handleSimulate} isAdmin={isAdmin}
                  />
                );
              })}
            </View>
          ))
        ) : (
          <View>
            {KNOCKOUT_BRACKET.map(stage => (
              <View key={stage.id} style={styles.groupCard}>
                <Text style={styles.stageTitle}>{stage.name}</Text>
                {stage.matches.map(mId => (
                  <MatchRow 
                      key={mId}
                      matchId={`ko_${mId}`} hName="TBD" aName="TBD" 
                      reality={reality} onSimulate={handleSimulate} isAdmin={isAdmin}
                    />
                ))}
              </View>
            ))}
            
            {/* HONOR ROLL */}
            <View style={styles.awardsCard}>
              <Text style={styles.awardsTitle}>🏆 Cuadro de Honor</Text>
              <View style={styles.awardRow}>
                <Text style={styles.awardLabel}>Campeón</Text>
                <Text style={styles.awardVal}>Pendiente</Text>
              </View>
              <View style={styles.awardRow}>
                <Text style={styles.awardLabel}>Subcampeón</Text>
                <Text style={styles.awardVal}>Pendiente</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function MatchRow({ matchId, hName, aName, reality, onSimulate, isAdmin }: any) {
  const hScore = reality[`${matchId}_h`] ?? '';
  const aScore = reality[`${matchId}_a`] ?? '';
  const hCode = TEAM_CODES[hName];
  const aCode = TEAM_CODES[aName];

  return (
    <View style={styles.matchItem}>
      <View style={styles.matchMeta}>
        <Text style={styles.matchId}>{matchId.toUpperCase()}</Text>
        {isAdmin && (
          <TouchableOpacity onPress={() => onSimulate(matchId, hName, aName)} style={styles.diceBtn}>
            <MaterialCommunityIcons name="dice-5" size={18} color="#f5a623" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.scoreRow}>
        <View style={styles.team}>
          {hCode && <Image source={{ uri: `https://flagcdn.com/w40/${hCode}.png` }} style={styles.miniFlag} />}
          <Text style={styles.teamText} numberOfLines={1}>{hName}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>{hScore !== '' ? hScore : '-'}</Text>
          <Text style={styles.vs}>-</Text>
          <Text style={styles.scoreText}>{aScore !== '' ? aScore : '-'}</Text>
        </View>
        <View style={[styles.team, {justifyContent: 'flex-end'}]}>
          <Text style={[styles.teamText, {textAlign: 'right'}]} numberOfLines={1}>{aName}</Text>
          {aCode && <Image source={{ uri: `https://flagcdn.com/w40/${aCode}.png` }} style={styles.miniFlag} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e27' },
  header: { padding: 20, paddingTop: 10 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  headerSubtitle: { color: '#8b949e', fontSize: 13, marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: '#161b22', padding: 4, marginHorizontal: 20, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#21262d' },
  tabText: { color: '#8b949e', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#f5a623' },
  content: { paddingHorizontal: 20 },
  
  simPanel: { backgroundColor: 'rgba(245, 166, 35, 0.05)', borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.2)' },
  simHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  simBadge: { backgroundColor: 'rgba(245, 166, 35, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  simBadgeText: { color: '#f5a623', fontSize: 10, fontWeight: '800' },
  simStatusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 8 },
  simStatusText: { color: '#10b981', fontSize: 11, fontWeight: '800' },
  miniResetBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 12 },
  simMetrics: { flexDirection: 'row', gap: 30, marginBottom: 24 },
  metric: { flex: 1 },
  metricLabel: { color: '#8b949e', fontSize: 10, fontWeight: '700', marginBottom: 6 },
  metricVal: { color: '#f5a623', fontSize: 18, fontWeight: '900' },
  timeline: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16 },
  timelineTitle: { color: '#f5a623', fontSize: 10, fontWeight: '800', marginBottom: 12 },
  timelineScroll: { gap: 10 },
  timelineStep: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  timelineStepActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981' },
  timelineStepText: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  timelineStepTextActive: { color: '#10b981', fontWeight: '700' },

  groupCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  groupHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  letterCircle: { backgroundColor: '#f5a623', width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  letterText: { color: '#0a0e27', fontWeight: '900', fontSize: 14 },
  groupTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  stageTitle: { color: '#f5a623', fontSize: 16, fontWeight: '800', marginBottom: 16, textTransform: 'uppercase' },
  matchItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  matchMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  matchId: { color: '#484f58', fontSize: 10, fontWeight: '800' },
  diceBtn: { padding: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  team: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  miniFlag: { width: 24, height: 16, borderRadius: 3 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 90 },
  scoreText: { color: '#f5a623', fontSize: 24, fontWeight: '900', width: 34, textAlign: 'center' },
  vs: { color: '#484f58', marginHorizontal: 6, fontSize: 18 },

  awardsCard: { backgroundColor: 'rgba(245, 166, 35, 0.05)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.2)' },
  awardsTitle: { color: '#f5a623', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  awardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(245, 166, 35, 0.1)' },
  awardLabel: { color: '#8b949e', fontSize: 15 },
  awardVal: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
