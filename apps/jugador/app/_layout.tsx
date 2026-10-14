import 'react-native-css-interop/jsx-runtime';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar, Platform, LogBox, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import '../global.css';

import { usePushNotifications } from '../hooks/usePushNotifications';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { UserTypeProvider } from '../contexts/UserTypeContext';
import { useGlassTheme } from '../hooks/useGlassTheme';
import { getUiColors } from '../constants/uiTokens';

/**
 * RN 0.81 marca como deprecado `SafeAreaView` en el paquete `react-native`; el aviso sale al **importar**
 * ese getter (p. ej. alguna dependencia). Nuestro código usa solo `react-native-safe-area-context`.
 * LogBox tapa el overlay; Metro sigue imprimiendo WARN hasta filtrar `console.warn`.
 */
if (__DEV__) {
  LogBox.ignoreLogs(['SafeAreaView has been deprecated']);
  const originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const text = args
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ');
    if (text.includes('SafeAreaView has been deprecated')) {
      return;
    }
    originalConsoleWarn.apply(console, args as []);
  };
}

// Mantener la splash screen visible mientras se carga
SplashScreen.preventAutoHideAsync();

// Función helper para detectar errores de keep-awake
const isKeepAwakeError = (error: any): boolean => {
  if (!error) return false;
  
  const errorStr = 
    error?.message?.toString() || 
    error?.toString() || 
    JSON.stringify(error) || 
    '';
  
  return (
    errorStr.includes('Unable to activate keep awake') ||
    errorStr.includes('keep awake') ||
    errorStr.includes('expo-keep-awake')
  );
};

// Manejar errores no capturados de keep-awake (problema conocido de expo-dev-client en Android)
if (typeof ErrorUtils !== 'undefined' && ErrorUtils.getGlobalHandler) {
  const originalGlobalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    // Suprimir el error de keep-awake (error conocido de expo-dev-client que no afecta la funcionalidad)
    if (isKeepAwakeError(error)) {
      // Solo loguear como warning en desarrollo, no como error
      if (__DEV__) {
        console.warn('⚠️ [Keep Awake] Error suprimido (conocido de expo-dev-client)');
      }
      return;
    }
    // Llamar al handler original para otros errores
    if (originalGlobalHandler) {
      originalGlobalHandler(error, isFatal);
    }
  });
}

// También manejar promesas rechazadas no capturadas relacionadas con keep-awake
if (typeof global !== 'undefined') {
  const originalPromiseRejectionHandler = global.onunhandledrejection;
  global.onunhandledrejection = (event: any) => {
    const error = event?.reason || event;
    
    // Suprimir promesas rechazadas relacionadas con keep-awake
    if (isKeepAwakeError(error)) {
      event.preventDefault?.();
      if (__DEV__) {
        console.warn('⚠️ [Keep Awake] Promesa rechazada suprimida (conocido de expo-dev-client)');
      }
      return;
    }
    
    // Dejar que otros errores se manejen normalmente
    if (originalPromiseRejectionHandler) {
      originalPromiseRejectionHandler(event);
    }
  };
}

// Manejar también errores de console.error relacionados con keep-awake (para Android)
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const errorString = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  if (isKeepAwakeError(errorString)) {
    if (__DEV__) {
      console.warn('⚠️ [Keep Awake] Error de consola suprimido (conocido de expo-dev-client)');
    }
    return;
  }

  originalConsoleError.apply(console, args);
};

function RootLayoutContent() {
  const { theme } = useTheme();
  usePushNotifications();
  const glass = useGlassTheme();
  const colors = getUiColors(theme);

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
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <SafeAreaProvider>
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
          <SafeAreaView
            className="flex-1"
            style={{ backgroundColor: colors.background }}
            edges={['top', 'bottom']}
          >
            <StatusBar
              barStyle={glass.statusBarStyle}
              translucent={Platform.OS === 'android'}
              backgroundColor={glass.colors.background}
            />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: glass.colors.background },
              }}
            >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="solicitud-chat" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <UserTypeProvider>
          <RootLayoutContent />
        </UserTypeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

