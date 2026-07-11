import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { globalStyles } from '../styles/globalStyles';
import { Colors } from '../constants/theme';
import { hasUserType, getInitialAppRoute, getIsPlatformAdmin } from '../lib/user';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión al iniciar
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          if ((await getIsPlatformAdmin()) || (await hasUserType())) {
            router.replace(await getInitialAppRoute());
          } else {
            router.replace('/select-user-type');
          }
        } else {
          // No hay sesión, redirigir a login
          router.replace('/login');
        }
      } catch (error) {
        console.error('Error al verificar sesión:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        if ((await getIsPlatformAdmin()) || (await hasUserType())) {
          router.replace(await getInitialAppRoute());
        } else {
          router.replace('/select-user-type');
        }
      } else {
        router.replace('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <View style={[globalStyles.contentCentered, { backgroundColor: Colors.background }]}>
        <PlayerLoadingView message="" />
      </View>
    );
  }

  return null;
}

