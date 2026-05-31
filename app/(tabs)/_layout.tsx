import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRoleCheck } from '../../hooks/useRoleCheck';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useUserType } from '../../contexts/UserTypeContext';
import AnimatedFootballTabIcon from '../../components/AnimatedFootballTabIcon';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';

export default function TabLayout() {
  const colors = useThemeColors();
  const { userType, loadingUserType } = useUserType();
  const { isChecking, hasAccess } = useRoleCheck();

  if (isChecking) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <PlayerLoadingView message={loadingUserType ? 'Cargando...' : 'Verificando acceso...'} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!hasAccess) {
    return null;
  }

  const isJugador = userType === 'Jugador';
  const isAdmin = userType === 'Administrador de Cancha';
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
