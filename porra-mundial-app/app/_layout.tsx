import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { loadAuth, getAuth, subscribeAuth } from '../stores/authStore';
import { setupPushNotifications } from '../services/push';
import { connect as connectSocket } from '../services/socket';
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
      const { groupName } = lastNotificationResponse.notification.request.content.data;
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
      if (data && data.phone && data.pin) {
        setupPushNotifications(data.phone);
        connectSocket(data.phone, data.pin);
      }
    });

    // Carga inicial (auth + i18n en paralelo)
    Promise.all([loadAuth(), initI18n()]).then(([data]) => {
      setIsLoggedIn(!!data);
      setIsReady(true);
      if (data && data.phone && data.pin) {
        setupPushNotifications(data.phone);
        connectSocket(data.phone, data.pin);
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
