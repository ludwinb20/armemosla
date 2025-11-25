import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRoleCheck } from '../../hooks/useRoleCheck';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

export default function TabLayout() {
  const { isChecking, hasAccess } = useRoleCheck();

  // Mostrar loading mientras se verifica el rol
  if (isChecking) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer} edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Verificando acceso...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Si no tiene acceso, el hook ya redirigirá, pero por si acaso retornamos null
  if (!hasAccess) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.textSecondary,
            headerShown: false,
            tabBarStyle: {
              backgroundColor: Colors.background,
              borderTopColor: Colors.borderLight,
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
            name="complejos"
            options={{
              title: 'Complejos',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="business-outline" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="reservas"
            options={{
              title: 'Reservas',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="calendar-outline" size={size} color={color} />
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});

