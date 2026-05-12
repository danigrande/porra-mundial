import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as api from '../../services/api';
import { saveAuth } from '../../stores/authStore';
import { connect } from '../../services/socket';

// URL de los términos legales (cambiar a tu dominio real)
const TERMS_URL = 'https://tu-app.onrender.com/legal/terms';
const PRIVACY_URL = 'https://tu-app.onrender.com/legal/privacy';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login State
  const [prefix, setPrefix] = useState('34');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isNewGroup, setIsNewGroup] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // ==========================================
  // LOGIN LOGIC
  // ==========================================

  async function handleVerifyPhone() {
    if (!phone) {
      Alert.alert('Error', 'Introduce tu número de teléfono');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `${prefix}${phone}`;
      const user = await api.getUserByPhone(fullPhone);
      
      if (!user || !user.groups || user.groups.length === 0) {
        throw new Error('No tienes ningún grupo. Ve a la pestaña Registrarse.');
      }
      
      setAvailableGroups(user.groups);
      setGroupName(user.groups[0]); // Auto-select the first one
      setPhoneVerified(true);
    } catch (error: any) {
      Alert.alert('No encontrado', error.message || 'Usuario no encontrado');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!pin) {
      Alert.alert('Error', 'Introduce tu PIN');
      return;
    }
    setLoading(true);
    const fullPhone = `${prefix}${phone}`;
    
    try {
      const result = await api.login(fullPhone, pin, groupName);

      await saveAuth({
        phone: fullPhone,
        pin,
        name: result.name,
        currentGroup: groupName,
        groups: availableGroups,
        isAdmin: result.isAdmin,
      });

      connect(fullPhone, pin);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // REGISTER LOGIC
  // ==========================================

  async function handleRegister() {
    if (!phone || !pin || !name || !groupName) {
      Alert.alert('Error', 'Rellena todos los campos');
      return;
    }
    if (pin.length !== 4) {
      Alert.alert('Error', 'El PIN debe tener 4 dígitos');
      return;
    }
    if (!acceptedTerms) {
      Alert.alert('EULA', 'Debes aceptar los términos y condiciones de uso para continuar.');
      return;
    }
    setLoading(true);
    const fullPhone = `${prefix}${phone}`;

    try {
      await api.register(name, fullPhone, pin, groupName, isNewGroup);
      const result = await api.login(fullPhone, pin, groupName);
      const user = await api.getUserByPhone(fullPhone);

      await saveAuth({
        phone: fullPhone,
        pin,
        name: result.name || name,
        currentGroup: groupName,
        groups: user.groups || [groupName],
        isAdmin: result.isAdmin || isNewGroup,
      });

      connect(fullPhone, pin);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al registrarse');
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
          <Text style={styles.title}>Predicción Mundial</Text>
          <Text style={styles.subtitle}>2026 — Pronósticos entre amigos</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => { setMode('login'); setPhoneVerified(false); }}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'register' && styles.tabActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Registrarse</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          
          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Tu nombre (ej: Edu)"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          {/* Phone Input with Prefix */}
          <View style={styles.phoneContainer}>
            <Text style={styles.plusSign}>+</Text>
            <TextInput
              style={[styles.input, styles.prefixInput]}
              value={prefix}
              onChangeText={setPrefix}
              keyboardType="number-pad"
              maxLength={3}
              editable={!phoneVerified || mode === 'register'}
            />
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="Teléfono (ej: 612345678)"
              placeholderTextColor="#666"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!phoneVerified || mode === 'register'}
            />
          </View>

          {/* LOGIN FLOW - STEP 1 (Verify Phone) */}
          {mode === 'login' && !phoneVerified && (
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyPhone}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Siguiente ➔</Text>}
            </TouchableOpacity>
          )}

          {/* LOGIN FLOW - STEP 2 (Select Group & Enter PIN) */}
          {mode === 'login' && phoneVerified && (
            <>
              {availableGroups.length > 1 && (
                <View style={styles.groupPickerContainer}>
                  <Text style={styles.pickerLabel}>Selecciona tu grupo:</Text>
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
                 <Text style={styles.singleGroupInfo}>Grupo: <Text style={styles.bold}>{availableGroups[0]}</Text></Text>
              )}

              <TextInput
                style={styles.input}
                placeholder="PIN (4 dígitos)"
                placeholderTextColor="#666"
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
              />

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setPhoneVerified(false)}>
                  <Text style={styles.backButtonText}>Atrás</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.flex1, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>⚽ Entrar</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* REGISTER FLOW */}
          {mode === 'register' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nombre del grupo a unirse/crear"
                placeholderTextColor="#666"
                value={groupName}
                onChangeText={setGroupName}
              />

              <TextInput
                style={styles.input}
                placeholder="Crea un PIN (4 dígitos)"
                placeholderTextColor="#666"
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setIsNewGroup(!isNewGroup)}
              >
                <View style={[styles.checkbox, isNewGroup && styles.checkboxActive]}>
                  {isNewGroup && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>Es un grupo nuevo</Text>
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
                  <Text style={styles.checkLabel}>Acepto los </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                    <Text style={[styles.checkLabel, { color: '#3b82f6', textDecorationLine: 'underline' }]}>términos de uso</Text>
                  </TouchableOpacity>
                  <Text style={styles.checkLabel}> y la </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                    <Text style={[styles.checkLabel, { color: '#3b82f6', textDecorationLine: 'underline' }]}>política de privacidad</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>🎉 Registrarse</Text>}
              </TouchableOpacity>
            </>
          )}

        </View>
        <Text style={styles.footer}>Predicción Mundial 🏆 — Sin dinero real</Text>
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} style={{ marginTop: 8 }}>
          <Text style={[styles.footer, { color: '#3b82f6', textDecorationLine: 'underline' }]}>Política de Privacidad</Text>
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
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plusSign: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  prefixInput: {
    width: 60,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  phoneInput: {
    flex: 1,
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
  footer: {
    color: '#555',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
  },
});

