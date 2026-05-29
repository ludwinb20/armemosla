import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../constants/theme';
import { Logo } from '../components/Logo';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';

type UserType = 'Jugador' | 'Administrador de Cancha';

export default function SelectUserTypeScreen() {
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);
  const { alertVisible, alertOptions, showError, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  const handleSelectType = async () => {
    if (!selectedType) {
      showError('Error', 'Por favor selecciona un tipo de usuario');
      return;
    }

    try {
      setLoading(true);
      
      // Obtener el usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('❌ [SelectUserType] Error al obtener usuario:', userError);
        showError('Error', 'No se pudo obtener la información del usuario. Por favor inicia sesión nuevamente.');
        return;
      }

      console.log('✅ [SelectUserType] Usuario obtenido:', user.id);

      // Actualizar el perfil con el tipo de usuario
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ user_type: selectedType })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ [SelectUserType] Error al actualizar perfil:', updateError);
        showError('Error', 'No se pudo guardar tu selección. Por favor intenta nuevamente.');
        return;
      }

      console.log('✅ [SelectUserType] Tipo de usuario guardado:', selectedType);
      
      // Redirigir según el tipo de usuario seleccionado
      const initialRoute = selectedType === 'Jugador' ? '/(tabs)/armemosla' : '/(tabs)/home';
      router.replace(initialRoute);
    } catch (err: any) {
      console.error('❌ [SelectUserType] Error general:', {
        message: err.message,
        error: JSON.stringify(err),
      });
      showError('Error', 'Ocurrió un error inesperado. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Area */}
          <View style={styles.logoContainer}>
            <Logo variant="full" format="png" width={170} height={170} />
          </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Selecciona tu tipo de cuenta</Text>
          <Text style={styles.subtitle}>
            Elige cómo quieres usar la aplicación. Podrás cambiar esto más tarde en tu perfil.
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {/* Jugador Option */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === 'Jugador' && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedType('Jugador')}
            activeOpacity={0.7}
            disabled={loading}
          >
            <View style={styles.optionContent}>
              <View style={[
                styles.iconContainer,
                selectedType === 'Jugador' && styles.iconContainerSelected,
              ]}>
                <Ionicons
                  name="person"
                  size={24}
                  color={selectedType === 'Jugador' ? Colors.textInverse : Colors.primary}
                />
              </View>
              <Text style={[
                styles.optionTitle,
                selectedType === 'Jugador' && styles.optionTitleSelected,
              ]}>
                Jugador
              </Text>
              <Text style={styles.optionDescription}>
                Busca canchas, reserva horarios y únete a partidos
              </Text>
            </View>
            {selectedType === 'Jugador' && (
              <View style={styles.checkmarkContainer}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              </View>
            )}
          </TouchableOpacity>

          {/* Administrador de Cancha Option */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === 'Administrador de Cancha' && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedType('Administrador de Cancha')}
            activeOpacity={0.7}
            disabled={loading}
          >
            <View style={styles.optionContent}>
              <View style={[
                styles.iconContainer,
                selectedType === 'Administrador de Cancha' && styles.iconContainerSelected,
              ]}>
                <Ionicons
                  name="business"
                  size={24}
                  color={selectedType === 'Administrador de Cancha' ? Colors.textInverse : Colors.primary}
                />
              </View>
              <Text style={[
                styles.optionTitle,
                selectedType === 'Administrador de Cancha' && styles.optionTitleSelected,
              ]}>
                Administrador de Cancha
              </Text>
              <Text style={styles.optionDescription}>
                Gestiona tu cancha, horarios y reservas
              </Text>
            </View>
            {selectedType === 'Administrador de Cancha' && (
              <View style={styles.checkmarkContainer}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, (!selectedType || loading) && styles.continueButtonDisabled]}
          onPress={handleSelectType}
          disabled={!selectedType || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continuar</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <PlayerLoadingView
            message="Configurando tu cuenta..."
            messageStyle={styles.loadingOverlayMessage}
            style={styles.loadingOverlayContent}
          />
        </View>
      )}

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
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  optionsContainer: {
    marginBottom: Spacing.md,
  },
  optionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  optionCardSelected: {
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
    ...Shadows.md,
  },
  optionContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  iconContainerSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  optionTitleSelected: {
    color: Colors.primary,
  },
  optionDescription: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  checkmarkContainer: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    minHeight: 40,
    ...Shadows.sm,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingOverlayContent: {
    flex: 0,
    padding: Spacing.lg,
  },
  loadingOverlayMessage: {
    color: '#FFFFFF',
  },
});

