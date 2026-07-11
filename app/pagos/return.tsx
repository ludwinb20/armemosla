import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

/** Deep link legacy — redirige a Pagos (ya no usamos checkout externo). */
export default function PagosReturnScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/pagos');
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
