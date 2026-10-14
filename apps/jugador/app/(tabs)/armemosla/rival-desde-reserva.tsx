import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import PlayerLoadingView from '../../../components/lottie/PlayerLoadingView';
import { Screen } from '@/components/ui';

/**
 * Pantalla legacy: redirige a Mis Potras (publicar o ver solicitudes).
 * Se mantiene por deep links antiguos.
 */
export default function RivalDesdeReservaRedirect() {
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
    <Screen className="justify-center items-center">
      <PlayerLoadingView message="Redirigiendo..." />
    </Screen>
  );
}
