import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

/** Deep link legacy — redirige a Pagos (ya no usamos checkout externo). */
export default function PagosReturnScreen() {
  const router = useRouter();
  const { colors } = useGlassTheme();

  useEffect(() => {
    router.replace('/(tabs)/pagos');
  }, [router]);

  return (
    <Screen className="justify-center items-center">
      <ActivityIndicator size="large" color={colors.primary} />
    </Screen>
  );
}
