import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui';

/** Deep link: armemosla://pagos/cancel */
export default function PagosCancelScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/pagos');
  }, [router]);

  return <Screen />;
}
