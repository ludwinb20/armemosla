import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ensureAppRole, getInitialAppRoute } from '../lib/user';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import { Screen } from '@/components/ui';
import { APP_ROLE } from '@/constants/appRole';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const goHomeOrLogin = async (session: unknown) => {
      if (!session) {
        router.replace('/login');
        return;
      }
      try {
        await ensureAppRole();
        router.replace(await getInitialAppRoute());
      } catch (roleError: unknown) {
        const message =
          roleError instanceof Error
            ? roleError.message
            : `Esta cuenta no es de tipo ${APP_ROLE}.`;
        Alert.alert('App incorrecta', message, [
          {
            text: 'Cerrar sesión',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/login');
            },
          },
        ]);
      }
    };

    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await goHomeOrLogin(session);
      } catch (error) {
        console.error('Error al verificar sesión:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await goHomeOrLogin(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <Screen className="justify-center items-center">
        <PlayerLoadingView message="" />
      </Screen>
    );
  }

  return null;
}
