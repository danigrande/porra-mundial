import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preference, setPreference] = useState<'all' | 'mentions' | 'none'>('all');
  const auth = getAuth();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!auth) return;
    try {
      const response = await api.getProfile(auth.phone);
      if (response && response.notificationPreference) {
        setPreference(response.notificationPreference);
      }
    } catch (error) {
      console.error('Error cargando preferencias:', error);
    } finally {
      setLoading(false);
    }
  };

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleUpdatePreference = async (newPref: 'all' | 'mentions' | 'none') => {
    if (!auth || saving) return;
    setSaving(true);
    setPreference(newPref);

    try {
      const currentProfile = await api.getProfile(auth.phone);
      
      const updatedProfile = {
        ...currentProfile,
        notificationPreference: newPref
      };

      await api.updateProfile(auth.phone, auth.currentGroup || '', updatedProfile);
      
      // Mostrar Toast personalizado
      setToastMessage(`Ajustes actualizados: ${
        newPref === 'all' ? 'Todas' : newPref === 'mentions' ? 'Solo menciones' : 'Silenciado'
      }`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

    } catch (error) {
      Alert.alert('Error', 'No se pudieron guardar tus preferencias');
      setPreference(preference); // Revertir si falla
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Notificaciones</Text>
          <Text style={styles.subtitle}>Configura cómo quieres recibir los avisos del chat del grupo.</Text>
        </View>

        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={[styles.optionCard, preference === 'all' && styles.selectedCard]}
            onPress={() => handleUpdatePreference('all')}
            activeOpacity={0.7}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#3b82f620' }]}>
                <MaterialIcons name="notifications-active" size={24} color="#3b82f6" />
              </View>
              {preference === 'all' && (
                <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
              )}
            </View>
            <Text style={styles.optionTitle}>Todas las notificaciones</Text>
            <Text style={styles.optionDescription}>
              Recibirás un aviso push por cada mensaje que se envíe al chat de tu grupo.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.optionCard, preference === 'mentions' && styles.selectedCard]}
            onPress={() => handleUpdatePreference('mentions')}
            activeOpacity={0.7}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#f5a62320' }]}>
                <MaterialIcons name="alternate-email" size={24} color="#f5a623" />
              </View>
              {preference === 'mentions' && (
                <Ionicons name="checkmark-circle" size={24} color="#f5a623" />
              )}
            </View>
            <Text style={styles.optionTitle}>Solo si me mencionan</Text>
            <Text style={styles.optionDescription}>
              El chat se silenciará. Solo recibirás avisos si alguien usa @{auth?.name || 'tu_nombre'} o @todos.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.optionCard, preference === 'none' && styles.selectedCard]}
            onPress={() => handleUpdatePreference('none')}
            activeOpacity={0.7}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#ef444420' }]}>
                <MaterialIcons name="notifications-off" size={24} color="#ef4444" />
              </View>
              {preference === 'none' && (
                <Ionicons name="checkmark-circle" size={24} color="#ef4444" />
              )}
            </View>
            <Text style={styles.optionTitle}>Silenciar totalmente</Text>
            <Text style={styles.optionDescription}>
              No recibirás ninguna notificación push de este chat, ni siquiera por menciones.
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color="#64748b" />
          <Text style={styles.infoText}>
            Incluso si silencias el chat, seguirás viendo todos los mensajes nuevos al entrar en la aplicación.
          </Text>
        </View>
      </ScrollView>

      {/* Toast Animado */}
      {showToast && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.savingText}>Guardando...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  content: { padding: 20, paddingTop: 40 },
  header: { marginBottom: 32 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0e27', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#64748b', fontSize: 16, marginTop: 8, lineHeight: 22 },
  optionsContainer: { gap: 16 },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  selectedCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: '#3b82f6',
  },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  iconContainer: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  optionDescription: { color: '#94a3b8', fontSize: 14, lineHeight: 20 },
  infoBox: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.02)', 
    padding: 16, 
    borderRadius: 16, 
    marginTop: 32,
    alignItems: 'center',
    gap: 12
  },
  infoText: { flex: 1, color: '#64748b', fontSize: 13, lineHeight: 18 },
  savingOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  savingText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
