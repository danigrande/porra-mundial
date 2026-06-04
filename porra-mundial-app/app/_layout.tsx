import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { loadAuth, getAuth, saveAuth, subscribeAuth } from '../stores/authStore';
import { setupPushNotifications } from '../services/push';
import { connect as connectSocket } from '../services/socket';
import * as biometric from '../services/biometric';
import * as api from '../services/api';
import { initI18n } from '../i18n/i18n';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Escuchar cuando el usuario pulsa una notificación
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (
      lastNotificationResponse &&
      lastNotificationResponse.notification.request.content.data.screen === 'chat' &&
      lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const groupName = lastNotificationResponse.notification.request.content.data.groupName as string;
      console.log('[Push] Navegando al chat:', groupName);
      
      // Pequeño delay para asegurar que el router está listo
      setTimeout(() => {
        if (isLoggedIn) {
          router.push({
            pathname: '/(tabs)/chat', // Ruta correcta corregida
            params: { groupName }
          });
        }
      }, 500);
    }
  }, [lastNotificationResponse, isLoggedIn]);

  useEffect(() => {
    // Escuchar cambios de autenticación (login/logout)
    const unsubscribe = subscribeAuth((data) => {
      setIsLoggedIn(!!data);
      if (data && data.email && data.password) {
        setupPushNotifications(data.userId);
        connectSocket(data.email, data.password);
      }
    });

    // Carga inicial (auth + i18n en paralelo)
    Promise.all([loadAuth(), initI18n()]).then(async ([data]) => {
      let finalData = data;
      const hasBioCreds = await biometric.has();

      // Gate biométrico: si hay sesión guardada y credenciales biométricas, pedir huella/FaceID
      if (finalData && (finalData.biometricEnabled || hasBioCreds)) {
        const ok = await biometric.authenticate('Desbloquea la app');
        if (ok) {
          // Migrar flag si falta (usuarios que enrolaron antes de que existiera el flag)
          if (!finalData.biometricEnabled && hasBioCreds) {
            await saveAuth({ ...finalData, biometricEnabled: true });
          }
        } else {
          finalData = null;
        }
      }

      // Si no hay sesión en AsyncStorage, intentar login completo desde SecureStore
      if (!finalData && hasBioCreds) {
        const creds = await biometric.retrieve();
        if (creds) {
          try {
            const result = await api.login(creds.email, creds.password, creds.groupName);
            const user = await api.getUserByEmail(creds.email);
            finalData = {
              userId: result.userId,
              email: creds.email,
              password: creds.password,
              name: result.name,
              currentGroup: creds.groupName,
              groups: user.groups || [creds.groupName],
              isAdmin: result.isAdmin || false,
              biometricEnabled: true,
            };
            await saveAuth(finalData);
          } catch (e: any) {
            if (e.message && (e.message.toLowerCase().includes('incorrect') || e.message.toLowerCase().includes('credencial'))) {
              await biometric.clear();
            }
            console.error('[Biometric] Login con credenciales guardadas falló:', e);
          }
        }
      }

      setIsLoggedIn(!!finalData);
      setIsReady(true);
      if (finalData && finalData.email && finalData.password) {
        setupPushNotifications(finalData.userId);
        connectSocket(finalData.email, finalData.password);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isReady, isLoggedIn, segments]);

  if (!isReady) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0e27' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0a0e27' },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
