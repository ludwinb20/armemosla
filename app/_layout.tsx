import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '../hooks/use-color-scheme';
import { usePushNotifications } from '../hooks/usePushNotifications';

// Mantener la splash screen visible mientras se carga
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  usePushNotifications();

  useEffect(() => {
    // Ocultar splash screen cuando todo esté listo
    const prepare = async () => {
      try {
        // Aquí puedes hacer cualquier inicialización necesaria
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    prepare();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SafeAreaProvider>
          <StatusBar hidden={true} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="select-user-type" options={{ headerShown: false }} />
            <Stack.Screen name="complejo-form" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

