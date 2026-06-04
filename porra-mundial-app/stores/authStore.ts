// ============================================
// AUTH STORE — Estado de autenticación persistente
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as biometric from '../services/biometric';

const AUTH_KEY = 'porra_mundial_auth';

export type AuthData = {
  userId: string;
  email: string;
  password: string;
  name: string;
  currentGroup: string;
  groups: string[];
  isAdmin: boolean;
  biometricEnabled?: boolean;
};

let authData: AuthData | null = null;
let listeners: ((data: AuthData | null) => void)[] = [];

/**
 * Suscribe a los cambios de autenticación.
 */
export function subscribeAuth(listener: (data: AuthData | null) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  listeners.forEach(l => l(authData));
}

/**
 * Carga los datos de autenticación desde el almacenamiento local.
 */
export async function loadAuth(): Promise<AuthData | null> {
  try {
    const stored = await AsyncStorage.getItem(AUTH_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migración: si el dato persistido no tiene userId/email/password
      // (formato anterior a migración email+password), se invalida
      if (!parsed.userId || !parsed.email || !parsed.password) {
        console.warn('[Auth] Formato antiguo detectado, limpiando y forzando re-login');
        await AsyncStorage.removeItem(AUTH_KEY);
        authData = null;
        notifyListeners();
        return null;
      }
      authData = parsed;
      notifyListeners();
      return authData;
    }
  } catch (e) {
    console.error('[Auth] Error cargando:', e);
  }
  return null;
}

/**
 * Guarda los datos de autenticación.
 */
export async function saveAuth(data: AuthData): Promise<void> {
  try {
    authData = data;
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(data));
    notifyListeners();
  } catch (e) {
    console.error('[Auth] Error guardando:', e);
  }
}

/**
 * Obtiene los datos de autenticación actuales (sin async).
 */
export function getAuth(): AuthData | null {
  return authData;
}

/**
 * Cambia el grupo activo.
 */
export async function setCurrentGroup(groupName: string): Promise<void> {
  if (authData) {
    authData.currentGroup = groupName;
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(authData));
    notifyListeners();
  }
}

/**
 * Cierra sesión.
 */
export async function logout(): Promise<void> {
  authData = null;
  await Promise.all([
    AsyncStorage.removeItem(AUTH_KEY),
    biometric.clear(),
  ]);
  notifyListeners();
}
