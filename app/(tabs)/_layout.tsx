import { Tabs } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRoleCheck } from '../../hooks/useRoleCheck';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getUserType } from '../../lib/user';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AnimatedFootballTabIcon from '../../components/AnimatedFootballTabIcon';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';

export default function TabLayout() {
  const colors = useThemeColors();
  const { isChecking, hasAccess } = useRoleCheck();
  const [userType, setUserType] = useState<'Jugador' | 'Administrador de Cancha' | null>(null);
  const [loadingType, setLoadingType] = useState(true);

  const loadUserType = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    try {
      if (showLoading) {
        setLoadingType(true);
      }
      const type = await getUserType();
      setUserType(type);
    } catch (error) {
      console.error('Error al obtener tipo de usuario:', error);
    } finally {
      if (showLoading) {
        setLoadingType(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!hasAccess || isChecking) {
      if (!hasAccess) {
        setLoadingType(false);
        setUserType(null);
      }
      return;
    }

    loadUserType({ showLoading: true });

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let subscribed = false;

    const setupSubscription = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError) {
          if (__DEV__) {
            console.warn('⚠️ [TabLayout] No se pudo obtener usuario para Realtime:', userError.message);
          }
          return;
        }

        if (!user) return;

        channel = supabase
          .channel(`profile_changes_${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              if (payload.new?.user_type) {
                void loadUserType({ showLoading: false });
              }
            }
          )
          .subscribe((status, err) => {
            if (cancelled) return;

            if (status === 'SUBSCRIBED') {
              subscribed = true;
              if (__DEV__) {
                console.log('✅ [TabLayout] Realtime profiles activo');
              }
              return;
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              if (!subscribed && __DEV__) {
                console.warn(
                  '⚠️ [TabLayout] Realtime en profiles no disponible. Opcional: ejecutá db_settings/18_enable_realtime_profiles.sql en Supabase.',
                  err?.message ?? status
                );
              }
            }
          });
      } catch (error) {
        if (!cancelled && __DEV__) {
          console.warn('⚠️ [TabLayout] Suscripción Realtime omitida:', error);
        }
      }
    };

    void setupSubscription();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [hasAccess, isChecking, loadUserType]);

  // Recargar tipo de usuario cuando la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      if (hasAccess && !isChecking && !loadingType) {
        void loadUserType({ showLoading: false });
      }
    }, [hasAccess, isChecking, loadingType, loadUserType])
  );

  if (isChecking) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <PlayerLoadingView message="Verificando acceso..." />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!hasAccess) {
    return null;
  }

  if (loadingType) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <PlayerLoadingView message="Cargando..." />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Determinar qué tabs mostrar según el tipo de usuario
  const isJugador = userType === 'Jugador';
  const isAdmin = userType === 'Administrador de Cancha';

  // Usar key para forzar re-render cuando cambie el tipo de usuario
  const tabsKey = `tabs-${userType || 'none'}`;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Tabs
          key={tabsKey}
          initialRouteName={isJugador ? 'armemosla' : 'home'}
          screenOptions={{
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.background,
              borderTopColor: colors.borderLight,
              borderTopWidth: 1,
              paddingBottom: 5,
              paddingTop: 5,
              height: 60,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
            },
          }}
        >
          {/* Tabs para Administradores */}
          <Tabs.Screen
            name="home"
            options={{
              title: 'Inicio',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
              ),
              href: isAdmin ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="instalaciones"
            options={{
              title: 'Instalaciones',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="business-outline" size={size} color={color} />
              ),
              href: isAdmin ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="pagos"
            options={{
              title: 'Pagos',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="receipt-outline" size={size} color={color} />
              ),
              href: isAdmin ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="estadisticas"
            options={{
              title: 'Estadísticas',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="stats-chart-outline" size={size} color={color} />
              ),
              href: isAdmin ? undefined : null,
            }}
          />

          {/* Tabs para Jugadores */}
          <Tabs.Screen
            name="armemosla"
            options={{
              title: 'Armemosla',
              tabBarIcon: ({ color, size }) => <AnimatedFootballTabIcon color={color} size={size} />,
              href: isJugador ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="mis-reservas"
            options={{
              title: 'Mis Potras',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="soccer-field" size={size} color={color} />
              ),
              href: isJugador ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="logros"
            options={{
              title: 'Logros',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="trophy-outline" size={size} color={color} />
              ),
              href: isJugador ? undefined : null,
            }}
          />

          {/* Tabs compartidos */}
          <Tabs.Screen
            name="perfil"
            options={{
              title: 'Perfil',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="person-outline" size={size} color={color} />
              ),
            }}
          />

          {/* Tabs ocultos (solo para navegación programática) */}
          <Tabs.Screen
            name="complejos"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="canchas"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="reservas"
            options={{ href: null }}
          />
        </Tabs>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}


