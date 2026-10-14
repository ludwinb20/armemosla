import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { ensureAppRole, getInitialAppRoute } from '../lib/user';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import * as Linking from 'expo-linking';
import { Logo } from '../components/Logo';
import { GoogleLogo } from '../components/icons/GoogleLogo';
import { configureGoogleSignIn, signInWithGoogle as signInWithGoogleAuth } from '../lib/auth/google';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import { Screen, Button, Input, Text, Modal, ModalBody, Divider } from '@/components/ui';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log('🔐 [signInWithGoogle] Iniciando login con Google...');
      setLoading(true);

      const { data, error, googleUser } = await signInWithGoogleAuth();
      if (googleUser?.photo) {
        await AsyncStorage.setItem('google_avatar', googleUser.photo);
        console.log('💾 [signInWithGoogle] Google avatar guardado en AsyncStorage');
      }

      if (error) {
        console.error('❌ [signInWithGoogle] Error de Supabase:', {
          message: error.message,
        });
        showError('Error con Google', error.message);
        return;
      } else {
        console.log('✅ [signInWithGoogle] Login exitoso:', {
          userId: data.user?.id,
          email: data.user?.email,
          sessionExists: !!data.session,
        });

        try {
          await ensureAppRole();
          router.push(await getInitialAppRoute());
        } catch (roleError: any) {
          showError('App incorrecta', roleError?.message || 'Esta cuenta no corresponde a esta app.');
          await supabase.auth.signOut();
        }
      }
    } catch (err: any) {
      console.error('❌ [signInWithGoogle] Error general:', {
        message: err instanceof Error ? err.message : String(err),
        error: JSON.stringify(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      showError('Error con Google', err?.message || 'Error al iniciar sesión con Google');
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

        try {
          await ensureAppRole();
          router.push(await getInitialAppRoute());
        } catch (roleError: any) {
          showError('App incorrecta', roleError?.message || 'Esta cuenta no corresponde a esta app.');
          await supabase.auth.signOut();
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
          emailRedirectTo: undefined,
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

        if (data.user) {
          console.log('🔐 [signUpWithEmail] Intentando login automático después del registro...');
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: emailTrimmed,
            password: password,
          });

          if (signInError) {
            console.warn('⚠️ [signUpWithEmail] No se pudo hacer login automático:', {
              message: signInError.message,
              status: signInError.status,
            });
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
            try {
          await ensureAppRole();
          router.push(await getInitialAppRoute());
        } catch (roleError: any) {
          showError('App incorrecta', roleError?.message || 'Esta cuenta no corresponde a esta app.');
          await supabase.auth.signOut();
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

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setResetEmail('');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-md py-sm"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mt-sm mb-md">
            <Logo variant="full" format="png" width={180} height={180} />
          </View>

          <View className="items-center mb-md">
            <Text variant="bodySecondary" className="text-center px-md">
              {isLoginMode
                ? 'Inicia sesión con tu cuenta para acceder a la aplicación'
                : 'Crea tu cuenta para acceder a todos los recursos'}
            </Text>
          </View>

          <View className="mb-md gap-md">
            <Input
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <View>
              <Input
                label="Contraseña"
                placeholder="Tu contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
              {isLoginMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-end mt-sm"
                  onPress={() => {
                    setShowForgotPassword(true);
                    setResetEmail(email);
                  }}
                  disabled={loading}
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              )}
            </View>

            {!isLoginMode && (
              <Input
                label="Confirmar contraseña"
                placeholder="Confirma tu contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
            )}

            <Button
              onPress={isLoginMode ? signInWithEmail : signUpWithEmail}
              disabled={loading}
            >
              {isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </Button>

            <Button variant="ghost" onPress={toggleMode} disabled={loading}>
              {isLoginMode
                ? '¿No tienes cuenta? Regístrate'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </Button>
          </View>

          <View className="flex-row items-center my-md gap-sm">
            <View className="flex-1">
              <Divider className="my-0" />
            </View>
            <Text variant="caption">O</Text>
            <View className="flex-1">
              <Divider className="my-0" />
            </View>
          </View>

          <Button variant="outline" onPress={signInWithGoogle} disabled={loading}>
            <View className="flex-row items-center justify-center gap-sm">
              <GoogleLogo size={20} />
              <Text variant="label">Continuar con Google</Text>
            </View>
          </Button>

          <View className="items-center mt-lg mb-md">
            <Text variant="caption" className="text-center">
              Al continuar, aceptas nuestros términos de servicio
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showForgotPassword}
        onClose={() => {
          if (!resetLoading) {
            closeForgotPasswordModal();
          }
        }}
        avoidKeyboard
      >
        <View className="flex-row justify-between items-center mb-md">
          <Text variant="h3">Recuperar Contraseña</Text>
          <Button
            variant="ghost"
            size="sm"
            onPress={closeForgotPasswordModal}
            disabled={resetLoading}
          >
            ✕
          </Button>
        </View>
        <Divider className="my-0 mb-md" />

        <ModalBody>
          <Text variant="bodySecondary">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </Text>

          <Input
            label="Correo electrónico"
            placeholder="tu@email.com"
            value={resetEmail}
            onChangeText={setResetEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!resetLoading}
          />

          <Button onPress={handleForgotPassword} disabled={resetLoading}>
            Enviar enlace
          </Button>

          <Button variant="ghost" onPress={closeForgotPasswordModal} disabled={resetLoading}>
            Cancelar
          </Button>
        </ModalBody>
      </Modal>

      {(loading || resetLoading) && (
        <View
          className="absolute inset-0 justify-center items-center z-[100]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
        >
          <PlayerLoadingView
            message={resetLoading ? 'Enviando enlace...' : 'Iniciando sesión...'}
            messageStyle={{ color: '#FFFFFF' }}
            style={{ padding: 24 }}
          />
        </View>
      )}

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
    </Screen>
  );
}
