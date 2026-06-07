import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as api from '../../services/api';
import { getAuth, saveAuth } from '../../stores/authStore';
import { useTranslation } from '../../i18n/i18n';

export default function ForcePasswordChange() {
  const router = useRouter();
  const { t } = useTranslation();
  const auth = getAuth();

  const [oldPassword, setOldPassword] = useState(auth?.password || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  async function handleChange() {
    if (!auth) return;
    if (!oldPassword) {
      Alert.alert(t('common.error'), t('password_change.current_required'));
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(t('common.error'), t('password_change.length_error'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('password_change.mismatch'));
      return;
    }

    setChanging(true);
    try {
      await api.changePassword(auth.userId, oldPassword, newPassword);
      await saveAuth({ ...auth, password: newPassword, mustChangePassword: false });
      Alert.alert(t('common.success'), t('password_change.success'));
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setChanging(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>{t('password_change.title')}</Text>
        <Text style={styles.subtitle}>{t('password_change.subtitle')}</Text>

        <Text style={styles.label}>{t('password_change.current_password')}</Text>
        <TextInput
          style={styles.input}
          value={oldPassword}
          onChangeText={setOldPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#64748b"
        />

        <Text style={styles.label}>{t('password_change.new_password')}</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder={t('password_change.new_placeholder')}
          placeholderTextColor="#64748b"
        />

        <Text style={styles.label}>{t('password_change.confirm_password')}</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder={t('password_change.confirm_placeholder')}
          placeholderTextColor="#64748b"
        />

        <TouchableOpacity
          style={[styles.button, changing && styles.buttonDisabled]}
          onPress={handleChange}
          disabled={changing}
        >
          {changing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t('password_change.button')}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
