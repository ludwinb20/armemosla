import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { supabase } from '../supabase';

/**
 * Configuración de Google Sign-In
 * Debe llamarse al inicio de la app
 */
export const configureGoogleSignIn = () => {
  const googleClientId = Constants.expoConfig?.extra?.googleWebClientId || 
                          process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

  if (!googleClientId) {
    console.warn('⚠️ Google Client ID no configurado');
    return;
  }

  GoogleSignin.configure({
    webClientId: googleClientId,
    offlineAccess: true,
  });
};

/**
 * Iniciar sesión con Google
 */
export const signInWithGoogle = async () => {
  try {
    // Verificar Play Services (Android)
    await GoogleSignin.hasPlayServices();

    // Obtener información de Google
    const userInfo = await GoogleSignin.signIn();

    // Obtener idToken (el tipo puede variar, usar as any si es necesario)
    const idToken = (userInfo as any).data?.idToken || userInfo.idToken;

    if (!idToken) {
      throw new Error('No se pudo obtener el token de Google');
    }

    // Autenticar con Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { data: null, error: { message: 'Inicio de sesión cancelado' } };
    } else if (error.code === statusCodes.IN_PROGRESS) {
      return { data: null, error: { message: 'Inicio de sesión en progreso' } };
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { data: null, error: { message: 'Google Play Services no disponible' } };
    } else {
      return { data: null, error: { message: error.message || 'Error al iniciar sesión con Google' } };
    }
  }
};

/**
 * Cerrar sesión de Google
 */
export const signOutGoogle = async () => {
  try {
    await GoogleSignin.signOut();
    await supabase.auth.signOut();
    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'Error al cerrar sesión' } };
  }
};

/**
 * Obtener el usuario actual de Google
 */
export const getCurrentGoogleUser = async () => {
  try {
    const userInfo = await GoogleSignin.getCurrentUser();
    return { data: userInfo, error: null };
  } catch (error: any) {
    return { data: null, error: { message: error.message || 'Error al obtener usuario' } };
  }
};

/**
 * Verificar si el usuario está autenticado con Google
 */
export const isSignedIn = async () => {
  try {
    const isSignedIn = await GoogleSignin.isSignedIn();
    return isSignedIn;
  } catch (error) {
    return false;
  }
};

