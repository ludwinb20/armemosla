import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return process.env.EXPO_PUBLIC_PROJECT_ID || extra?.eas?.projectId;
}

function isExpectedPushSetupError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('aps-environment') ||
    /simulator|Simulator/i.test(msg) ||
    msg.includes('remote notifications') && msg.includes('not supported')
  );
}

// Configurar cómo se manejan las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Registrar para recibir notificaciones push
    registerForPushNotificationsAsync();

    // Listener para notificaciones recibidas mientras la app está en primer plano
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Notificación recibida:', notification);
    });

    // Listener para cuando el usuario toca una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Usuario tocó notificación:', response);
      // Aquí puedes manejar la navegación según el tipo de notificación
    });

    return () => {
      if (notificationListener.current && typeof notificationListener.current.remove === 'function') {
        notificationListener.current.remove();
      }
      if (responseListener.current && typeof responseListener.current.remove === 'function') {
        responseListener.current.remove();
      }
    };
  }, []);

  return null;
}

async function registerForPushNotificationsAsync() {
  try {
    if (Platform.OS === 'ios' && !Device.isDevice) {
      if (__DEV__) {
        console.log(
          '📱 Push: simulador iOS — no se solicita token (APNs no aplica; usá un dispositivo físico para probar push).'
        );
      }
      return;
    }

    // Solicitar permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permisos de notificaciones no otorgados');
      return;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      if (__DEV__) {
        console.warn(
          '⚠️ Push: falta projectId (extra.eas.projectId en app.json o EXPO_PUBLIC_PROJECT_ID). No se obtiene token de Expo.'
        );
      }
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    console.log('✅ Token de notificaciones:', token.data);

    // Configurar el canal de notificaciones para Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#34C759',
      });
    }

    return token.data;
  } catch (error) {
    if (isExpectedPushSetupError(error)) {
      if (__DEV__) {
        console.warn(
          '⚠️ Push: no disponible (simulador, perfil sin Push Notifications o sin capability aps-environment). En producción usá un build con push habilitado en el Apple Developer Portal.'
        );
      }
      return;
    }
    console.error('❌ Error al registrar notificaciones:', error);
  }
}

