import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { registerPushToken } from './api';

// Configuración de cómo se muestran las notificaciones cuando la app está abierta (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function setupPushNotifications(phone: string) {
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for Push Notifications');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('[Push] Permiso denegado para notificaciones');
      return null;
    }

    // Obtener el projectId desde la configuración de Expo
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    console.log('[Push] Buscando ProjectId:', projectId);

    if (!projectId) {
      console.error('[Push] ❌ ERROR: Falta el projectId en app.json. Las notificaciones NO funcionarán sin él.');
      Alert.alert('Configuración Push', 'Falta el projectId en app.json. Las notificaciones están deshabilitadas.');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    
    const token = tokenData.data;
    console.log('[Push] Token obtenido:', token);

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Enviar el token al backend
    await registerPushToken(phone, token, Platform.OS);
    return token;
  } catch (error) {
    console.error('[Push] Error configurando notificaciones:', error);
    return null;
  }
}
