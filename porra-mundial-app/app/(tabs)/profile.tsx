import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, logout, setCurrentGroup } from '../../stores/authStore';
import * as api from '../../services/api';
import * as socketService from '../../services/socket';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const auth = getAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile State
  const [nickname, setNickname] = useState('');
  const [humorStyle, setHumorStyle] = useState('Divertido y amigable');
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  
  // UI State
  const [showHumorMenu, setShowHumorMenu] = useState(false);
  const humorOptions = [
    { id: 'Sarcástico y mordaz', icon: '🎭' },
    { id: 'Divertido y amigable', icon: '😊' },
    { id: 'Épico y motivador', icon: '🔥' },
    { id: 'Analítico y serio', icon: '📊' },
    { id: 'Troll total', icon: '😈' }
  ];

  // PIN Change State
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);

  useEffect(() => {
    if (!auth) return;
    
    setLoading(true);
    api.getProfile(auth.phone)
      .then(data => {
        setNickname(data.nickname || auth.name);
        setHumorStyle(data.humor_style || 'Divertido y amigable');
        setLikes((data.likes || []).join(', '));
        setDislikes((data.dislikes || []).join(', '));
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [auth]);

  async function handleSave() {
    if (!auth) return;
    setSaving(true);
    
    try {
      const likesArray = likes.split(',').map(s => s.trim()).filter(Boolean);
      const dislikesArray = dislikes.split(',').map(s => s.trim()).filter(Boolean);
      
      await api.updateProfile(auth.phone, auth.currentGroup, {
        nickname,
        humor_style: humorStyle,
        likes: likesArray,
        dislikes: dislikesArray,
      });
      
      Alert.alert('¡Perfil Guardado!', 'El Agente Mundial ya conoce tus nuevos gustos.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePin() {
    if (!auth) return;
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      Alert.alert('Error', 'El nuevo PIN debe ser de 4 números');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Error', 'Los nuevos PINs no coinciden');
      return;
    }

    setChangingPin(true);
    try {
      await api.changePin(auth.phone, auth.currentGroup, oldPin, newPin);
      Alert.alert('Éxito', 'PIN actualizado correctamente.');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setChangingPin(false);
    }
  }

  async function handleDeleteAccount() {
    if (!auth) return;
    
    Alert.alert(
      '⚠️ ELIMINAR CUENTA',
      '¿Estás COMPLETAMENTE seguro? Esta acción no se puede deshacer y perderás todos tus puntos y predicciones.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'SÍ, BORRAR TODO', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.deleteAccount(auth.phone);
              await logout();
              router.replace('/(auth)/login');
            } catch (e: any) {
              setLoading(false);
              Alert.alert('Error', 'No se pudo eliminar la cuenta: ' + e.message);
            }
          }
        }
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f5a623" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Header Perfil */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{auth?.name?.charAt(0).toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.editAvatar}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{auth?.name}</Text>
          <Text style={styles.userPhone}>+{auth?.phone}</Text>
        </View>

        {/* CONFIGURACIÓN IA */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="robot" size={24} color="#3b82f6" />
            <View style={{marginLeft: 12}}>
              <Text style={styles.cardTitle}>Configura tu Perfil IA</Text>
              <Text style={styles.cardSubtitle}>Personaliza cómo interactúa el Agente contigo</Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nickname (Cómo te llamará la IA)</Text>
            <TextInput 
              style={styles.input} 
              value={nickname} 
              onChangeText={setNickname}
              placeholder="Ej: El Gurú del Mundial"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Estilo de Humor de la IA</Text>
            <TouchableOpacity 
              style={styles.comboTrigger}
              onPress={() => setShowHumorMenu(!showHumorMenu)}
            >
              <Text style={styles.comboTriggerText}>
                {humorOptions.find(o => o.id === humorStyle)?.icon || '😊'} {humorStyle}
              </Text>
              <Ionicons name={showHumorMenu ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
            </TouchableOpacity>

            {showHumorMenu && (
              <View style={styles.comboMenu}>
                {humorOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.comboItem,
                      humorStyle === option.id && styles.comboItemActive
                    ]}
                    onPress={() => {
                      setHumorStyle(option.id);
                      setShowHumorMenu(false);
                    }}
                  >
                    <Text style={styles.comboItemIcon}>{option.icon}</Text>
                    <Text style={[
                      styles.comboItemText,
                      humorStyle === option.id && styles.comboItemTextActive
                    ]}>
                      {option.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Cosas que te gustan</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={likes} 
              onChangeText={setLikes}
              placeholder="Ej: Real Madrid, goles de chilena..."
              placeholderTextColor="#64748b"
              multiline
            />
            <Text style={styles.hint}>La IA te felicitará cuando algo de esto ocurra.</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Cosas que NO te gustan</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={dislikes} 
              onChangeText={setDislikes}
              placeholder="Ej: El VAR, perder tiempo..."
              placeholderTextColor="#64748b"
              multiline
            />
            <Text style={styles.hint}>La IA se burlará de ti o te dará ánimos.</Text>
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.buttonDisabled]} 
            onPress={handleSave} 
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Perfil IA</Text>}
          </TouchableOpacity>
        </View>

        {/* CAMBIO DE PIN */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome5 name="lock" size={20} color="#f59e0b" />
            <View style={{marginLeft: 12}}>
              <Text style={styles.cardTitle}>Seguridad - Cambiar PIN</Text>
              <Text style={styles.cardSubtitle}>Actualiza tu código de acceso de 4 dígitos</Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>PIN Actual</Text>
            <TextInput 
              style={styles.input} 
              value={oldPin} 
              onChangeText={setOldPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, {flex: 1, marginRight: 8}]}>
              <Text style={styles.label}>Nuevo PIN</Text>
              <TextInput 
                style={styles.input} 
                value={newPin} 
                onChangeText={setNewPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="••••"
                placeholderTextColor="#64748b"
              />
            </View>
            <View style={[styles.formGroup, {flex: 1, marginLeft: 8}]}>
              <Text style={styles.label}>Confirmar</Text>
              <TextInput 
                style={styles.input} 
                value={confirmPin} 
                onChangeText={setConfirmPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="••••"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.pinButton, changingPin && styles.buttonDisabled]} 
            onPress={handleChangePin} 
            disabled={changingPin}
          >
            {changingPin ? <ActivityIndicator color="#f59e0b" /> : <Text style={styles.pinButtonText}>Actualizar PIN</Text>}
          </TouchableOpacity>
        </View>
        
        {/* BOTÓN ELIMINAR CUENTA (Requisito Apple) */}
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={styles.deleteButtonText}>Eliminar mi cuenta definitivamente</Text>
        </TouchableOpacity>

        <View style={{height: 40}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e27' },
  content: { padding: 20 },
  profileHeader: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1e40af', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#3b82f6' },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  editAvatar: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3b82f6', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0a0e27' },
  userName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  userPhone: { fontSize: 14, color: '#64748b', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#f5a623', fontSize: 16, fontWeight: '700', marginLeft: 8, textTransform: 'uppercase' },
  groupsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  groupChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  groupChipActive: { backgroundColor: '#1e40af', borderColor: '#3b82f6' },
  groupChipText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  groupChipTextActive: { color: '#fff' },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardSubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  formGroup: { marginBottom: 16 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  textArea: { height: 80, textAlignVertical: 'top' },
  comboTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  comboTriggerText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  comboMenu: { backgroundColor: '#151a3a', marginTop: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  comboItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  comboItemActive: { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  comboItemIcon: { fontSize: 18, marginRight: 12 },
  comboItemText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  comboItemTextActive: { color: '#3b82f6' },
  hint: { color: '#475569', fontSize: 11, marginTop: 4, marginLeft: 4, fontStyle: 'italic' },
  saveButton: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row' },
  pinButton: { backgroundColor: 'transparent', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#f59e0b' },
  pinButtonText: { color: '#f59e0b', fontSize: 16, fontWeight: '800' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(239, 68, 68, 0.1)' },
  deleteButtonText: { color: '#ef4444', fontSize: 14, fontWeight: '600', marginLeft: 8 },
});
