import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FIXTURE_GROUPS, TEAM_CODES, KNOCKOUT_BRACKET } from '../../constants/tournamentData';
import TournamentBanner from '../../components/TournamentBanner';

export default function ResultsScreen() {
  const auth = getAuth();
  const isAdmin = auth?.isAdmin || false;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  }, [auth?.currentGroup]); // Recargar si cambia el grupo

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  }, [auth?.currentGroup]);

  async function fetchData() {
    try {
      const gName = auth?.currentGroup || '';
      console.log(`[Results] Fetching data for group: "${gName}"`);
      
      const [realityRes, stateRes] = await Promise.all([
        api.getReality(),
        api.getTournamentState(gName)
      ]);
      
      console.log('[Results] State received:', stateRes);
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

  const resolveTeamName = (code: string) => {
    if (!code || !reality) return code;
    
    // 1. Si es un equipo real, lo devolvemos
    if (TEAM_CODES[code]) return code;

    // 2. Si es posición de grupo (ej: "1A")
    const groupMatch = code.match(/^([1-2])([A-L])$/);
    if (groupMatch) {
      const pos = parseInt(groupMatch[1]);
      const letter = groupMatch[2];
      // Nota: Esto requeriría calcular los standings en el móvil o que el server los de.
      // Por simplicidad, devolvemos el código si no podemos calcularlo aquí,
      // pero el server ya nos da la realidad poblada en matchId si usamos el motor de simulación.
      return code; 
    }

    // 3. Si es ganador/perdedor de partido (ej: "W104")
    const matchRef = code.match(/^([WL])(\d+)$/);
    if (matchRef) {
      const type = matchRef[1];
      const mNum = matchRef[2];
      const hScore = parseInt(reality[`ko_${mNum}_h`]);
      const aScore = parseInt(reality[`ko_${mNum}_a`]);
      
      if (isNaN(hScore) || isNaN(aScore)) return code;
      
      // Aquí necesitaríamos saber quiénes jugaron ese partido para saber quién ganó.
      // En la app, el motor de simulación del servidor ya inyecta los nombres reales 
      // en la 'reality' cuando se avanza de fase.
      return code;
    }

    return code;
  };

  const getWinner = (matchId: string) => {
    const h = parseInt(reality[`${matchId}_h`]);
    const a = parseInt(reality[`${matchId}_a`]);
    if (isNaN(h) || isNaN(a)) return null;
    
    // Simplificado: esto debería venir resuelto del server en un caso ideal
    // Pero podemos intentar leer los nombres que el server inyectó
    return h > a ? 'Ganador' : 'Ganador'; 
  };

  return (
    <View style={styles.container}>
      <TournamentBanner state={state} />

      {/* HEADER DINÁMICO */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isTestMode ? 'Control de Resultados' : 'Resultados Oficiales'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isTestMode 
            ? 'Panel de simulación y gestión de fases activo.' 
            : 'Sigue el mundial y consulta el cuadro de honor.'}
        </Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]} 
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>Grupos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'knockout' && styles.tabActive]} 
          onPress={() => setActiveTab('knockout')}
        >
          <Text style={[styles.tabText, activeTab === 'knockout' && styles.tabTextActive]}>Eliminatorias</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5a623" />
        }
      >
        
        {/* PANEL DE SIMULACIÓN "GO-LIVE" */}
        {(isTestMode || (isAdmin && !state)) && (
          <View style={styles.simPanel}>
            <View style={styles.simHeader}>
              <View>
                <View style={styles.simBadge}>
                  <Text style={styles.simBadgeText}>🚀 PANEL DE SIMULACIÓN "GO-LIVE"</Text>
                </View>
                <View style={styles.simStatusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.simStatusText}>MODO PRUEBAS: ACTIVO</Text>
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
                <Text style={styles.metricLabel}>FECHA ACTUAL</Text>
                <Text style={styles.metricVal}>
                  {state?.currentTime ? new Date(state.currentTime).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '--'}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>PROGRESO</Text>
                <Text style={[styles.metricVal, {color: '#3b82f6'}]}>{injected.length}/7 Fases</Text>
              </View>
            </View>

            <View style={styles.timeline}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
                {simSteps.map(step => {
                  const isActive = injected.includes(step.phase);
                  return (
                    <View key={step.phase} style={[styles.timelineStep, isActive && styles.timelineStepActive]}>
                      <Text style={[styles.timelineStepText, isActive && styles.timelineStepTextActive]}>
                        {isActive ? '✅ ' : ''}{step.label.split(': ')[1]}
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
                const hName = reality[`${matchId}_h_team`] || g.teams[mIdx % 4];
                const aName = reality[`${matchId}_a_team`] || g.teams[(mIdx + 1) % 4];
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
                {stage.matches.map(mId => {
                  const matchId = `ko_${mId}`;
                  const hName = reality[`${matchId}_h_team`] || "TBD";
                  const aName = reality[`${matchId}_a_team`] || "TBD";
                  return (
                    <MatchRow 
                      key={mId}
                      matchId={matchId} hName={hName} aName={aName} 
                      reality={reality} onSimulate={handleSimulate} isAdmin={isAdmin}
                    />
                  );
                })}
              </View>
            ))}
            
            {/* CUADRO DE HONOR DINÁMICO */}
            <View style={styles.awardsCard}>
              <View style={styles.awardsHeader}>
                <MaterialCommunityIcons name="trophy-variant" size={24} color="#f5a623" />
                <Text style={styles.awardsTitle}>Cuadro de Honor</Text>
              </View>

              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>🏆 Campeón del Mundo</Text>
                  <Text style={styles.awardVal}>
                    {reality['ko_104_h_team'] && reality['ko_104_a_team'] 
                      ? (parseInt(reality['ko_104_h']) > parseInt(reality['ko_104_a']) ? reality['ko_104_h_team'] : reality['ko_104_a_team'])
                      : 'Por definir'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="star" size={20} color="#f5a623" />
              </View>

              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>🥈 Subcampeón</Text>
                  <Text style={styles.awardVal}>
                    {reality['ko_104_h_team'] && reality['ko_104_a_team'] 
                      ? (parseInt(reality['ko_104_h']) < parseInt(reality['ko_104_a']) ? reality['ko_104_h_team'] : reality['ko_104_a_team'])
                      : 'Por definir'}
                  </Text>
                </View>
              </View>

              {/* BALONES DE ORO */}
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>⚽ Balón de Oro</Text>
                  <Text style={styles.awardVal}>{reality['ball_gold'] || 'Mejor jugador...'}</Text>
                </View>
              </View>
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>⚪ Balón de Plata</Text>
                  <Text style={styles.awardVal}>{reality['ball_silver'] || 'Segundo mejor...'}</Text>
                </View>
              </View>
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>🟤 Balón de Bronce</Text>
                  <Text style={styles.awardVal}>{reality['ball_bronze'] || 'Tercer mejor...'}</Text>
                </View>
              </View>

              {/* BOTAS DE ORO */}
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>👟 Bota de Oro</Text>
                  <Text style={styles.awardVal}>{reality['boot_gold'] || 'Máximo goleador...'}</Text>
                </View>
              </View>
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>🥈 Bota de Plata</Text>
                  <Text style={styles.awardVal}>{reality['boot_silver'] || 'Segundo goleador...'}</Text>
                </View>
              </View>
              <View style={[styles.awardRow, { borderBottomWidth: 0 }]}>
                <View>
                  <Text style={styles.awardLabel}>🥉 Bota de Bronce</Text>
                  <Text style={styles.awardVal}>{reality['boot_bronze'] || 'Tercer goleador...'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
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
