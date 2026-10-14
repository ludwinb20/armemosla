import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForExpoPushTokenAsync } from '../lib/push/setup';
import { savePushToken } from '../lib/notifications';
import { navigateFromPushNotification } from '../lib/push/navigation';
import { supabase } from '../lib/supabase';

export interface UsePushNotificationsOptions {
  /** Callback opcional adicional cuando se obtiene el token Expo. */
  onToken?: (token: string) => void;
}

async function persistPushTokenIfAuthed(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await savePushToken(token);
  if (__DEV__) {
    console.log('✅ Push token guardado en Supabase');
  }
}

export function usePushNotifications(options?: UsePushNotificationsOptions) {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const onTokenRef = useRef(options?.onToken);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    onTokenRef.current = options?.onToken;
  }, [options?.onToken]);

  useEffect(() => {
    const syncToken = (token: string | null) => {
      if (!token) return;
      tokenRef.current = token;
      onTokenRef.current?.(token);
      void persistPushTokenIfAuthed(token).catch((error: unknown) => {
        console.warn(
          '⚠️ Push token obtenido pero no se guardó en Supabase:',
          error instanceof Error ? error.message : error
        );
      });
    };

    void registerForExpoPushTokenAsync().then(syncToken);

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (tokenRef.current) {
          void persistPushTokenIfAuthed(tokenRef.current).catch(() => {});
        } else {
          void registerForExpoPushTokenAsync().then(syncToken);
        }
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      if (__DEV__) {
        console.log('📬 Notificación recibida:', notification);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      if (__DEV__) {
        console.log('👆 Usuario tocó notificación:', response);
      }
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      navigateFromPushNotification(data);
    });

    return () => {
      authListener.subscription.unsubscribe();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return null;
}
