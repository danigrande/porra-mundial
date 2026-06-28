import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FIXTURE_GROUPS, TEAM_CODES, KNOCKOUT_BRACKET, getGroupMatches, getGroupStandings, fullResolve, BRACKET_MATCHES, getCalendarMatches, MATCH_KICKOFFS } from '../../constants/tournamentData';
import type { CalendarMatch } from '../../constants/tournamentData';
import TournamentBanner from '../../components/TournamentBanner';
import { useTranslation, tTeam } from '../../i18n/i18n';

export default function ResultsScreen() {
  const auth = getAuth();
  const isAdmin = auth?.isAdmin || false;
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reality, setReality] = useState<any>({ events: {} });
  const [state, setState] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'groups' | 'knockout'>('calendar');
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [allCalendarMatches, setAllCalendarMatches] = useState<CalendarMatch[]>([]);

  const simSteps = [
    { phase: 'groups', label: '20 May: Grupos' },
    { phase: 'r32', label: '22 May: 1/16' },
    { phase: 'r16', label: '24 May: Octavos' },
    { phase: 'qf', label: '26 May: Cuartos' },
    { phase: 'sf', label: '28 May: Semis' },
    { phase: '3rd', label: '29 May: 3º Puesto' },
    { phase: 'final', label: '30 May: Final' },
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

      const matches = getCalendarMatches(realityRes || { events: {} });
      setAllCalendarMatches(matches);
      const now = stateRes?.currentTime ? new Date(stateRes.currentTime) : new Date();
      const todayIdx = matches.findIndex(m => m.kickoff && new Date(m.kickoff) >= now);
      setCalendarOffset(Math.max(0, todayIdx));
    } catch (e) {
      console.error('[Results] Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    Alert.alert(
      t('results.reset_title'),
      t('results.reset_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('results.reset_action'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.saveReality({ events: {} });
              fetchData();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.message);
            }
          }
        }
      ]
    );
  }

  async function handleSimulate(matchId: string, hName: string, aName: string) {
    if (!isAdmin) return;
    try {
      const res = await api.simulateMatch(matchId, hName, aName, '');
      // Actualizamos reality con la respuesta del server (que ya guardó el cambio)
      if (res) {
          fetchData(); // Recargamos para estar sincronizados
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
        <Text style={{ color: '#8b949e', marginTop: 10 }}>{t('results.loading')}</Text>
      </View>
    );
  }

  const isTestMode = state?.isTestMode === true;
  const injected = reality?.autoPopulatedPhases || [];



  return (
    <View style={styles.container}>
      <TournamentBanner state={state} />

      {/* HEADER DINÁMICO */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isTestMode ? t('results.title_test') : t('results.title_official')}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isTestMode 
            ? t('results.subtitle_test') 
            : t('results.subtitle_official')}
        </Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'calendar' && styles.tabActive]} 
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>{t('results.calendar_tab')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]} 
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>{t('results.groups_tab')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'knockout' && styles.tabActive]} 
          onPress={() => setActiveTab('knockout')}
        >
          <Text style={[styles.tabText, activeTab === 'knockout' && styles.tabTextActive]}>{t('results.knockout_tab')}</Text>
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

        {/* CALENDARIO */}
        {activeTab === 'calendar' ? (
          <CalendarPanel
            matches={allCalendarMatches}
            offset={calendarOffset}
            onPrev={() => setCalendarOffset(Math.max(0, calendarOffset - 4))}
            onNext={() => setCalendarOffset(Math.min(allCalendarMatches.length - 1, calendarOffset + 4))}
            reality={reality}
            isAdmin={isAdmin}
            onSimulate={handleSimulate}
            t={t}
          />
        ) : activeTab === 'groups' ? (
          FIXTURE_GROUPS.map(g => (
            <View key={g.letter} style={styles.groupCard}>
              <View style={styles.groupHead}>
                <View style={styles.letterCircle}><Text style={styles.letterText}>{g.letter}</Text></View>
                <Text style={styles.groupTitle}>{t('common.group')} {g.letter}</Text>
              </View>
              {getGroupMatches(g).map(m => {
                const hName = reality[`${m.id}_h_team`] || m.team1;
                const aName = reality[`${m.id}_a_team`] || m.team2;
                return (
                  <MatchRow
                    key={m.id}
                    matchId={m.id} hName={hName} aName={aName}
                    reality={reality} onSimulate={handleSimulate} isAdmin={isAdmin}
                  />
                );
              })}
              <StandingsTable letter={g.letter} reality={reality} />
            </View>
          ))
        ) : (
          <View>
            {KNOCKOUT_BRACKET.map(stage => (
              <View key={stage.id} style={styles.groupCard}>
                <Text style={styles.stageTitle}>{stage.name}</Text>
                {stage.matches.map(mId => {
                  const matchId = `ko_${mId}`;
                  const pairing = BRACKET_MATCHES[mId];
                  const hName = reality[`${matchId}_h_team`] || (pairing ? fullResolve(pairing[0], reality) : "TBD");
                  const aName = reality[`${matchId}_a_team`] || (pairing ? fullResolve(pairing[1], reality) : "TBD");
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
                <Text style={styles.awardsTitle}>{t('results.honor_title')}</Text>
              </View>

              {(() => {
                const champ = fullResolve('W104', reality);
                const runner = fullResolve('L104', reality);
                const hasChamp = champ && !!TEAM_CODES[champ];
                const hasRunner = runner && !!TEAM_CODES[runner];
                return (<>
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>{t('results.world_champion')}</Text>
                  <Text style={styles.awardVal}>
                    {hasChamp ? tTeam(champ) : t('common.to_be_defined')}
                  </Text>
                </View>
                <MaterialCommunityIcons name="star" size={20} color="#f5a623" />
              </View>

              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>{t('results.runner_up')}</Text>
                  <Text style={styles.awardVal}>
                    {hasRunner ? tTeam(runner) : t('common.to_be_defined')}
                  </Text>
                </View>
              </View>
              </>);
              })()}

              {/* BALONES DE ORO */}
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>{t('results.golden_ball')}</Text>
                  <Text style={styles.awardVal}>{reality['ball_gold'] || t('results.best_player_placeholder')}</Text>
                </View>
              </View>
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>{t('results.silver_ball')}</Text>
                  <Text style={styles.awardVal}>{reality['ball_silver'] || t('results.second_best_placeholder')}</Text>
                </View>
              </View>
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>{t('results.bronze_ball')}</Text>
                  <Text style={styles.awardVal}>{reality['ball_bronze'] || t('results.third_best_placeholder')}</Text>
                </View>
              </View>

              {/* BOTAS DE ORO */}
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>{t('results.golden_boot')}</Text>
                  <Text style={styles.awardVal}>{reality['boot_gold'] || t('results.top_scorer_placeholder')}</Text>
                </View>
              </View>
              <View style={styles.awardRow}>
                <View>
                  <Text style={styles.awardLabel}>{t('results.silver_boot')}</Text>
                  <Text style={styles.awardVal}>{reality['boot_silver'] || t('results.second_scorer_placeholder')}</Text>
                </View>
              </View>
              <View style={[styles.awardRow, { borderBottomWidth: 0 }]}>
                <View>
                  <Text style={styles.awardLabel}>{t('results.bronze_boot')}</Text>
                  <Text style={styles.awardVal}>{reality['boot_bronze'] || t('results.third_scorer_placeholder')}</Text>
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

  const hNorm = hName?.toLowerCase() ?? '';
  const aNorm = aName?.toLowerCase() ?? '';
  const allEvents: any[] = (reality.events && reality.events[matchId]) || [];
  const homeEvts = allEvents.filter((e: any) => e.team?.name?.toLowerCase() === hNorm);
  const awayEvts = allEvents.filter((e: any) => e.team?.name?.toLowerCase() === aNorm);
  const getIcon = (e: any) => e.type === 'Goal' ? '\u26bd' : (e.detail === 'Red Card' ? '\ud83d\udfe5' : '\ud83d\udfe8');

  const isKnockout = matchId.startsWith('ko_');
  const matchNum = isKnockout ? matchId.replace('ko_', '') : '';
  const isTie = hScore !== '' && aScore !== '' && hScore === aScore;
  const penH = reality[`pen_${matchNum}_h`] ?? '';
  const penA = reality[`pen_${matchNum}_a`] ?? '';

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
        <View style={styles.teamCol}>
          <View style={styles.team}>
            {hCode && <Image source={{ uri: `https://flagcdn.com/w40/${hCode}.png` }} style={styles.miniFlag} />}
            <Text style={styles.teamText} numberOfLines={1}>{tTeam(hName)}</Text>
          </View>
          {homeEvts.map((e: any, i: number) => (
            <Text key={i} style={styles.eventItemHome}>
              {e.time.elapsed}' {getIcon(e)} {e.player.name}
            </Text>
          ))}
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>{hScore !== '' ? hScore : '-'}</Text>
          <Text style={styles.vs}>-</Text>
          <Text style={styles.scoreText}>{aScore !== '' ? aScore : '-'}</Text>
        </View>
        <View style={[styles.teamCol, { alignItems: 'flex-end' }]}>
          <View style={[styles.team, { justifyContent: 'flex-end' }]}>
            <Text style={[styles.teamText, { textAlign: 'right' }]} numberOfLines={1}>{tTeam(aName)}</Text>
            {aCode && <Image source={{ uri: `https://flagcdn.com/w40/${aCode}.png` }} style={styles.miniFlag} />}
          </View>
          {awayEvts.map((e: any, i: number) => (
            <Text key={i} style={styles.eventItemAway}>
              {e.player.name} {getIcon(e)} {e.time.elapsed}'
            </Text>
          ))}
        </View>
      </View>
      {isKnockout && isTie && penH !== '' && penA !== '' && (
        <View style={styles.penaltiesRow}>
          <View style={styles.teamCol} />
          <View style={styles.penaltiesBox}>
            <Text style={styles.penaltiesLabel}>Pen.</Text>
            <Text style={styles.penaltyScore}>{penH}</Text>
            <Text style={styles.vs}>-</Text>
            <Text style={styles.penaltyScore}>{penA}</Text>
          </View>
          <View style={styles.teamCol} />
        </View>
      )}
    </View>
  );
}

function StandingsTable({ letter, reality }: { letter: string; reality: any }) {
  const rows = getGroupStandings(letter, reality);
  const hasAnyData = rows.some(r => r.pts > 0 || r.w > 0 || r.d > 0 || r.l > 0);
  if (!hasAnyData) return null;

  return (
    <View style={styles.standingsContainer}>
      <Text style={styles.standingsTitle}>CLASIFICACIÓN</Text>
      {/* Header */}
      <View style={styles.standingsHeader}>
        <Text style={[styles.standingsCell, styles.standingsCellPos]}>#</Text>
        <Text style={[styles.standingsCell, { flex: 1 }]}>Equipo</Text>
        <Text style={styles.standingsCell}>Pts</Text>
        <Text style={styles.standingsCell}>G</Text>
        <Text style={styles.standingsCell}>E</Text>
        <Text style={styles.standingsCell}>P</Text>
        <Text style={styles.standingsCell}>DG</Text>
      </View>
      {rows.map((row, i) => {
        const code = TEAM_CODES[row.name];
        const isQualifier = i < 2;
        return (
          <View
            key={row.name}
            style={[
              styles.standingsRow,
              isQualifier && styles.standingsRowQualifier,
            ]}
          >
            <Text style={[styles.standingsCell, styles.standingsCellPos, isQualifier && styles.standingsQualifierText]}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : `${i + 1}`}
            </Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {code && <Image source={{ uri: `https://flagcdn.com/w40/${code}.png` }} style={styles.miniFlag} />}
              <Text style={[styles.standingsTeamText, isQualifier && styles.standingsQualifierText]} numberOfLines={1}>
                {tTeam(row.name)}
              </Text>
            </View>
            <Text style={[styles.standingsCell, styles.standingsPts, isQualifier && styles.standingsQualifierText]}>{row.pts}</Text>
            <Text style={styles.standingsCell}>{row.w}</Text>
            <Text style={styles.standingsCell}>{row.d}</Text>
            <Text style={styles.standingsCell}>{row.l}</Text>
            <Text style={[styles.standingsCell, row.gd > 0 ? styles.gdPositive : row.gd < 0 ? styles.gdNegative : {}]}>
              {row.gd > 0 ? `+${row.gd}` : row.gd}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function CalendarPanel({ matches, offset, onPrev, onNext, reality, isAdmin, onSimulate, t }: any) {
  const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });

  const slice = matches.slice(offset, offset + 4);
  if (slice.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#8b949e' }}>{t('results.no_more_matches')}</Text>
      </View>
    );
  }

  const grouped: Record<string, CalendarMatch[]> = {};
  slice.forEach((m: CalendarMatch) => {
    if (!m.kickoff) return;
    const d = new Date(m.kickoff);
    const dateKey = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(m);
  });

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarNav}>
        <TouchableOpacity
          style={[styles.calendarNavBtn, offset <= 0 && styles.calendarNavBtnDisabled]}
          onPress={onPrev}
          disabled={offset <= 0}
        >
          <Text style={[styles.calendarNavText, offset <= 0 && styles.calendarNavTextDisabled]}>
            {t('results.see_previous')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.calendarNavBtn, offset + 4 >= matches.length && styles.calendarNavBtnDisabled]}
          onPress={onNext}
          disabled={offset + 4 >= matches.length}
        >
          <Text style={[styles.calendarNavText, offset + 4 >= matches.length && styles.calendarNavTextDisabled]}>
            {t('results.see_next')}
          </Text>
        </TouchableOpacity>
      </View>

      {Object.entries(grouped).map(([dateKey, dayMatches]) => {
        const isToday = dateKey === todayStr;
        return (
          <View key={dateKey} style={styles.calendarDayGroup}>
            <View style={styles.dateHeader}>
              <Text style={[styles.dateHeaderText, isToday && styles.dateHeaderTextToday]}>
                {isToday ? `● ${t('results.today')}` : dateKey}
              </Text>
            </View>
            {dayMatches.map(m => {
              const hScore = reality[`${m.id}_h`] ?? '';
              const aScore = reality[`${m.id}_a`] ?? '';
              const isPlayed = hScore !== '' && aScore !== '';
              if (isPlayed) {
                return (
                  <MatchRow
                    key={m.id}
                    matchId={m.id} hName={m.team1} aName={m.team2}
                    reality={reality} onSimulate={onSimulate} isAdmin={isAdmin}
                  />
                );
              }
              return <CalendarMatchRow key={m.id} match={m} />;
            })}
          </View>
        );
      })}
    </View>
  );
}

function CalendarMatchRow({ match }: { match: CalendarMatch }) {
  const { team1, team2, kickoff } = match;
  const hCode = TEAM_CODES[team1];
  const aCode = TEAM_CODES[team2];
  const d = kickoff ? new Date(kickoff) : null;
  const localTime = d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <View style={styles.matchItem}>
      <View style={styles.scoreRow}>
        <View style={styles.teamCol}>
          <View style={styles.team}>
            {hCode && <Image source={{ uri: `https://flagcdn.com/w40/${hCode}.png` }} style={styles.miniFlag} />}
            <Text style={styles.teamText} numberOfLines={1}>{tTeam(team1)}</Text>
          </View>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.kickoffTime}>{localTime}</Text>
        </View>
        <View style={[styles.teamCol, { alignItems: 'flex-end' }]}>
          <View style={[styles.team, { justifyContent: 'flex-end' }]}>
            <Text style={[styles.teamText, { textAlign: 'right' }]} numberOfLines={1}>{tTeam(team2)}</Text>
            {aCode && <Image source={{ uri: `https://flagcdn.com/w40/${aCode}.png` }} style={styles.miniFlag} />}
          </View>
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
  scoreRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  teamCol: { flex: 1, flexDirection: 'column' },
  team: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  miniFlag: { width: 24, height: 16, borderRadius: 3 },
  eventItemHome: { color: 'rgba(255,255,255,0.65)', fontSize: 11, paddingVertical: 3 },
  eventItemAway: { color: 'rgba(255,255,255,0.65)', fontSize: 11, paddingVertical: 3, textAlign: 'right' },
  scoreBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 90 },
  scoreText: { color: '#f5a623', fontSize: 24, fontWeight: '900', width: 34, textAlign: 'center' },
  vs: { color: '#484f58', marginHorizontal: 6, fontSize: 18 },
  penaltiesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  penaltiesBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 90 },
  penaltiesLabel: { color: '#8b949e', fontSize: 10, fontWeight: '700', marginRight: 4 },
  penaltyScore: { color: '#f5a623', fontSize: 16, fontWeight: '900', width: 34, textAlign: 'center' },
  awardsCard: { backgroundColor: 'rgba(245, 166, 35, 0.05)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.2)' },
  awardsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  awardsTitle: { color: '#f5a623', fontSize: 18, fontWeight: '800' },
  awardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(245, 166, 35, 0.1)' },
  awardLabel: { color: '#8b949e', fontSize: 15 },
  awardVal: { color: '#fff', fontSize: 15, fontWeight: '700' },
  standingsContainer: { marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 },
  standingsTitle: { color: '#f5a623', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
  standingsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  standingsRowQualifier: { backgroundColor: 'rgba(245,166,35,0.04)', borderRadius: 6 },
  standingsCell: { color: '#8b949e', fontSize: 12, fontWeight: '600', width: 28, textAlign: 'center' },
  standingsCellPos: { width: 26 },
  standingsTeamText: { color: '#ccc', fontSize: 12, fontWeight: '600', flex: 1 },
  standingsPts: { color: '#fff', fontWeight: '800', fontSize: 13 },
  standingsQualifierText: { color: '#f5a623' },
  gdPositive: { color: '#10b981' },
  gdNegative: { color: '#ef4444' },
  calendarContainer: { },
  calendarNav: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  calendarNavBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  calendarNavBtnDisabled: { opacity: 0.3 },
  calendarNavText: { color: '#f5a623', fontWeight: '700', fontSize: 13 },
  calendarNavTextDisabled: { color: '#484f58' },
  calendarDayGroup: { marginBottom: 8 },
  dateHeader: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', marginTop: 4 },
  dateHeaderText: { color: '#8b949e', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  dateHeaderTextToday: { color: '#f5a623' },
  kickoffTime: { color: '#8b949e', fontSize: 14, fontWeight: '700' },
});

