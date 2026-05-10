import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { FIXTURE_GROUPS, getGroupMatches } from '../../constants/fixtures';

export default function PredictionsScreen() {
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';
  const phone = auth?.phone || '';
  const playerName = auth?.name || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [predictions, setPredictions] = useState<Record<string, string>>({}); // {"gA_m0_h": "4", "gA_m0_a": "5"}

  useEffect(() => {
    if (!groupName || !phone) return;
    
    setLoading(true);
    api.getMyPredictions(groupName, phone)
      .then(data => {
        setPredictions(data || {});
      })
      .catch(e => {
        console.error(e);
        Alert.alert('Error', 'No se pudieron cargar tus predicciones');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [groupName, phone]);

  const matchesToDisplay = useMemo(() => {
    const group = FIXTURE_GROUPS.find(g => g.letter === selectedGroup);
    if (!group) return [];
    return getGroupMatches(group);
  }, [selectedGroup]);

  const handleScoreChange = (matchId: string, teamIndex: 1 | 2, text: string) => {
    // Solo permitimos números
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
      
      {/* Selector de Grupos Horizontal */}
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
        </ScrollView>
      </View>

      {/* Lista de Partidos */}
      <ScrollView contentContainerStyle={styles.matchesList} keyboardShouldPersistTaps="handled">
        {matchesToDisplay.map(match => {
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
  }
});
