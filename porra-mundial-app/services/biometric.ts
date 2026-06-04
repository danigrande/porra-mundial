import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CREDENTIALS_KEY = 'porra_biometric_credentials';
const CREDENTIALS_KEY_ASYNC = 'porra_biometric_credentials_async';

async function secureStoreAvailable(): Promise<boolean> {
  try {
    await SecureStore.setItemAsync('__test__', 'test');
    await SecureStore.deleteItemAsync('__test__');
    return true;
  } catch {
    return false;
  }
}

export async function isAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricType(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'huella';
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'FaceID';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
    return 'biometría';
  } catch {
    return 'biometría';
  }
}

export async function save(email: string, password: string, groupName: string): Promise<boolean> {
  const data = JSON.stringify({ email, password, groupName });
  const secureOk = await (async () => {
    try {
      await SecureStore.setItemAsync(CREDENTIALS_KEY, data);
      return true;
    } catch {
      return false;
    }
  })();
  
  if (!secureOk) {
    try {
      await AsyncStorage.setItem(CREDENTIALS_KEY_ASYNC, data);
      console.log('[Biometric] Guardado en AsyncStorage (fallback)');
    } catch (e) {
      console.error('[Biometric] Error guardando en AsyncStorage:', e);
      return false;
    }
  }
  return true;
}

export async function retrieve(): Promise<{ email: string; password: string; groupName: string } | null> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Inicia sesión con tu huella o FaceID',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      console.log('[Biometric] Autenticación cancelada o fallida');
      return null;
    }

    let stored = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!stored) {
      stored = await AsyncStorage.getItem(CREDENTIALS_KEY_ASYNC);
    }
    if (!stored) {
      console.log('[Biometric] No hay credenciales guardadas');
      return null;
    }

    return JSON.parse(stored);
  } catch (e) {
    console.error('[Biometric] Error en retrieve:', e);
    return null;
  }
}

export async function has(): Promise<boolean> {
  try {
    let stored = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!stored) {
      stored = await AsyncStorage.getItem(CREDENTIALS_KEY_ASYNC);
    }
    const ok = stored !== null;
    console.log('[Biometric] has() →', ok);
    return ok;
  } catch (e) {
    console.error('[Biometric] Error en has():', e);
    return false;
  }
}

export async function authenticate(promptMessage?: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Desbloquea la app',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
    const errMsg = result.success ? '' : (result as { success: false; error: string }).error;
    console.log('[Biometric] authenticate() →', result.success, errMsg);
    return result.success;
  } catch (e) {
    console.error('[Biometric] Error en authenticate():', e);
    return false;
  }
}

export async function clear(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(CREDENTIALS_KEY),
    AsyncStorage.removeItem(CREDENTIALS_KEY_ASYNC),
  ]);
}
