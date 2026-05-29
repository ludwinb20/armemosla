import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '../../../hooks/useThemeColors';
import PlayerLoadingView from '../../../components/lottie/PlayerLoadingView';

/**
 * Pantalla legacy: redirige a Mis Potras (publicar o ver solicitudes).
 * Se mantiene por deep links antiguos.
 */
export default function RivalDesdeReservaRedirect() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ reservaId?: string | string[] }>();
  const reservaId = Array.isArray(params.reservaId) ? params.reservaId[0] : params.reservaId;

  useEffect(() => {
    if (reservaId) {
      router.replace({
        pathname: '/(tabs)/mis-reservas',
        params: { openPublish: '1', reservaId },
      });
    } else {
      router.replace('/(tabs)/mis-reservas');
    }
  }, [reservaId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <PlayerLoadingView message="Redirigiendo..." />
    </SafeAreaView>
  );
}
