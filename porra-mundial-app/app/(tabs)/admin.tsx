import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth } from '../../stores/authStore';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as api from '../../services/api';

export default function AdminHub() {
  const router = useRouter();
  const auth = getAuth();

  const handleReset = () => {
    Alert.alert(
      "Resetear Grupo",
      "¿Estás seguro? Se borrarán TODAS las predicciones y se reiniciará el torneo para este grupo. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Resetear", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.resetGroup(auth?.currentGroup || '');
              Alert.alert("Éxito", "El grupo ha sido reseteado correctamente.");
            } catch (e) {
              Alert.alert("Error", "No se pudo resetear el grupo.");
            }
          }
        }
      ]
    );
  };

  if (!auth?.isAdmin) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed" size={64} color="#1e2a5a" />
        <Text style={styles.noAccess}>Acceso Restringido</Text>
        <Text style={styles.noAccessDesc}>Solo los administradores del grupo pueden ver esta sección.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel de Control</Text>
        <Text style={styles.subtitle}>Gestión total de {auth.currentGroup}</Text>
      </View>

      <View style={styles.grid}>
        
        {/* SISTEMA DE PUNTUACIÓN (points_system.html) */}
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={() => router.push('/(admin)/scoring')}
        >
          <View style={[styles.iconContainer, {backgroundColor: 'rgba(245, 166, 35, 0.1)'}]}>
            <MaterialCommunityIcons name="calculator-variant" size={32} color="#f5a623" />
          </View>
          <Text style={styles.menuTitle}>Reglas de Puntuación</Text>
          <Text style={styles.menuDesc}>Configura cuánto vale cada acierto y el modo de juego.</Text>
        </TouchableOpacity>

        {/* GESTIÓN DE MIEMBROS (scoring_criteria.html) */}
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={() => router.push('/(admin)/members')}
        >
          <View style={[styles.iconContainer, {backgroundColor: 'rgba(59, 130, 246, 0.1)'}]}>
            <Ionicons name="people" size={32} color="#3b82f6" />
          </View>
          <Text style={styles.menuTitle}>Gestión de Miembros</Text>
          <Text style={styles.menuDesc}>Añade jugadores, quita miembros o vincula WhatsApp.</Text>
        </TouchableOpacity>

        {/* RESET DE TEST (danger zone) */}
        <TouchableOpacity 
          style={[styles.menuItem, { borderColor: 'rgba(239, 68, 68, 0.2)' }]} 
          onPress={handleReset}
        >
          <View style={[styles.iconContainer, {backgroundColor: 'rgba(239, 68, 68, 0.1)'}]}>
            <MaterialCommunityIcons name="refresh-circle" size={32} color="#ef4444" />
          </View>
          <Text style={[styles.menuTitle, { color: '#ef4444' }]}>Zona de Pruebas: Reset</Text>
          <Text style={styles.menuDesc}>Borra todas las predicciones y reinicia el Mundial (Solo para testing).</Text>
        </TouchableOpacity>

      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Eres el administrador de este grupo.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e27', padding: 40 },
  header: { marginBottom: 30 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 16, marginTop: 4 },
  grid: { gap: 20 },
  menuItem: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  iconContainer: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  menuTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  menuDesc: { color: '#94a3b8', fontSize: 14, lineHeight: 20 },
  noAccess: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 20 },
  noAccessDesc: { color: '#64748b', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  footer: { marginTop: 40, alignItems: 'center', paddingBottom: 20 },
  footerText: { color: '#475569', fontSize: 12, fontStyle: 'italic' }
});
