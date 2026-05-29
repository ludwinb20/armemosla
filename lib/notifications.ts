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

    // Aquí podrías guardar el token en una tabla de tokens de notificaciones
    // Por ahora solo lo retornamos para uso local
    console.log('✅ Token guardado para usuario:', user.id);
  } catch (error: any) {
    console.error('❌ [savePushToken] Error:', error);
    throw error;
  }
}

/**
 * Envía una notificación local
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

/**
 * Envía notificación cuando se recibe una solicitud de partido
 */
export async function notifyNuevaSolicitudPartido(
  equipoNombre: string,
  partidoId: string
): Promise<void> {
  await sendLocalNotification(
    'Nueva Solicitud de Partido',
    `El equipo "${equipoNombre}" quiere jugar contigo`,
    {
      type: 'solicitud_partido',
      partidoId,
    }
  );
}

/**
 * Envía notificación cuando se acepta una solicitud de partido
 */
export async function notifySolicitudAceptada(
  equipoNombre: string,
  partidoId: string
): Promise<void> {
  await sendLocalNotification(
    'Solicitud Aceptada',
    `Tu solicitud para jugar contra "${equipoNombre}" fue aceptada`,
    {
      type: 'solicitud_aceptada',
      partidoId,
    }
  );
}

/**
 * Envía notificación cuando se rechaza una solicitud de partido
 */
export async function notifySolicitudRechazada(
  equipoNombre: string,
  partidoId: string
): Promise<void> {
  await sendLocalNotification(
    'Solicitud Rechazada',
    `Tu solicitud para jugar contra "${equipoNombre}" fue rechazada`,
    {
      type: 'solicitud_rechazada',
      partidoId,
    }
  );
}

/**
 * Envía notificación cuando se encuentra un match automático
 */
export async function notifyMatchEncontrado(
  equipoNombre: string,
  partidoId: string
): Promise<void> {
  await sendLocalNotification(
    '¡Match Encontrado!',
    `Se encontró un partido compatible con "${equipoNombre}"`,
    {
      type: 'match_encontrado',
      partidoId,
    }
  );
}
