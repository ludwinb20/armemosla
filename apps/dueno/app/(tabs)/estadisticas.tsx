import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getUserType } from '../../lib/user';
import DashboardAdmin from '../../components/DashboardAdmin';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import { Screen } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

export default function EstadisticasScreen() {
  const router = useRouter();
  const { colors } = useGlassTheme();
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
      <Screen>
        <PlayerLoadingView />
      </Screen>
    );
  }

  // Mostrar dashboard según el tipo de usuario
  if (userType === 'Administrador de Cancha') {
    return <DashboardAdmin />;
  }

  // Por ahora, mostrar dashboard básico para jugadores
  // TODO: Crear DashboardJugador cuando sea necesario
  return (
    <Screen>
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Screen>
  );
}
