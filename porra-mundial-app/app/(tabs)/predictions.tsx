import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { FIXTURE_GROUPS, getGroupMatches, getGroupStandings, TEAM_CODES } from '../../constants/tournamentData';
import TournamentBanner from '../../components/TournamentBanner';
import { useTranslation, tTeam } from '../../i18n/i18n';

export default function PredictionsScreen() {
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';
  const phone = auth?.phone || '';
  const playerName = auth?.name || '';

  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<any>(null);
  
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [predictions, setPredictions] = useState<Record<string, string>>({});

  // --- LÓGICA DE RESOLUCIÓN DE EQUIPOS ---
  const resolveTeamName = (code: string) => {
    if (!code) return 'TBD';
    
    // Grupo: "1A"
    const groupMatch = code.match(/^([1-2])([A-L])$/);
    if (groupMatch) {
      const letter = groupMatch[2];
      const pos = parseInt(groupMatch[1]);
      // Necesitaríamos calcular la clasificación del grupo según las predicciones del usuario
      // Por ahora, para simplificar y no meter todo el scoring engine aquí, 
      // si es 1A devolvemos "1º Grupo A" o el nombre si es fácil de sacar.
      return t('predictions.group_position', { pos, letter });
    }

    // Mejores terceros
    if (code.startsWith('3')) return t('predictions.best_third');

    // Ganador/Perdedor de partido: "W73"
    const matchRef = code.match(/^([WL])(\d+)$/);
    if (matchRef) {
      const type = matchRef[1];
      const num = matchRef[2];
      return type === 'W' ? t('predictions.winner_of', { num }) : t('predictions.loser_of', { num });
    }

    return tTeam(code);
  };

  useEffect(() => {
    if (!groupName || !phone) return;
    
    setLoading(true);
    Promise.all([
      api.getMyPredictions(groupName, phone),
      api.getTournamentState(groupName)
    ])
      .then(([predData, stateData]) => {
        setPredictions(predData || {});
        setState(stateData);
      })
      .catch(e => {
        console.error(e);
        Alert.alert(t('common.error'), t('predictions.load_error'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [groupName, phone]);

  const matchesToDisplay = useMemo(() => {
    const group = FIXTURE_GROUPS.find(g => g.letter === selectedGroup);
    if (group) {
      return getGroupMatches(group).map((m: any) => ({
        ...m,
        team1: tTeam(m.team1),
        team2: tTeam(m.team2)
      }));
    }

    const koPhase = state?.knockoutBracket?.find((kb: any) => kb.id === selectedGroup);
    if (koPhase) {
      return koPhase.matches.map((mId: number) => {
        const teams = state?.bracketMatches?.[mId] || ['TBD', 'TBD'];
        return {
          id: `ko_${mId}`,
          team1: resolveTeamName(teams[0]),
          team2: resolveTeamName(teams[1])
        };
      });
    }

    return [];
  }, [selectedGroup, state, predictions]);

  const handleScoreChange = (matchId: string, teamIndex: 1 | 2, text: string) => {
    const value = text.replace(/[^0-9]/g, '').substring(0, 2);
    const key = `${matchId}_${teamIndex === 1 ? 'h' : 'a'}`;
    
    setPredictions(prev => {
      const next = { ...prev };
      if (value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.savePredictions(playerName, groupName, predictions);
      Alert.alert(t('predictions.saved_title'), t('predictions.saved_msg'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('predictions.save_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      
      <TournamentBanner state={state} />

      {/* Selector de Grupos y Fases Horizontal */}
      <View style={styles.groupSelectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupScroll}>
          {FIXTURE_GROUPS.map(g => (
            <TouchableOpacity
              key={g.letter}
              style={[styles.groupTab, selectedGroup === g.letter && styles.groupTabActive]}
              onPress={() => setSelectedGroup(g.letter)}
            >
              <Text style={[styles.groupTabText, selectedGroup === g.letter && styles.groupTabTextActive]}>
                {t('predictions.group_prefix')} {g.letter}
              </Text>
            </TouchableOpacity>
          ))}
          {state?.knockoutBracket?.map((kb: any) => (
            <TouchableOpacity
              key={kb.id}
              style={[styles.groupTab, selectedGroup === kb.id && styles.groupTabActive, { backgroundColor: '#1e40af22' }]}
              onPress={() => setSelectedGroup(kb.id)}
            >
              <Text style={[styles.groupTabText, selectedGroup === kb.id && styles.groupTabTextActive, { color: '#f5a623' }]}>
                {kb.name}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* NUEVA PESTAÑA DE PREMIOS */}
          <TouchableOpacity
            style={[styles.groupTab, selectedGroup === 'PREMIOS' && styles.groupTabActive, { borderColor: '#f5a623' }]}
            onPress={() => setSelectedGroup('PREMIOS')}
          >
            <Text style={[styles.groupTabText, selectedGroup === 'PREMIOS' && styles.groupTabTextActive, { color: '#f5a623' }]}>
              {t('predictions.awards_tab')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista de Partidos o Premios */}
      <ScrollView contentContainerStyle={styles.matchesList} keyboardShouldPersistTaps="handled">
        {selectedGroup === 'PREMIOS' ? (
          <View style={styles.awardsContainer}>
            <Text style={styles.awardsTitle}>{t('predictions.awards_title')}</Text>
            <Text style={styles.awardsSubtitle}>{t('predictions.awards_subtitle')}</Text>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>{t('predictions.golden_ball')}</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['ball_gold'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, ball_gold: v})}
                placeholder={t('predictions.golden_ball_placeholder')}
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>{t('predictions.silver_ball')}</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['ball_silver'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, ball_silver: v})}
                placeholder={t('predictions.silver_ball_placeholder')}
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>{t('predictions.bronze_ball')}</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['ball_bronze'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, ball_bronze: v})}
                placeholder={t('predictions.bronze_ball_placeholder')}
                placeholderTextColor="#475569"
              />
            </View>

            <View style={{ height: 30 }} />

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>{t('predictions.golden_boot')}</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['boot_gold'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, boot_gold: v})}
                placeholder={t('predictions.golden_boot_placeholder')}
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>{t('predictions.silver_boot')}</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['boot_silver'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, boot_silver: v})}
                placeholder={t('predictions.silver_boot_placeholder')}
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>{t('predictions.bronze_boot')}</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['boot_bronze'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, boot_bronze: v})}
                placeholder={t('predictions.bronze_boot_placeholder')}
                placeholderTextColor="#475569"
              />
            </View>
          </View>
        ) : (
          <>
            {matchesToDisplay.map((match: any) => {
              const score1 = predictions[`${match.id}_h`] || '';
              const score2 = predictions[`${match.id}_a`] || '';

              return (
                <View key={match.id} style={styles.matchCard}>
                  <View style={styles.teamContainer}>
                    <Text style={styles.teamText} numberOfLines={2}>{match.team1}</Text>
                  </View>
                  
                  <View style={styles.scoreContainer}>
                    <TextInput
                      style={styles.scoreInput}
                      keyboardType="number-pad"
                      value={score1}
                      onChangeText={(text) => handleScoreChange(match.id, 1, text)}
                      placeholder="-"
                      placeholderTextColor="#666"
                    />
                    <Text style={styles.vsText}>-</Text>
                    <TextInput
                      style={styles.scoreInput}
                      keyboardType="number-pad"
                      value={score2}
                      onChangeText={(text) => handleScoreChange(match.id, 2, text)}
                      placeholder="-"
                      placeholderTextColor="#666"
                    />
                  </View>

                  <View style={styles.teamContainerRight}>
                    <Text style={styles.teamTextRight} numberOfLines={2}>{match.team2}</Text>
                  </View>
                </View>
              );
            })}
            
            {FIXTURE_GROUPS.some(g => g.letter === selectedGroup) && (
              <StandingsTable letter={selectedGroup} reality={predictions} />
            )}
          </>
        )}
      </ScrollView>

      {/* Footer Fijo para Guardar */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{t('predictions.save_all')}</Text>}
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}

function StandingsTable({ letter, reality }: { letter: string; reality: any }) {
  const rows = getGroupStandings(letter, reality);
  const hasAnyData = rows.some(r => r.pts > 0 || r.w > 0 || r.d > 0 || r.l > 0);
  if (!hasAnyData) return null;

  return (
    <View style={styles.standingsContainer}>
      <Text style={styles.standingsTitle}>CLASIFICACIÓN PROYECTADA</Text>
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
  groupSelectorContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e2a5a',
    backgroundColor: '#0a0e27',
  },
  groupScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  groupTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#151a3a',
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  groupTabActive: {
    backgroundColor: '#1e40af',
    borderColor: '#3b82f6',
  },
  groupTabText: {
    color: '#888',
    fontWeight: '600',
  },
  groupTabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  matchesList: {
    padding: 16,
    paddingBottom: 100, // Espacio para el footer
    gap: 12,
  },
  matchCard: {
    flexDirection: 'row',
    backgroundColor: '#151a3a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  teamContainer: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  teamContainerRight: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 12,
  },
  teamText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  teamTextRight: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  scoreInput: {
    color: '#f5a623',
    fontSize: 20,
    fontWeight: 'bold',
    width: 32,
    textAlign: 'center',
    paddingVertical: 4,
  },
  vsText: {
    color: '#666',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0a0e27',
    borderTopWidth: 1,
    borderTopColor: '#1e2a5a',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  saveButton: {
    backgroundColor: '#1e40af',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  awardsContainer: {
    paddingBottom: 20,
  },
  awardsTitle: {
    color: '#f5a623',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  awardsSubtitle: {
    color: '#8b949e',
    fontSize: 13,
    marginBottom: 24,
  },
  awardInputBox: {
    marginBottom: 16,
  },
  awardLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  awardTextInput: {
    backgroundColor: '#151a3a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  miniFlag: { width: 24, height: 16, borderRadius: 3 },
  standingsContainer: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  standingsTitle: { color: '#f5a623', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase', textAlign: 'center' },
  standingsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  standingsRowQualifier: { backgroundColor: 'rgba(245,166,35,0.04)', borderRadius: 6 },
  standingsCell: { color: '#8b949e', fontSize: 12, fontWeight: '600', width: 28, textAlign: 'center' },
  standingsCellPos: { width: 26 },
  standingsTeamText: { color: '#ccc', fontSize: 12, fontWeight: '600', flex: 1 },
  standingsPts: { color: '#fff', fontWeight: '800', fontSize: 13 },
  standingsQualifierText: { color: '#f5a623' },
  gdPositive: { color: '#10b981' },
  gdNegative: { color: '#ef4444' }
});
