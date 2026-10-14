import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui';
import { TabBarBackground } from '@/components/ui/TabBarBackground';
import { useRoleCheck } from '../../hooks/useRoleCheck';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';

export default function TabLayout() {
  const glass = useGlassTheme();
  const { isChecking, hasAccess } = useRoleCheck();

  const tabScreenOptions = {
    tabBarActiveTintColor: glass.tabBar.activeTintColor,
    tabBarInactiveTintColor: glass.tabBar.inactiveTintColor,
    headerShown: false,
    tabBarBackground: () => <TabBarBackground />,
    tabBarStyle: {
      backgroundColor: 'transparent',
      borderTopColor: glass.tabBar.borderTopColor,
      borderTopWidth: 1,
      paddingBottom: 5,
      paddingTop: 5,
      height: 60,
    },
    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: '500' as const,
    },
  };

  if (isChecking) {
    return (
      <SafeAreaProvider>
        <Screen className="justify-center items-center">
          <PlayerLoadingView message="Verificando acceso..." />
        </Screen>
      </SafeAreaProvider>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Screen>
        <Tabs initialRouteName="home" screenOptions={tabScreenOptions}>
          <Tabs.Screen
            name="home"
            options={{
              title: 'Inicio',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home-outline" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="instalaciones"
            options={{
              title: 'Instalaciones',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="business-outline" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="pagos"
            options={{
              title: 'Pagos',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="receipt-outline" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="estadisticas"
            options={{
              title: 'Estadísticas',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="stats-chart-outline" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="perfil"
            options={{
              title: 'Perfil',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="person-outline" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen name="complejos" options={{ href: null }} />
          <Tabs.Screen name="canchas" options={{ href: null }} />
          <Tabs.Screen name="reservas" options={{ href: null }} />
        </Tabs>
      </Screen>
    </SafeAreaProvider>
  );
}
