import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { globalStyles } from '../styles/globalStyles';
import { Colors } from '../constants/theme';
import { hasUserType, getUserType } from '../lib/user';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión al iniciar
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Hay sesión activa, verificar si tiene tipo de usuario configurado
          const hasType = await hasUserType();
          if (hasType) {
            // Redirigir según el tipo de usuario
            const userType = await getUserType();
            const initialRoute = userType === 'Jugador' ? '/(tabs)/armemosla' : '/(tabs)/home';
            router.replace(initialRoute);
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
        // Verificar si tiene tipo de usuario configurado
        const hasType = await hasUserType();
        if (hasType) {
          // Redirigir según el tipo de usuario
          const userType = await getUserType();
          const initialRoute = userType === 'Jugador' ? '/(tabs)/armemosla' : '/(tabs)/home';
          router.replace(initialRoute);
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
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return null;
}

