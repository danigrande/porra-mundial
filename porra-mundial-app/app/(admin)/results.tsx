import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function ResultsManagement() {
  const router = useRouter();
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';

  const [loading, setLoading] = useState(true);
  const [reality, setReality] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchReality();
  }, []);

  async function fetchReality() {
    try {
      const res = await api.getReality();
      setReality(res || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.saveReality(reality);
      Alert.alert('Éxito', 'Resultados oficiales actualizados.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSimulate(matchId: string, hName: string, aName: string) {
    try {
      const res = await api.simulateMatch(matchId, hName, aName);
      if (res.status === 'success') {
        setReality(res.results);
        Alert.alert('Simulado', `Resultado inyectado para ${hName} vs ${aName}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  const updateScore = (id: string, val: string) => {
    setReality({ ...reality, [id]: val });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Control de Resultados', headerTintColor: '#fff', headerStyle: { backgroundColor: '#0a0e27' } }} />
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <Text style={styles.infoText}>
            Lo que pongas aquí es la "Realidad Oficial". Afecta a todos los rankings y puntuaciones.
          </Text>
        </View>

        {/* Simplificación: Solo Grupo A para la demo, igual que fixture_testing.html pero adaptado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grupo A - Partidos Oficiales</Text>
          <MatchRow 
            matchId="gA_m0" hName="México" aName="Sudáfrica" 
            reality={reality} onUpdate={updateScore} onSimulate={handleSimulate}
          />
          <MatchRow 
            matchId="gA_m1" hName="Corea del Sur" aName="Rep. Checa" 
            reality={reality} onUpdate={updateScore} onSimulate={handleSimulate}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premios Individuales</Text>
          
          <AwardInput 
            label="⚽ Balón de Oro" id="ball_gold" 
            value={reality['ball_gold']} onUpdate={updateScore} 
          />
          <AwardInput 
            label="⚪ Balón de Plata" id="ball_silver" 
            value={reality['ball_silver']} onUpdate={updateScore} 
          />
          <AwardInput 
            label="🟤 Balón de Bronce" id="ball_bronze" 
            value={reality['ball_bronze']} onUpdate={updateScore} 
          />

          <View style={{ height: 20 }} />

          <AwardInput 
            label="👟 Bota de Oro" id="boot_gold" 
            value={reality['boot_gold']} onUpdate={updateScore} 
          />
          <AwardInput 
            label="🥈 Bota de Plata" id="boot_silver" 
            value={reality['boot_silver']} onUpdate={updateScore} 
          />
          <AwardInput 
            label="🥉 Bota de Bronce" id="boot_bronze" 
            value={reality['boot_bronze']} onUpdate={updateScore} 
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.buttonDisabled]} 
          onPress={handleSave} 
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Resultados</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.resetButton} 
          onPress={() => Alert.alert('Reset', '¿Seguro que quieres borrar todos los resultados de prueba?', [{text: 'No'}, {text: 'Si', onPress: () => setReality({}) }])}
        >
          <Text style={styles.resetButtonText}>Limpiar Realidad (Reset)</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function AwardInput({ label, id, value, onUpdate }: any) {
  return (
    <View style={styles.awardInputRow}>
      <Text style={styles.awardInputLabel}>{label}</Text>
      <TextInput 
        style={styles.awardInput} 
        value={value || ''} 
        onChangeText={(v) => onUpdate(id, v)}
        placeholder="Nombre del jugador..."
        placeholderTextColor="#475569"
      />
    </View>
  );
}

function MatchRow({ matchId, hName, aName, reality, onUpdate, onSimulate }: any) {
  const hScore = reality[`${matchId}_h`] || '';
  const aScore = reality[`${matchId}_a`] || '';

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <Text style={styles.matchId}>{matchId.toUpperCase()}</Text>
        <TouchableOpacity onPress={() => onSimulate(matchId, hName, aName)}>
          <MaterialCommunityIcons name="dice-5" size={24} color="#f5a623" />
        </TouchableOpacity>
      </View>
      <View style={styles.scoreRow}>
        <Text style={styles.teamName}>{hName}</Text>
        <TextInput 
          style={styles.scoreInput} 
          value={String(hScore)} 
          onChangeText={(v) => onUpdate(`${matchId}_h`, v)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#475569"
        />
        <Text style={styles.vs}>-</Text>
        <TextInput 
          style={styles.scoreInput} 
          value={String(aScore)} 
          onChangeText={(v) => onUpdate(`${matchId}_a`, v)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#475569"
        />
        <Text style={styles.teamName}>{aName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  infoBox: { flexDirection: 'row', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 12, borderRadius: 12, marginBottom: 20, alignItems: 'center' },
  infoText: { color: '#3b82f6', fontSize: 13, flex: 1, marginLeft: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#f5a623', fontSize: 16, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase' },
  matchCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  matchId: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  teamName: { color: '#fff', fontSize: 14, flex: 1, textAlign: 'center' },
  scoreInput: { backgroundColor: 'rgba(0,0,0,0.3)', width: 45, height: 45, borderRadius: 8, color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: '800', marginHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  vs: { color: '#64748b', fontSize: 20 },
  saveButton: { backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  resetButton: { padding: 16, alignItems: 'center', marginTop: 10 },
  resetButtonText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  awardInputRow: { marginBottom: 12 },
  awardInputLabel: { color: '#8b949e', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  awardInput: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
});
