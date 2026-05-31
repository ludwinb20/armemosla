import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Deep link: armemosla://pagos/cancel */
export default function PagosCancelScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/pagos');
  }, [router]);

  return <SafeAreaView style={{ flex: 1 }} />;
}
