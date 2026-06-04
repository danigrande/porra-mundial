import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, saveAuth, logout, setCurrentGroup } from '../../stores/authStore';
import * as api from '../../services/api';
import * as biometric from '../../services/biometric';
import * as socketService from '../../services/socket';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/i18n';

export default function ProfileScreen() {
  const router = useRouter();
  const auth = getAuth();
  const { t } = useTranslation();
  
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
  // Localized labels for each humor option (ids remain in Spanish for backend)
  const humorLabels: Record<string, string> = {
    'Sarcástico y mordaz': t('profile.humor_sarcastic'),
    'Divertido y amigable': t('profile.humor_friendly'),
    'Épico y motivador': t('profile.humor_epic'),
    'Analítico y serio': t('profile.humor_analytical'),
    'Troll total': t('profile.humor_troll'),
  };

  // AI Personality State
  const [aiPersonality, setAiPersonality] = useState('andres_montes');
  const [showPersonalityMenu, setShowPersonalityMenu] = useState(false);
  const personalityOptions = [
    { id: 'andres_montes', nameKey: 'profile.personality_andres', icon: '🇪🇸' },
    { id: 'pedrerol', nameKey: 'profile.personality_pedrerol', icon: '🇪🇸' },
    { id: 'roncero', nameKey: 'profile.personality_roncero', icon: '🇪🇸' },
    { id: 'darth_vader', nameKey: 'profile.personality_vader', icon: '🇬🇧' },
    { id: 'trump', nameKey: 'profile.personality_trump', icon: '🇬🇧' }
  ];

  // Biometric State
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!auth || !auth.userId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    Promise.all([
      api.getProfile(auth.userId),
      biometric.isAvailable(),
      biometric.has(),
    ]).then(([profile, bioAvail, bioHas]) => {
      setNickname(profile.nickname || auth.name);
      setHumorStyle(profile.humor_style || 'Divertido y amigable');
      setAiPersonality(profile.ai_personality || 'andres_montes');
      setLikes((profile.likes || []).join(', '));
      setDislikes((profile.dislikes || []).join(', '));
      setBiometricAvailable(bioAvail);
      setBiometricEnabled(!!auth.biometricEnabled);
    })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [auth]);

  async function handleSave() {
    if (!auth) return;
    if (!auth.userId) {
      Alert.alert('Sesión expirada', 'Por favor, inicia sesión de nuevo');
      router.replace('/(auth)/login');
      return;
    }
    setSaving(true);
    
    try {
      const likesArray = likes.split(',').map(s => s.trim()).filter(Boolean);
      const dislikesArray = dislikes.split(',').map(s => s.trim()).filter(Boolean);
      
      await api.updateProfile(auth.userId, auth.currentGroup, {
        nickname,
        humor_style: humorStyle,
        ai_personality: aiPersonality,
        likes: likesArray,
        dislikes: dislikesArray,
      }, auth.email);
      
      Alert.alert(t('profile.saved_title'), t('profile.saved_msg'));
    } catch (e: any) {
      if (e.message?.includes('Falta identificador')) {
        Alert.alert('Sesión expirada', 'Por favor, inicia sesión de nuevo');
        router.replace('/(auth)/login');
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!auth) return;
    if (newPassword.length < 8) {
      Alert.alert(t('common.error'), t('profile.password_min_length') || 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('profile.password_mismatch') || 'Las contraseñas no coinciden');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(auth.userId, oldPassword, newPassword);
      // Update persisted password so socket can re-auth
      await saveAuth({ ...auth, password: newPassword });
      Alert.alert(t('common.success'), t('profile.password_updated') || '¡Contraseña actualizada!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (!auth) return;
    
    Alert.alert(
      t('profile.delete_title'),
      t('profile.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('profile.delete_action'), 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.deleteAccount(auth.userId);
              await logout();
              router.replace('/(auth)/login');
            } catch (e: any) {
              setLoading(false);
              Alert.alert(t('common.error'), t('profile.delete_error') + e.message);
            }
          }
        }
      ]
    );
  }

  async function handleToggleBiometric() {
    if (!auth) return;
    if (biometricEnabled) {
      await biometric.clear();
      await saveAuth({ ...auth, biometricEnabled: false });
      setBiometricEnabled(false);
      Alert.alert('Desactivado', 'El acceso biométrico se ha desactivado.');
    } else {
      const bioType = await biometric.getBiometricType();
      const saved = await biometric.save(auth.email, auth.password, auth.currentGroup);
      if (!saved) {
        Alert.alert('Error', `No se pudo configurar ${bioType}. Intenta de nuevo más tarde.`);
        return;
      }
      await saveAuth({ ...auth, biometricEnabled: true });
      setBiometricEnabled(true);
      Alert.alert('Activado', `Ahora puedes iniciar sesión con ${bioType}.`);
    }
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
          <Text style={styles.userPhone}>{auth?.email}</Text>
        </View>

        {/* CONFIGURACIÓN IA */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="robot" size={24} color="#3b82f6" />
            <View style={{marginLeft: 12}}>
              <Text style={styles.cardTitle}>{t('profile.ai_config_title')}</Text>
              <Text style={styles.cardSubtitle}>{t('profile.ai_config_subtitle')}</Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('profile.nickname_label')}</Text>
            <TextInput 
              style={styles.input} 
              value={nickname} 
              onChangeText={setNickname}
              placeholder={t('profile.nickname_placeholder')}
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('profile.humor_label')}</Text>
            <TouchableOpacity 
              style={styles.comboTrigger}
              onPress={() => setShowHumorMenu(!showHumorMenu)}
            >
              <Text style={styles.comboTriggerText}>
                {humorOptions.find(o => o.id === humorStyle)?.icon || '😊'} {humorLabels[humorStyle] || humorStyle}
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
                      {humorLabels[option.id] || option.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('profile.personality_label')}</Text>
            <TouchableOpacity 
              style={styles.comboTrigger}
              onPress={() => setShowPersonalityMenu(!showPersonalityMenu)}
            >
              <Text style={styles.comboTriggerText}>
                {personalityOptions.find(o => o.id === aiPersonality)?.icon || '🇪🇸'} {t(personalityOptions.find(o => o.id === aiPersonality)?.nameKey || '')}
              </Text>
              <Ionicons name={showPersonalityMenu ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
            </TouchableOpacity>

            {showPersonalityMenu && (
              <View style={styles.comboMenu}>
                {personalityOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.comboItem,
                      aiPersonality === option.id && styles.comboItemActive
                    ]}
                    onPress={() => {
                      setAiPersonality(option.id);
                      setShowPersonalityMenu(false);
                    }}
                  >
                    <Text style={styles.comboItemIcon}>{option.icon}</Text>
                    <Text style={[
                      styles.comboItemText,
                      aiPersonality === option.id && styles.comboItemTextActive
                    ]}>
                      {t(option.nameKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('profile.likes_label')}</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={likes} 
              onChangeText={setLikes}
              placeholder={t('profile.likes_placeholder')}
              placeholderTextColor="#64748b"
              multiline
            />
            <Text style={styles.hint}>{t('profile.likes_hint')}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('profile.dislikes_label')}</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={dislikes} 
              onChangeText={setDislikes}
              placeholder={t('profile.dislikes_placeholder')}
              placeholderTextColor="#64748b"
              multiline
            />
            <Text style={styles.hint}>{t('profile.dislikes_hint')}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.buttonDisabled]} 
            onPress={handleSave} 
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{t('profile.save_profile')}</Text>}
          </TouchableOpacity>
        </View>

        {/* ACCESO BIOMÉTRICO */}
        {biometricAvailable && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="finger-print" size={24} color="#10b981" />
              <View style={{marginLeft: 12}}>
                <Text style={styles.cardTitle}>Acceso biométrico</Text>
                <Text style={styles.cardSubtitle}>Inicia sesión con tu huella o FaceID</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.biometricRow, biometricEnabled && styles.biometricRowActive]}
              onPress={handleToggleBiometric}
            >
              <Ionicons
                name={biometricEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={biometricEnabled ? '#10b981' : '#64748b'}
              />
              <Text style={[styles.biometricText, biometricEnabled && styles.biometricTextActive]}>
                {biometricEnabled ? 'Activado' : 'Activar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CAMBIO DE CONTRASEÑA */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome5 name="lock" size={20} color="#f59e0b" />
            <View style={{marginLeft: 12}}>
              <Text style={styles.cardTitle}>{t('profile.security_title')}</Text>
              <Text style={styles.cardSubtitle}>{t('profile.security_subtitle')}</Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('profile.current_password') || 'Contraseña actual'}</Text>
            <TextInput 
              style={styles.input} 
              value={oldPassword} 
              onChangeText={setOldPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, {flex: 1, marginRight: 8}]}>
              <Text style={styles.label}>{t('profile.new_password') || 'Nueva contraseña'}</Text>
              <TextInput 
                style={styles.input} 
                value={newPassword} 
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#64748b"
              />
            </View>
            <View style={[styles.formGroup, {flex: 1, marginLeft: 8}]}>
              <Text style={styles.label}>{t('profile.confirm_password') || 'Confirmar'}</Text>
              <TextInput 
                style={styles.input} 
                value={confirmPassword} 
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.pinButton, changingPassword && styles.buttonDisabled]} 
            onPress={handleChangePassword} 
            disabled={changingPassword}
          >
            {changingPassword ? <ActivityIndicator color="#f59e0b" /> : <Text style={styles.pinButtonText}>{t('profile.update_password') || 'Actualizar contraseña'}</Text>}
          </TouchableOpacity>
        </View>
        
        {/* BOTÓN ELIMINAR CUENTA (Requisito Apple) */}
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={styles.deleteButtonText}>{t('profile.delete_account')}</Text>
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
  biometricRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  biometricRowActive: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)' },
  biometricText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  biometricTextActive: { color: '#10b981' },
});
