import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as api from '../../services/api';
import * as biometric from '../../services/biometric';
import { saveAuth } from '../../stores/authStore';
import { connect } from '../../services/socket';
import { useTranslation } from '../../i18n/i18n';
import LanguageSwitcher from '../../components/LanguageSwitcher';

const TERMS_URL = 'https://porra-mundial.onrender.com/legal/terms';
const PRIVACY_URL = 'https://porra-mundial.onrender.com/legal/privacy';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Shared fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [groupName, setGroupName] = useState('');
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Login multi-step
  const [emailVerified, setEmailVerified]     = useState(false);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  // ==========================================
  // LOGIN LOGIC
  // ==========================================

  async function handleVerifyEmail() {
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('auth.no_email_error') || 'Por favor, introduce tu email');
      return;
    }
    setLoading(true);
    try {
      const user = await api.getUserByEmail(email.trim().toLowerCase());

      if (!user || !user.groups || user.groups.length === 0) {
        throw new Error(t('auth.no_groups_error') || 'No se encontró ningún grupo para este usuario');
      }

      setAvailableGroups(user.groups);
      setGroupName(user.groups[0]);
      setEmailVerified(true);
    } catch (error: any) {
      Alert.alert(t('auth.not_found') || 'No encontrado', error.message || t('auth.user_not_found') || 'Usuario no encontrado');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!password) {
      Alert.alert(t('common.error'), t('auth.enter_password_error') || 'Por favor, introduce tu contraseña');
      return;
    }
    setLoading(true);
    try {
      const result = await api.login(email.trim().toLowerCase(), password, groupName);

      const authData = {
        userId: result.userId,
        email: email.trim().toLowerCase(),
        password,
        name: result.name,
        currentGroup: groupName,
        groups: availableGroups,
        isAdmin: result.isAdmin,
      };

      connect(email.trim().toLowerCase(), password);

      const bioAvailable = await biometric.isAvailable();
      if (bioAvailable) {
        const bioType = await biometric.getBiometricType();
        Alert.alert(
          '🔐 Acceso biométrico',
          `¿Quieres activar ${bioType} para iniciar sesión automáticamente la próxima vez?`,
          [
            {
              text: 'Ahora no',
              onPress: async () => {
                await saveAuth(authData);
                router.replace('/(tabs)');
              }
            },
            {
              text: 'Activar',
              onPress: async () => {
                const saved = await biometric.save(authData.email, authData.password, authData.currentGroup);
                await saveAuth({ ...authData, biometricEnabled: true });
                if (!saved) {
                  Alert.alert('Aviso', 'La biometría se activó pero el auto-login no estará disponible. Para desbloquear, usa tu huella/FaceID al abrir la app.');
                }
                router.replace('/(tabs)');
              }
            },
          ]
        );
      } else {
        await saveAuth(authData);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.bad_credentials') || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // REGISTER LOGIC
  // ==========================================

  async function handleRegister() {
    if (!email || !password || !name || !groupName) {
      Alert.alert(t('common.error'), t('auth.fill_all_fields') || 'Por favor, rellena todos los campos');
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('common.error'), t('auth.password_min_length') || 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!acceptedTerms) {
      Alert.alert('EULA', t('auth.must_accept_terms') || 'Debes aceptar los términos y condiciones');
      return;
    }
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      await api.register(name, cleanEmail, password, groupName, isNewGroup);
      const result = await api.login(cleanEmail, password, groupName);
      const user   = await api.getUserByEmail(cleanEmail);

      await saveAuth({
        userId: result.userId,
        email: cleanEmail,
        password,
        name: result.name || name,
        currentGroup: groupName,
        groups: user.groups || [groupName],
        isAdmin: result.isAdmin || isNewGroup,
      });

      connect(cleanEmail, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.register_error') || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // UI RENDERING
  // ==========================================

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
          <View style={{ marginTop: 12 }}>
            <LanguageSwitcher />
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => { setMode('login'); setEmailVerified(false); }}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>{t('auth.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'register' && styles.tabActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>{t('auth.register')}</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder={t('auth.name_placeholder')}
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder={t('auth.email_placeholder') || 'Email'}
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!emailVerified || mode === 'register'}
          />

          {/* LOGIN FLOW - STEP 1 (Verify Email) */}
          {mode === 'login' && !emailVerified && (
            <>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyEmail}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>{t('auth.next_arrow') || 'Siguiente →'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={styles.forgotLinkText}>{t('auth.forgot_password')}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* LOGIN FLOW - STEP 2 (Select Group & Enter Password) */}
          {mode === 'login' && emailVerified && (
            <>
              {availableGroups.length > 1 && (
                <View style={styles.groupPickerContainer}>
                  <Text style={styles.pickerLabel}>{t('auth.select_group') || 'Selecciona tu grupo'}</Text>
                  <View style={styles.groupList}>
                    {availableGroups.map(g => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.groupPill, groupName === g && styles.groupPillActive]}
                        onPress={() => setGroupName(g)}
                      >
                        <Text style={[styles.groupPillText, groupName === g && styles.groupPillTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {availableGroups.length === 1 && (
                <Text style={styles.singleGroupInfo}>
                  {t('auth.single_group') || 'Grupo:'} <Text style={styles.bold}>{availableGroups[0]}</Text>
                </Text>
              )}

              <TextInput
                style={styles.input}
                placeholder={t('auth.password_placeholder') || 'Contraseña'}
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
              />

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setEmailVerified(false)}>
                  <Text style={styles.backButtonText}>{t('common.back') || '← Volver'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.flex1, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.buttonText}>{t('auth.enter') || 'Entrar'}</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* REGISTER FLOW */}
          {mode === 'register' && (
            <>
              <TextInput
                style={styles.input}
                placeholder={t('auth.group_placeholder') || 'Nombre del grupo'}
                placeholderTextColor="#666"
                value={groupName}
                onChangeText={setGroupName}
              />

              <TextInput
                style={styles.input}
                placeholder={t('auth.password_create') || 'Contraseña (mín. 8 caracteres)'}
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setIsNewGroup(!isNewGroup)}
              >
                <View style={[styles.checkbox, isNewGroup && styles.checkboxActive]}>
                  {isNewGroup && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>{t('auth.new_group') || 'Crear grupo nuevo'}</Text>
              </TouchableOpacity>

              {/* EULA (Apple Requirement) */}
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive, { borderColor: '#10b981' }]}>
                  {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                  <Text style={styles.checkLabel}>{t('auth.accept_terms_prefix')} </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                    <Text style={[styles.checkLabel, { color: '#3b82f6', textDecorationLine: 'underline' }]}>{t('auth.terms_of_use')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.checkLabel}> {t('auth.and_the')} </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                    <Text style={[styles.checkLabel, { color: '#3b82f6', textDecorationLine: 'underline' }]}>{t('auth.privacy_policy')}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>{t('auth.register_button')}</Text>}
              </TouchableOpacity>

              <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 15, paddingHorizontal: 20 }}>
                {t('auth.apple_disclaimer')}
              </Text>
            </>
          )}

        </View>
        <Text style={styles.footer}>{t('auth.footer')}</Text>
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} style={{ marginTop: 8 }}>
          <Text style={[styles.footer, { color: '#3b82f6', textDecorationLine: 'underline' }]}>{t('auth.privacy_policy')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  trophy: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 18,
    color: '#f5a623',
    fontWeight: '600',
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#151a3a',
    borderRadius: 12,
    marginBottom: 24,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#1e40af',
  },
  tabText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  form: {
    gap: 14,
  },
  input: {
    backgroundColor: '#151a3a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#1e40af',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkLabel: {
    color: '#ccc',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#1e40af',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  backButton: {
    padding: 16,
    marginTop: 8,
    backgroundColor: '#151a3a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  backButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  singleGroupInfo: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 4,
  },
  bold: {
    color: '#fff',
    fontWeight: 'bold',
  },
  groupPickerContainer: {
    marginVertical: 4,
  },
  pickerLabel: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  groupList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupPill: {
    backgroundColor: '#151a3a',
    borderWidth: 1,
    borderColor: '#1e2a5a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  groupPillActive: {
    backgroundColor: '#1e40af',
    borderColor: '#3b82f6',
  },
  groupPillText: {
    color: '#aaa',
    fontWeight: '600',
  },
  groupPillTextActive: {
    color: '#fff',
  },
  forgotLink: {
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  forgotLinkText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    color: '#555',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
  },
});
