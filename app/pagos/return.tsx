import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmarPagoPayPal, confirmarTarjetaAgregada } from '../../lib/paypal';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Deep link: armemosla://pagos/return?factura_id=&token= | ?modo=tarjeta&token= */
export default function PagosReturnScreen() {
  const { factura_id, token, modo } = useLocalSearchParams<{
    factura_id?: string;
    token?: string;
    modo?: string;
  }>();
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        if (modo === 'tarjeta') {
          await confirmarTarjetaAgregada(token);
        } else if (factura_id) {
          await confirmarPagoPayPal({
            facturaId: factura_id,
            paypalOrderId: token,
          });
        }
      } catch {
        // Webhook o confirmación en pantalla de pago pueden haberlo resuelto
      }
      router.replace('/(tabs)/pagos');
    };
    void run();
  }, [factura_id, token, modo, router]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <PlayerLoadingView message={modo === 'tarjeta' ? 'Guardando tarjeta...' : 'Confirmando pago...'} />
    </SafeAreaView>
  );
}
