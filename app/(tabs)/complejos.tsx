import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../constants/theme';
import { getComplejos, ComplejoWithFotos } from '../../lib/complejos';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';

export default function ComplejosScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [complejos, setComplejos] = useState<ComplejoWithFotos[]>([]);
  const [loading, setLoading] = useState(true);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    React.useCallback(() => {
      loadComplejos();
    }, [])
  );

  const loadComplejos = async () => {
    try {
      setLoading(true);
      const data = await getComplejos();
      setComplejos(data);
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
      showError('Error', 'No se pudieron cargar los complejos');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <PlayerLoadingView style={styles.loadingContainer} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mis Complejos</Text>
        <TouchableOpacity
          onPress={() => router.push('/complejo-form')}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadComplejos}
            tintColor={Colors.primary}
          />
        }
      >
        {complejos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No tienes complejos</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Crea tu primer complejo deportivo para comenzar
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/complejo-form')}
            >
              <Text style={styles.emptyButtonText}>Crear Complejo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          complejos.map((complejo) => (
            <TouchableOpacity
              key={complejo.id}
              style={[
                styles.complejoCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                complejo.activo && { borderColor: colors.borderLight, borderWidth: 2 },
              ]}
              onPress={() => router.push(`/complejo-form?id=${complejo.id}`)}
            >
              <View style={styles.complejoHeader}>
                {complejo.logo_url ? (
                  <Image
                    source={{ uri: complejo.logo_url }}
                    style={styles.complejoLogo}
                  />
                ) : (
                  <View style={styles.complejoLogoPlaceholder}>
                    <Ionicons name="business" size={32} color={Colors.textSecondary} />
                  </View>
                )}
                <View style={styles.complejoInfo}>
                  <View style={styles.complejoNameRow}>
                    <Text style={styles.complejoName}>{complejo.nombre}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        complejo.activo ? styles.statusBadgeActive : styles.statusBadgeInactive,
                      ]}
                    >
                      <Ionicons
                        name={complejo.activo ? 'checkmark-circle' : 'close-circle'}
                        size={12}
                        color={complejo.activo ? Colors.secondary : Colors.error}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          complejo.activo ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive,
                        ]}
                      >
                        {complejo.activo ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>
                  {complejo.direccion_texto && (
                    <View style={styles.complejoAddress}>
                      <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.complejoAddressText}>
                        {complejo.direccion_texto}
                      </Text>
                    </View>
                  )}
                  {complejo.fotos && complejo.fotos.length > 0 && (
                    <View style={styles.complejoFotos}>
                      <Ionicons name="images-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.complejoFotosText}>
                        {complejo.fotos.length} {complejo.fotos.length === 1 ? 'foto' : 'fotos'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  addButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  emptyButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  complejoCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    ...Shadows.sm,
  },
  complejoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  complejoLogo: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  complejoLogoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  complejoInfo: {
    flex: 1,
  },
  complejoNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  complejoName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: Colors.textSecondary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  inactiveBadgeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.medium,
  },
  complejoAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  complejoAddressText: {
    fontSize: Typography.fontSize.xs,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  complejoFotos: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  complejoFotosText: {
    fontSize: Typography.fontSize.xs,
    marginLeft: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
});

