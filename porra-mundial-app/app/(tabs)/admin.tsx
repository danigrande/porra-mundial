import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AdminScreen() {
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';
  const router = useRouter();

  // Si no es admin, redirigir
  useEffect(() => {
    if (!auth?.isAdmin) {
      router.replace('/(tabs)');
    }
  }, [auth]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Record<string, number>>({});
  const [predictionMode, setPredictionMode] = useState('full'); // 'full' o 'restricted'

  useEffect(() => {
    if (!groupName || !auth?.isAdmin) return;
    
    setLoading(true);
    api.getGroupRules(groupName)
      .then(data => {
        // Inicializamos con unos valores por defecto si viene vacío
        const initialRules = Object.keys(data || {}).length > 0 ? data : {
          PTS_EXACT_SCORE: 5,
          PTS_WIN_DIFFERENCE: 3,
          PTS_WIN_ONLY: 2,
          PTS_TIE_NOT_EXACT: 3
        };
        setRules(initialRules);
        // predictionMode no viene en rules, habría que adaptarlo, lo omitimos o hardcodeamos para V1
      })
      .catch(e => {
        console.error(e);
        Alert.alert('Error', 'No se pudieron cargar las reglas');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [groupName]);

  const handleRuleChange = (key: string, value: string) => {
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    setRules(prev => ({ ...prev, [key]: num }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveGroupRules(groupName, rules, predictionMode);
      Alert.alert('¡Guardado!', 'Las reglas del grupo han sido actualizadas.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Hubo un problema al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !auth?.isAdmin) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.headerCard}>
          <Ionicons name="settings" size={32} color="#fff" />
          <Text style={styles.headerTitle}>Panel de Administración</Text>
          <Text style={styles.headerSubtitle}>{groupName}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reglas de Puntuación</Text>
          <Text style={styles.sectionDesc}>Configura los puntos otorgados por cada tipo de acierto.</Text>

          {Object.entries(rules).map(([key, value]) => (
            <View key={key} style={styles.inputGroup}>
              <Text style={styles.label}>{formatRuleName(key)}</Text>
              <TextInput
                style={styles.input}
                value={value.toString()}
                onChangeText={(text) => handleRuleChange(key, text)}
                keyboardType="number-pad"
              />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Aviso', 'El simulador avanzado está disponible en el Dashboard Web.')}>
            <Ionicons name="football" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Simulador de Partidos</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Footer Fijo para Guardar */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>💾 Guardar Reglas</Text>}
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}

// Helper para poner nombres bonitos
function formatRuleName(key: string) {
  const map: Record<string, string> = {
    'PTS_EXACT_SCORE': 'Puntos por Resultado Exacto',
    'PTS_WIN_DIFFERENCE': 'Puntos por Acertar Diferencia',
    'PTS_WIN_ONLY': 'Puntos por Acertar Ganador',
    'PTS_TIE_NOT_EXACT': 'Puntos por Empate (no exacto)'
  };
  return map[key] || key;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e27' },
  scroll: { padding: 20, paddingBottom: 100 },
  headerCard: {
    backgroundColor: '#1e40af',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 10 },
  headerSubtitle: { color: '#bfdbfe', fontSize: 16, marginTop: 5 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  sectionDesc: { color: '#9ca3af', fontSize: 14, marginBottom: 20 },
  inputGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 10,
    borderRadius: 8,
  },
  label: { color: '#e5e7eb', fontSize: 16, flex: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    width: 60,
    textAlign: 'center',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#1e40af',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
