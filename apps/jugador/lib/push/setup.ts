import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

const ANDROID_CHANNEL_ID = 'default';
const ANDROID_LIGHT_COLOR = '#2B2F5F';

let handlerConfigured = false;

export function getExpoProjectId(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId
  );
}

function isExpectedPushSetupError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('aps-environment') ||
    /simulator|Simulator/i.test(msg) ||
    (msg.includes('remote notifications') && msg.includes('not supported'))
  );
}

export function configurePushNotificationHandler(): void {
  if (handlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  handlerConfigured = true;
}

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: ANDROID_LIGHT_COLOR,
  });
}

/**
 * Permisos + canal Android + Expo Push Token.
 * Requiere dispositivo físico y extra.eas.projectId en app config.
 */
export async function registerForExpoPushTokenAsync(): Promise<string | null> {
  configurePushNotificationHandler();

  if (!Device.isDevice) {
    if (__DEV__) {
      console.warn(
        '📱 Push: requiere dispositivo físico (simulador/emulador no soporta token Expo).'
      );
    }
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) {
      console.warn('⚠️ Push: permisos de notificaciones no otorgados.');
    }
    return null;
  }

  await ensureAndroidNotificationChannel();

  const projectId = getExpoProjectId();
  if (!projectId) {
    if (__DEV__) {
      console.warn(
        '⚠️ Push: falta extra.eas.projectId en app config (o EXPO_PUBLIC_PROJECT_ID).'
      );
    }
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('✅ Expo Push Token:', token.data);
    return token.data;
  } catch (error) {
    if (isExpectedPushSetupError(error)) {
      if (__DEV__) {
        console.warn(
          '⚠️ Push: no disponible (simulador, perfil sin Push Notifications o sin capability aps-environment).'
        );
      }
      return null;
    }
    console.error('❌ Push: error al obtener token Expo:', error);
    return null;
  }
}
