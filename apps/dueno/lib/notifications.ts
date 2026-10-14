import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return process.env.EXPO_PUBLIC_PROJECT_ID || extra?.eas?.projectId;
}

function isExpectedPushSetupError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('aps-environment') || /simulator|Simulator/i.test(msg);
}

/**
 * Obtiene el token de notificaciones push del dispositivo actual
 */
export async function getPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios' && !Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permisos de notificaciones no otorgados');
      return null;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    return token.data;
  } catch (error) {
    if (isExpectedPushSetupError(error)) {
      if (__DEV__) {
        console.warn('⚠️ [getPushToken] Push no disponible en este entorno (simulador o sin APNs).');
      }
      return null;
    }
    console.error('❌ [getPushToken] Error:', error);
    return null;
  }
}

/**
 * Guarda el token de notificaciones en el perfil del usuario
 */
export async function savePushToken(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const platform = Platform.OS;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: user.id,
        expo_push_token: token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_push_token' }
    );

    if (error) throw error;
  } catch (error: unknown) {
    console.error('❌ [savePushToken] Error:', error);
    throw error;
  }
}

/**
 * Envía una notificación local (solo foreground; preferir dispatchNotification para push remoto).
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Enviar inmediatamente
    });
  } catch (error: any) {
    console.error('❌ [sendLocalNotification] Error:', error);
    throw error;
  }
}
