import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { hasUserType, getUserType } from '../lib/user';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../components/Logo';
import RNModal from 'react-native-modal';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  rModalAnimLeft,
} from '../lib/rnModalPresets';

const { width } = Dimensions.get('window');

/** Android: DEVELOPER_ERROR — casi siempre SHA-1 del keystore no registrado en Firebase/Google Cloud. */
const ANDROID_GOOGLE_DEVELOPER_ERROR = '10';

function mensajeErrorGoogleSignIn(err: unknown): string {
  const msg =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (
    (isErrorWithCode(err) && String(err.code) === ANDROID_GOOGLE_DEVELOPER_ERROR) ||
    /DEVELOPER_ERROR|Developer error/i.test(msg)
  ) {
    return (
      'Google no reconoce esta compilación de la app (SHA-1). ' +
      'En Firebase Console → tu app Android, agregá el SHA-1 de debug: ' +
      'en la carpeta android ejecutá `gradlew signingReport` y copiá el SHA-1 de la variante debug. ' +
      'Si instalás un build de EAS, agregá también el SHA-1 de release. Luego descargá de nuevo google-services.json.'
    );
  }
  return msg || 'Error al iniciar sesión con Google';
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // true = login, false = register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();

  useEffect(() => {
    const configureGoogleSignIn = () => {
      try {
        const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

        if (!googleClientId) {
          console.warn('⚠️ [Login] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no está configurada. Login con Google no funcionará.');
          return;
        }

        console.log('🔧 [Login] Configurando Google Sign-In en useEffect...');
        GoogleSignin.configure({
          webClientId: googleClientId,
          offlineAccess: true,
        });
        console.log('✅ [Login] Google Sign-In configurado correctamente');
      } catch (error) {
        console.error('❌ [Login] Error configurando Google Sign-In:', error);
      }
    };

    configureGoogleSignIn();
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log('🔐 [signInWithGoogle] Iniciando login con Google...');

      // Verificar que Google Sign-In esté configurado
      const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!googleClientId) {
        showError('Error', 'Google Sign-In no está configurado. Por favor contacta al administrador.');
        return;
      }

      // Asegurarse de que está configurado antes de usar
      try {
        GoogleSignin.configure({
          webClientId: googleClientId,
          offlineAccess: true,
        });
        console.log('✅ [signInWithGoogle] Google Sign-In configurado');
      } catch (configError) {
        console.error('❌ [signInWithGoogle] Error al configurar:', configError);
      }

      setLoading(true);

      console.log('🔐 [signInWithGoogle] Verificando Play Services...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('✅ [signInWithGoogle] Play Services OK');

      console.log('🔐 [signInWithGoogle] Solicitando información de Google...');
      const signInResult = await GoogleSignin.signIn();

      if (!isSuccessResponse(signInResult)) {
        console.log('🔐 [signInWithGoogle] Inicio cancelado o sin datos');
        return;
      }

      const userInfo = signInResult.data;
      console.log('✅ [signInWithGoogle] Información de Google obtenida:', {
        email: userInfo.user?.email,
        name: userInfo.user?.name,
        hasPhoto: !!userInfo.user?.photo,
      });

      if (userInfo.user?.photo) {
        await AsyncStorage.setItem('google_avatar', userInfo.user.photo);
        console.log('💾 [signInWithGoogle] Google avatar guardado en AsyncStorage');
      }

      let idToken = userInfo.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }
      if (!idToken) {
        showError('Error', 'No se pudo obtener el token de Google. Intentá de nuevo.');
        return;
      }

      console.log('🔐 [signInWithGoogle] Autenticando con Supabase...');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        console.error('❌ [signInWithGoogle] Error de Supabase:', {
          message: error.message,
          status: error.status,
        });
        showError('Error', error.message);
      } else {
        console.log('✅ [signInWithGoogle] Login exitoso:', {
          userId: data.user?.id,
          email: data.user?.email,
          sessionExists: !!data.session,
        });
        
        // Verificar si el usuario tiene tipo configurado
        const hasType = await hasUserType();
        if (hasType) {
          // Redirigir según el tipo de usuario
          const userType = await getUserType();
          const initialRoute = userType === 'Jugador' ? '/(tabs)/armemosla' : '/(tabs)/home';
          router.push(initialRoute);
        } else {
          router.push('/select-user-type');
        }
      }
    } catch (err: unknown) {
      console.error('❌ [signInWithGoogle] Error general:', {
        message: err instanceof Error ? err.message : err,
        code: isErrorWithCode(err) ? err.code : undefined,
        error: JSON.stringify(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      showError('Error con Google', mensajeErrorGoogleSignIn(err));
    } finally {
      console.log('🔐 [signInWithGoogle] Finalizando proceso de login');
      setLoading(false);
    }
  };

  const signInWithEmail = async () => {
    console.log('🔐 [signInWithEmail] Iniciando login con email...');

    if (!email || !password) {
      console.warn('⚠️ [signInWithEmail] Campos incompletos:', {
        hasEmail: !!email,
        hasPassword: !!password,
      });
      showError('Error', 'Por favor completa todos los campos');
      return;
    }

    try {
      setLoading(true);
      const emailTrimmed = email.trim();

      console.log('🔐 [signInWithEmail] Autenticando con Supabase:', {
        email: emailTrimmed,
        passwordLength: password.length,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailTrimmed,
        password: password,
      });

      if (error) {
        console.error('❌ [signInWithEmail] Error de Supabase:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });

        if (error.message === 'Email not confirmed' || error.message.includes('not confirmed')) {
          console.log('📧 [signInWithEmail] Email no confirmado, reenviando email de confirmación...');
          try {
            const { error: resendError } = await supabase.auth.resend({
              type: 'signup',
              email: emailTrimmed,
            });

            if (resendError) {
              console.error('❌ [signInWithEmail] Error al reenviar email:', resendError);
              showError(
                'Email no confirmado',
                'Tu email no ha sido confirmado. Hemos enviado un nuevo email de confirmación. Por favor revisa tu correo y confirma tu cuenta antes de iniciar sesión.'
              );
            } else {
              console.log('✅ [signInWithEmail] Email de confirmación reenviado');
              showError(
                'Email no confirmado',
                'Tu email no ha sido confirmado. Hemos enviado un nuevo email de confirmación a tu correo. Por favor revisa tu bandeja de entrada y confirma tu cuenta antes de iniciar sesión.'
              );
            }
          } catch (resendErr: any) {
            console.error('❌ [signInWithEmail] Error al intentar reenviar email:', resendErr);
            showError(
              'Email no confirmado',
              'Tu email no ha sido confirmado. Por favor revisa tu correo y confirma tu cuenta antes de iniciar sesión.'
            );
          }
        } else {
          showError('Error', error.message);
        }
      } else {
        console.log('✅ [signInWithEmail] Login exitoso:', {
          userId: data.user?.id,
          email: data.user?.email,
          emailConfirmed: data.user?.email_confirmed_at ? 'Sí' : 'No',
          sessionExists: !!data.session,
          expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : 'N/A',
        });
        
        // Verificar si el usuario tiene tipo configurado
        const hasType = await hasUserType();
        if (hasType) {
          // Redirigir según el tipo de usuario
          const userType = await getUserType();
          const initialRoute = userType === 'Jugador' ? '/(tabs)/armemosla' : '/(tabs)/home';
          router.push(initialRoute);
        } else {
          router.push('/select-user-type');
        }
      }
    } catch (err: any) {
      console.error('❌ [signInWithEmail] Error general:', {
        message: err.message,
        error: JSON.stringify(err),
        stack: err.stack,
      });
      showError('Error', 'Ocurrió un error inesperado');
    } finally {
      console.log('🔐 [signInWithEmail] Finalizando proceso de login');
      setLoading(false);
    }
  };

  const signUpWithEmail = async () => {
    console.log('📝 [signUpWithEmail] Iniciando registro con email...');

    if (!email || !password || !confirmPassword) {
      console.warn('⚠️ [signUpWithEmail] Campos incompletos:', {
        hasEmail: !!email,
        hasPassword: !!password,
        hasConfirmPassword: !!confirmPassword,
      });
      showError('Error', 'Por favor completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      console.warn('⚠️ [signUpWithEmail] Las contraseñas no coinciden');
      showError('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      console.warn('⚠️ [signUpWithEmail] Contraseña muy corta:', {
        length: password.length,
      });
      showError('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      const emailTrimmed = email.trim();

      console.log('📝 [signUpWithEmail] Creando cuenta en Supabase:', {
        email: emailTrimmed,
        passwordLength: password.length,
      });

      const { data, error } = await supabase.auth.signUp({
        email: emailTrimmed,
        password: password,
        options: {
          emailRedirectTo: undefined, // No requerir confirmación de email
        },
      });

      if (error) {
        console.error('❌ [signUpWithEmail] Error de Supabase:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        showError('Error', error.message);
      } else {
        console.log('✅ [signUpWithEmail] Cuenta creada exitosamente:', {
          userId: data.user?.id,
          email: data.user?.email,
          emailConfirmed: data.user?.email_confirmed_at ? 'Sí' : 'No',
          sessionExists: !!data.session,
        });

        // Si el usuario se registró exitosamente, intentar iniciar sesión automáticamente
        if (data.user) {
          console.log('🔐 [signUpWithEmail] Intentando login automático después del registro...');
          // Intentar iniciar sesión inmediatamente después del registro
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: emailTrimmed,
            password: password,
          });

          if (signInError) {
            console.warn('⚠️ [signUpWithEmail] No se pudo hacer login automático:', {
              message: signInError.message,
              status: signInError.status,
            });
            // Si no puede iniciar sesión, mostrar mensaje pero permitir que intente manualmente
            showError('Error', 'Cuenta creada. Por favor inicia sesión manualmente.');
            setIsLoginMode(true);
            setEmail(emailTrimmed);
            setPassword('');
            setConfirmPassword('');
          } else {
            console.log('✅ [signUpWithEmail] Login automático exitoso:', {
              userId: signInData.user?.id,
              sessionExists: !!signInData.session,
            });
            // Si puede iniciar sesión, verificar tipo de usuario
            const hasType = await hasUserType();
            if (hasType) {
              // Redirigir según el tipo de usuario
              const userType = await getUserType();
              const initialRoute = userType === 'Jugador' ? '/(tabs)/armemosla' : '/(tabs)/home';
              router.push(initialRoute);
            } else {
              router.push('/select-user-type');
            }
          }
        } else {
          console.log('ℹ️ [signUpWithEmail] Usuario creado pero sin sesión, cambiando a modo login');
          setIsLoginMode(true);
          setEmail('');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (err: any) {
      console.error('❌ [signUpWithEmail] Error general:', {
        message: err.message,
        error: JSON.stringify(err),
        stack: err.stack,
      });
      showError('Error', 'Ocurrió un error inesperado');
    } finally {
      console.log('📝 [signUpWithEmail] Finalizando proceso de registro');
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowForgotPassword(false);
  };

  const handleForgotPassword = async () => {
    console.log('🔑 [handleForgotPassword] Iniciando recuperación de contraseña...');

    if (!resetEmail.trim()) {
      console.warn('⚠️ [handleForgotPassword] Email vacío');
      showError('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailTrimmed = resetEmail.trim();

    if (!emailRegex.test(emailTrimmed)) {
      console.warn('⚠️ [handleForgotPassword] Email inválido:', emailTrimmed);
      showError('Error', 'Por favor ingresa un correo electrónico válido');
      return;
    }

    try {
      setResetLoading(true);
      const resetPasswordURL = Linking.createURL('/reset-password');

      console.log('🔑 [handleForgotPassword] Enviando email de recuperación:', {
        email: emailTrimmed,
        redirectTo: resetPasswordURL,
      });

      const { error } = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
        redirectTo: resetPasswordURL,
      });

      if (error) {
        console.error('❌ [handleForgotPassword] Error de Supabase:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        showError('Error', error.message);
      } else {
        console.log('✅ [handleForgotPassword] Email de recuperación enviado exitosamente');
        showSuccess(
          'Email enviado',
          'Te hemos enviado un enlace para restablecer tu contraseña. Por favor revisa tu correo electrónico y haz clic en el enlace.',
          () => {
            console.log('🔑 [handleForgotPassword] Cerrando modal de recuperación');
            setShowForgotPassword(false);
            setResetEmail('');
          }
        );
      }
    } catch (err: any) {
      console.error('❌ [handleForgotPassword] Error general:', {
        message: err.message,
        error: JSON.stringify(err),
        stack: err.stack,
      });
      showError('Error', 'Ocurrió un error al enviar el email de recuperación');
    } finally {
      console.log('🔑 [handleForgotPassword] Finalizando proceso de recuperación');
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.background}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Area */}
          <View style={styles.logoContainer}>
            <Logo variant="full" format="png" width={180} height={180} />
          </View>

          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeSubtitle}>
              {isLoginMode
                ? 'Inicia sesión con tu cuenta para acceder a la aplicación'
                : 'Crea tu cuenta para acceder a todos los recursos'}
            </Text>
          </View>

          {/* Email/Password Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Correo electrónico</Text>
              <TextInput
                style={styles.textInput}
                placeholder="tu@email.com"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Contraseña</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordTextInput}
                  placeholder="Tu contraseña"
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {isLoginMode && (
                <TouchableOpacity
                  style={styles.forgotPasswordButton}
                  onPress={() => {
                    setShowForgotPassword(true);
                    setResetEmail(email);
                  }}
                  disabled={loading}
                >
                  <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isLoginMode && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirmar contraseña</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordTextInput}
                    placeholder="Confirma tu contraseña"
                    placeholderTextColor={Colors.textTertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={22}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Email/Password Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={isLoginMode ? signInWithEmail : signUpWithEmail}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Mode */}
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={toggleMode}
              disabled={loading}
            >
              <Text style={styles.toggleButtonText}>
                {isLoginMode
                  ? '¿No tienes cuenta? Regístrate'
                  : '¿Ya tienes cuenta? Inicia sesión'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>O</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.googleButtonDisabled]}
            onPress={signInWithGoogle}
            disabled={loading}
            activeOpacity={0.8}
          >
            <View style={styles.googleButtonContent}>
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continuar con Google</Text>
            </View>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Al continuar, aceptas nuestros términos de servicio
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showForgotPassword}
        onBackdropPress={() => {
          if (!resetLoading) {
            setShowForgotPassword(false);
            setResetEmail('');
          }
        }}
        onBackButtonPress={() => {
          if (!resetLoading) {
            setShowForgotPassword(false);
            setResetEmail('');
          }
        }}
        avoidKeyboard
        style={rCenter}
      >
        <View style={styles.forgotPasswordCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recuperar Contraseña</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowForgotPassword(false);
                setResetEmail('');
              }}
              disabled={resetLoading}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Correo electrónico</Text>
              <TextInput
                style={styles.textInput}
                placeholder="tu@email.com"
                placeholderTextColor={Colors.textTertiary}
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!resetLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, resetLoading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={resetLoading}
              activeOpacity={0.8}
            >
              {resetLoading ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar enlace</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotModalCancelButton}
              onPress={() => {
                setShowForgotPassword(false);
                setResetEmail('');
              }}
              disabled={resetLoading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertOptions.title}
        message={alertOptions.message}
        type={alertOptions.type}
        confirmText={alertOptions.confirmText}
        cancelText={alertOptions.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel || hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    textAlign: 'center',
    lineHeight: 22,
  },
  appSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },
  formContainer: {
    marginBottom: Spacing.md,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    backgroundColor: Colors.background,
    color: Colors.text,
    height: 40,
  },
  passwordInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingRight: 40,
    fontSize: 15,
    backgroundColor: Colors.background,
    color: Colors.text,
    height: 40,
  },
  eyeIcon: {
    position: 'absolute',
    right: Spacing.xs,
    padding: Spacing.xs,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    minHeight: 40,
    ...Shadows.sm,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textInverse,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  toggleButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  toggleButtonText: {
    fontSize: 13,
    color: Colors.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: Spacing.sm,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  googleButton: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 40,
    ...Shadows.sm,
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  googleIconText: {
    color: Colors.textInverse,
    fontSize: 11,
    fontWeight: 'bold',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
  },
  forgotPasswordButton: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Colors.secondary,
    fontWeight: '500',
  },
  forgotPasswordCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 400,
    ...Shadows.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: Colors.surface,
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  modalContent: {
    padding: Spacing.md,
  },
  modalDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  forgotModalCancelButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
