import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as api from '../../services/api';
import { useTranslation } from '../../i18n/i18n';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code' | 'admin' | 'success'>('email');
  const [resetToken, setResetToken] = useState('');
  const [adminGroups, setAdminGroups] = useState<{ groupName: string; admin: { name: string; email: string } }[]>([]);

  async function handleSendCode() {
    if (!email.trim()) {
      Alert.alert(t('common.error'), 'Introduce tu email');
      return;
    }
    setLoading(true);
    try {
      const result = await api.forgotPassword(email.trim().toLowerCase());

      if (result.method === 'email') {
        setResetToken(result.token);
        setStep('code');
      } else if (result.method === 'admin') {
        setAdminGroups(result.groups || []);
        setStep('admin');
      } else {
        Alert.alert(t('auth.code_sent'), t('auth.check_email', { email: email.trim() }));
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!code || code.length !== 6) {
      Alert.alert(t('common.error'), t('auth.enter_code'));
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(t('common.error'), t('profile.password_min_length') || 'Mínimo 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('profile.password_mismatch') || 'No coinciden');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(resetToken, code, newPassword);
      setStep('success');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.reset_error'));
    } finally {
      setLoading(false);
    }
  }

  function handleBackToLogin() {
    router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.trophy}>🔐</Text>
          <Text style={styles.title}>{t('auth.forgot_password_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.forgot_password_subtitle')}</Text>
        </View>

        {/* STEP 1: Email */}
        {step === 'email' && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={t('auth.email_placeholder') || 'Email'}
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>{t('auth.send_reset_code')}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Code + New Password */}
        {step === 'code' && (
          <View style={styles.form}>
            <Text style={styles.infoText}>{t('auth.check_email', { email })}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('auth.code_placeholder')}
              placeholderTextColor="#666"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder={t('auth.new_password') || 'Nueva contraseña (mín. 8 caracteres)'}
              placeholderTextColor="#666"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder={t('auth.confirm_new_password') || 'Confirmar nueva contraseña'}
              placeholderTextColor="#666"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>{t('auth.reset_password')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => setStep('email')}>
              <Text style={styles.linkText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Admin Contact */}
        {step === 'admin' && (
          <View style={styles.form}>
            <Text style={styles.infoText}>{t('auth.contact_admin_desc')}</Text>

            {adminGroups.map((g, i) => (
              <View key={i} style={styles.adminCard}>
                <Text style={styles.groupLabel}>{g.groupName}</Text>
                <Text style={styles.adminName}>{t('auth.admin_name', { name: g.admin.name })}</Text>
                <Text style={styles.adminEmail}>{t('auth.admin_email', { email: g.admin.email })}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.button} onPress={handleBackToLogin}>
              <Text style={styles.buttonText}>{t('auth.back_to_login')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Success */}
        {step === 'success' && (
          <View style={styles.form}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>{t('auth.password_reset_success')}</Text>
            <Text style={styles.successMsg}>{t('auth.password_reset_success_msg')}</Text>

            <TouchableOpacity style={styles.button} onPress={handleBackToLogin}>
              <Text style={styles.buttonText}>{t('auth.back_to_login')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  trophy: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  form: { gap: 14 },
  input: {
    backgroundColor: '#151a3a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  button: {
    backgroundColor: '#1e40af',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkButton: { padding: 12, alignItems: 'center', marginTop: 4 },
  linkText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  infoText: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  adminCard: {
    backgroundColor: '#151a3a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e2a5a',
    marginBottom: 12,
  },
  groupLabel: { color: '#f5a623', fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  adminName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  adminEmail: { color: '#64748b', fontSize: 14, marginTop: 2 },
  successIcon: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  successTitle: { color: '#10b981', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  successMsg: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
