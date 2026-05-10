import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, logout, setCurrentGroup } from '../../stores/authStore';
import * as api from '../../services/api';
import * as socketService from '../../services/socket';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

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

  async function handleLogout() {
    socketService.disconnect();
    await logout();
    router.replace('/(auth)/login');
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
              placeholder="Ej: El Mago de la Porra"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Estilo de Humor de la IA</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={humorStyle}
                onValueChange={(itemValue) => setHumorStyle(itemValue)}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="Sarcástico y mordaz" value="Sarcástico y mordaz" color="#fff" />
                <Picker.Item label="Divertido y amigable" value="Divertido y amigable" color="#fff" />
                <Picker.Item label="Épico y motivador" value="Épico y motivador" color="#fff" />
                <Picker.Item label="Analítico y serio" value="Analítico y serio" color="#fff" />
                <Picker.Item label="Troll total 😈" value="Troll total" color="#fff" />
              </Picker>
            </View>
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

        {/* LOGOUT */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
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
  pickerContainer: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  picker: { color: '#fff', height: 50 },
  hint: { color: '#475569', fontSize: 11, marginTop: 4, marginLeft: 4, fontStyle: 'italic' },
  saveButton: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row' },
  pinButton: { backgroundColor: 'transparent', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#f59e0b' },
  pinButtonText: { color: '#f59e0b', fontSize: 16, fontWeight: '800' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 10 },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '800', marginLeft: 8 },
});
