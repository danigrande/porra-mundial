import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function AdminScreen() {
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';
  const router = useRouter();

  // Redirigir si no es admin
  useEffect(() => {
    if (!auth?.isAdmin) {
      router.replace('/(tabs)');
    }
  }, [auth]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Reglas del grupo
  const [rules, setRules] = useState<Record<string, number>>({});
  const [predictionMode, setPredictionMode] = useState('A');

  useEffect(() => {
    if (!groupName || !auth?.isAdmin) return;
    
    setLoading(true);
    api.getGroupRules(groupName)
      .then(data => {
        // Mapeo de datos desde el backend
        const rulesData = data || {};
        setPredictionMode(rulesData.predictionMode || rulesData.prediction_mode || 'A');
        
        // Extraer solo las reglas numéricas (pts_...)
        const initialRules: Record<string, number> = {};
        const ruleKeys = [
          'pts_group_sign', 'pts_group_diff', 'pts_group_exact', 'pts_group_pos', 'pts_group_qualify',
          'pts_ko_sign', 'pts_ko_diff', 'pts_ko_exact', 'pts_ko_qualify',
          'pts_honor_champ', 'pts_honor_runner', 'pts_honor_third',
          'pts_award_gold', 'pts_award_silver', 'pts_award_bronze'
        ];

        ruleKeys.forEach(key => {
          initialRules[key] = rulesData[key] !== undefined ? Number(rulesData[key]) : 10;
        });
        
        setRules(initialRules);
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
      Alert.alert('¡Guardado!', 'El sistema de puntuación ha sido actualizado.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Hubo un problema al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !auth?.isAdmin) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
      </View>
    );
  }

  const RuleSection = ({ title, subtitle, icon, color, keys }: { title: string, subtitle: string, icon: any, color: string, keys: string[] }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: color }]}>
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      
      <View style={styles.rulesList}>
        {keys.map(key => (
          <View key={key} style={styles.ruleItem}>
            <View style={styles.ruleInfo}>
              <Text style={styles.ruleLabel}>{formatRuleName(key)}</Text>
              <Text style={styles.ruleDesc}>{getRuleDesc(key)}</Text>
            </View>
            <TextInput
              style={styles.ruleInput}
              value={rules[key]?.toString() || '0'}
              onChangeText={(text) => handleRuleChange(key, text)}
              keyboardType="number-pad"
            />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sistema de Puntuación</Text>
          <Text style={styles.subtitle}>Configura cómo se ganan los puntos en {groupName}</Text>
        </View>

        {/* MODO DE PREDICCIÓN */}
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#3b82f6' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#3b82f6' }]}>
              <Ionicons name="options" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Modo de Predicción</Text>
              <Text style={styles.cardSubtitle}>Elige cómo se jugará la competición</Text>
            </View>
          </View>

          <View style={styles.modeContainer}>
            <TouchableOpacity 
              style={[styles.modeOption, predictionMode === 'A' && styles.modeOptionActive]}
              onPress={() => setPredictionMode('A')}
            >
              <View style={styles.radio}>
                {predictionMode === 'A' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>Opción A: Torneo Completo</Text>
                <Text style={styles.modeDesc}>Se rellena todo el cuadro antes del inicio.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modeOption, predictionMode === 'B' && styles.modeOptionActive]}
              onPress={() => setPredictionMode('B')}
            >
              <View style={styles.radio}>
                {predictionMode === 'B' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>Opción B: Por Fases (Dinámico)</Text>
                <Text style={styles.modeDesc}>Las predicciones se abren ronda a ronda.</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* FASE DE GRUPOS */}
        <RuleSection 
          title="Fase de Grupos"
          subtitle="Puntos en la fase inicial"
          icon="apps"
          color="#10b981"
          keys={['pts_group_sign', 'pts_group_diff', 'pts_group_exact', 'pts_group_pos', 'pts_group_qualify']}
        />

        {/* ELIMINATORIAS */}
        <RuleSection 
          title="Rondas Eliminatorias"
          subtitle="Desde Dieciseisavos a la Final"
          icon="trophy"
          color="#f59e0b"
          keys={['pts_ko_sign', 'pts_ko_diff', 'pts_ko_exact', 'pts_ko_qualify']}
        />

        {/* CUADRO DE HONOR */}
        <RuleSection 
          title="Cuadro de Honor"
          subtitle="Premios finales del Mundial"
          icon="medal"
          color="#8b5cf6"
          keys={['pts_honor_champ', 'pts_honor_runner', 'pts_honor_third', 'pts_award_gold', 'pts_award_silver', 'pts_award_bronze']}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer Fijo */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <View style={styles.saveBtnContent}>
              <Ionicons name="cloud-upload" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Guardar Configuración</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}

function formatRuleName(key: string) {
  const map: Record<string, string> = {
    'pts_group_sign': 'Signo 1X2',
    'pts_group_diff': 'Diferencia de Goles',
    'pts_group_exact': 'Resultado Exacto',
    'pts_group_pos': 'Posición en Grupo',
    'pts_group_qualify': 'Clasificar 16vos',
    'pts_ko_sign': 'Signo 1X2 KO',
    'pts_ko_diff': 'Diferencia KO',
    'pts_ko_exact': 'Resultado Exacto KO',
    'pts_ko_qualify': 'Pasar de Ronda KO',
    'pts_honor_champ': 'Campeón',
    'pts_honor_runner': 'Subcampeón',
    'pts_honor_third': '3º Puesto',
    'pts_award_gold': 'Bota de Oro',
    'pts_award_silver': 'Bota de Plata',
    'pts_award_bronze': 'Bota de Bronce'
  };
  return map[key] || key;
}

function getRuleDesc(key: string) {
  const map: Record<string, string> = {
    'pts_group_sign': 'Acertar ganador o empate',
    'pts_group_diff': 'Acertar diferencia exacta',
    'pts_group_pos': 'Acertar 1º, 2º, 3º o 4º',
    'pts_group_qualify': 'Pasar a la siguiente fase',
    'pts_ko_qualify': 'Acertar quién avanza'
  };
  return map[key] || '';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e27' },
  scroll: { padding: 16, paddingBottom: 120 },
  header: { marginBottom: 24, marginTop: 10 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cardSubtitle: { color: '#64748b', fontSize: 12 },
  modeContainer: { gap: 12 },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  modeInfo: { flex: 1 },
  modeName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modeDesc: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  rulesList: { gap: 1 },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  ruleInfo: { flex: 1 },
  ruleLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  ruleDesc: { color: '#64748b', fontSize: 11, marginTop: 2 },
  ruleInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#f5a623',
    width: 50, height: 40,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10, 14, 39, 0.95)',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnContent: { flexDirection: 'row', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
