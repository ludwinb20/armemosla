import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/theme';
import { getUserType } from '../../lib/user';
import DashboardAdmin from '../../components/DashboardAdmin';

export default function HomeScreen() {
  const router = useRouter();
  const [userType, setUserType] = useState<'Jugador' | 'Administrador de Cancha' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserType = async () => {
      try {
        const type = await getUserType();
        setUserType(type);
      } catch (error) {
        console.error('Error al obtener tipo de usuario:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserType();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Mostrar dashboard según el tipo de usuario
  if (userType === 'Administrador de Cancha') {
    return <DashboardAdmin />;
  }

  // Por ahora, mostrar dashboard básico para jugadores
  // TODO: Crear DashboardJugador cuando sea necesario
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

