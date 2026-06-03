// ============================================
// AUTH STORE — Estado de autenticación persistente
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = 'porra_mundial_auth';

export type AuthData = {
  userId: string;
  email: string;
  password: string; // kept in memory for socket re-auth
  name: string;
  currentGroup: string;
  groups: string[];
  isAdmin: boolean;
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
      authData = JSON.parse(stored);
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
  await AsyncStorage.removeItem(AUTH_KEY);
  notifyListeners();
}
