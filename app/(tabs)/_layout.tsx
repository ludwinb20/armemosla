import { Tabs } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRoleCheck } from '../../hooks/useRoleCheck';
import { View, ActivityIndicator, Text } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getUserType } from '../../lib/user';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AnimatedFootballTabIcon from '../../components/AnimatedFootballTabIcon';

export default function TabLayout() {
  const colors = useThemeColors();
  const { isChecking, hasAccess } = useRoleCheck();
  const [userType, setUserType] = useState<'Jugador' | 'Administrador de Cancha' | null>(null);
  const [loadingType, setLoadingType] = useState(true);

  const loadUserType = useCallback(async () => {
    try {
      const type = await getUserType();
      setUserType(type);
    } catch (error) {
      console.error('Error al obtener tipo de usuario:', error);
    } finally {
      setLoadingType(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess && !isChecking) {
      loadUserType();

      // Suscribirse a cambios en el perfil del usuario en tiempo real
      let channel: ReturnType<typeof supabase.channel> | null = null;

      const setupSubscription = async () => {
        try {
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          if (userError) {
            console.error('❌ [TabLayout] Error getting user:', userError);
            return;
          }

          if (user) {
            channel = supabase
              .channel(`profile_changes_${user.id}`, {
                config: {
                  broadcast: { self: false },
                },
              })
              .on(
                'postgres_changes',
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'profiles',
                  filter: `id=eq.${user.id}`,
                },
                async (payload) => {
                  console.log('🔄 Perfil actualizado:', payload.new);
                  // Recargar el tipo de usuario cuando cambie
                  if (payload.new?.user_type) {
                    setTimeout(async () => {
                      await loadUserType();
                    }, 100);
                  }
                }
              );

            channel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                console.log('✅ Suscrito a cambios de perfil');
              } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Error en canal - Realtime puede no estar habilitado para profiles');
              } else if (status === 'TIMED_OUT') {
                console.error('❌ Suscripción agotó el tiempo de espera');
              }
            });
          }
        } catch (error) {
          console.error('❌ [TabLayout] Error setting up subscription:', error);
        }
      };

      setupSubscription();

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    }
  }, [hasAccess, isChecking, loadUserType]);

  // Recargar tipo de usuario cuando la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      if (hasAccess && !isChecking) {
        loadUserType();
        console.log('🔄 Perfil actualizado: NADA');
      }
    }, [hasAccess, isChecking, loadUserType])
  );

  // Mostrar loading mientras se verifica el rol
  if (isChecking) {
    return (
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 justify-center items-center bg-background" edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text className="mt-md text-md text-text-secondary font-medium">Verificando acceso...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Si no tiene acceso, el hook ya redirigirá, pero por si acaso retornamos null
  if (!hasAccess || loadingType) {
    if (loadingType) {
      return (
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 justify-center items-center bg-background" edges={['top', 'bottom']}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text className="mt-md text-md text-text-secondary font-medium">Cargando...</Text>
          </SafeAreaView>
        </SafeAreaProvider>
      );
    }
    return null;
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
              title: 'Mis Reservas',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="calendar-outline" size={size} color={color} />
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


