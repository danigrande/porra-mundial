import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { FIXTURE_GROUPS, getGroupMatches } from '../../constants/tournamentData';
import TournamentBanner from '../../components/TournamentBanner';

export default function PredictionsScreen() {
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';
  const phone = auth?.phone || '';
  const playerName = auth?.name || '';

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
      return `${pos}º Grupo ${letter}`;
    }

    // Mejores terceros
    if (code.startsWith('3')) return 'Mejor 3º';

    // Ganador/Perdedor de partido: "W73"
    const matchRef = code.match(/^([WL])(\d+)$/);
    if (matchRef) {
      const type = matchRef[1];
      const num = matchRef[2];
      return `${type === 'W' ? 'Ganador' : 'Perdedor'} #${num}`;
    }

    return code;
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
        Alert.alert('Error', 'No se pudieron cargar los datos');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [groupName, phone]);

  const matchesToDisplay = useMemo(() => {
    const group = FIXTURE_GROUPS.find(g => g.letter === selectedGroup);
    if (group) return getGroupMatches(group);

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
      Alert.alert('¡Guardado!', 'Tus predicciones han sido guardadas con éxito.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Hubo un problema al guardar');
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
                Grupo {g.letter}
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
              🏆 PREMIOS
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista de Partidos o Premios */}
      <ScrollView contentContainerStyle={styles.matchesList} keyboardShouldPersistTaps="handled">
        {selectedGroup === 'PREMIOS' ? (
          <View style={styles.awardsContainer}>
            <Text style={styles.awardsTitle}>Tus Pronósticos Individuales</Text>
            <Text style={styles.awardsSubtitle}>Elige a los mejores del torneo para ganar puntos extra.</Text>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>⚽ Balón de Oro (Mejor Jugador)</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['ball_gold'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, ball_gold: v})}
                placeholder="Nombre del crack..."
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>⚪ Balón de Plata</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['ball_silver'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, ball_silver: v})}
                placeholder="Segundo mejor..."
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>🟤 Balón de Bronce</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['ball_bronze'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, ball_bronze: v})}
                placeholder="Tercer mejor..."
                placeholderTextColor="#475569"
              />
            </View>

            <View style={{ height: 30 }} />

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>👟 Bota de Oro (Máximo Goleador)</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['boot_gold'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, boot_gold: v})}
                placeholder="Pichichi..."
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>🥈 Bota de Plata</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['boot_silver'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, boot_silver: v})}
                placeholder="Segundo goleador..."
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.awardInputBox}>
              <Text style={styles.awardLabel}>🥉 Bota de Bronce</Text>
              <TextInput 
                style={styles.awardTextInput} 
                value={predictions['boot_bronze'] || ''} 
                onChangeText={(v) => setPredictions({...predictions, boot_bronze: v})}
                placeholder="Tercer goleador..."
                placeholderTextColor="#475569"
              />
            </View>
          </View>
        ) : (
          matchesToDisplay.map((match: any) => {
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
          })
        )}
      </ScrollView>

      {/* Footer Fijo para Guardar */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>💾 Guardar Todo</Text>}
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
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
  }
});
