import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { supabase } from '../supabase';
import { getJwtPayload } from '../jwtPayload';

/**
 * Configuración de Google Sign-In
 * Debe llamarse al inicio de la app
 */
export const configureGoogleSignIn = () => {
  const googleClientId = Constants.expoConfig?.extra?.googleWebClientId || 
                          process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

  if (!googleClientId) {
    console.warn(
      '⚠️ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no configurado. Para Android+iOS con Supabase usa OAuth Web Client ID.'
    );
    return;
  }

  GoogleSignin.configure({
    webClientId: googleClientId,
    offlineAccess: true,
  });
};

const ANDROID_GOOGLE_DEVELOPER_ERROR = '10';

function mapGoogleSignInError(error: any): string {
  if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
    return 'Inicio de sesión cancelado';
  }
  if (error?.code === statusCodes.IN_PROGRESS) {
    return 'Inicio de sesión en progreso';
  }
  if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services no disponible';
  }
  if (
    String(error?.code) === ANDROID_GOOGLE_DEVELOPER_ERROR ||
    /DEVELOPER_ERROR|Developer error/i.test(String(error?.message ?? ''))
  ) {
    return (
      'Google no reconoce esta compilación de Android (SHA). ' +
      'Agrega SHA-1 y SHA-256 de debug/release en Firebase, descarga de nuevo google-services.json y recompila la app.'
    );
  }
  return error?.message || 'Error al iniciar sesión con Google';
}

/**
 * Iniciar sesión con Google
 */
export const signInWithGoogle = async () => {
  try {
    // Verificar Play Services (Android)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Obtener información de Google
    const signInResult = await GoogleSignin.signIn();
    const userInfo = (signInResult as any)?.data ?? signInResult;
    const googleUser = userInfo?.user ?? null;

    // Obtener idToken (el tipo puede variar, usar as any si es necesario)
    let idToken = (userInfo as any)?.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens?.idToken;
    }

    if (!idToken) {
      throw new Error('No se pudo obtener el token de Google');
    }

    const idPayload = getJwtPayload(idToken);
    const nonceInToken =
      typeof idPayload?.nonce === 'string' ? idPayload.nonce : undefined;

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      ...(nonceInToken ? { nonce: nonceInToken } : {}),
    });

    if (error) {
      throw error;
    }

    return { data, error: null, googleUser };
  } catch (error: any) {
    return { data: null, error: { message: mapGoogleSignInError(error) }, googleUser: null };
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
    return GoogleSignin.hasPreviousSignIn();
  } catch (error) {
    return false;
  }
};

