import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui';
import { TabBarBackground } from '@/components/ui/TabBarBackground';
import { useRoleCheck } from '../../hooks/useRoleCheck';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import AnimatedFootballTabIcon from '../../components/AnimatedFootballTabIcon';
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
        <Tabs initialRouteName="armemosla" screenOptions={tabScreenOptions}>
          <Tabs.Screen
            name="armemosla"
            options={{
              title: 'Armemosla',
              tabBarIcon: ({ color, size }) => <AnimatedFootballTabIcon color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="mis-reservas"
            options={{
              title: 'Mis Potras',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="soccer-field" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="logros"
            options={{
              title: 'Logros',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="trophy-outline" size={size} color={color} />
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
        </Tabs>
      </Screen>
    </SafeAreaProvider>
  );
}
