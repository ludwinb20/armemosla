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
import { getComplejos, ComplejoWithFotos, deleteComplejo } from '../../lib/complejos';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';

export default function ComplejosScreen() {
  const router = useRouter();
  const [complejos, setComplejos] = useState<ComplejoWithFotos[]>([]);
  const [loading, setLoading] = useState(true);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm } = useCustomAlert();

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

  const handleDelete = async (id: string, nombre: string) => {
    showError(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar el complejo "${nombre}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await deleteComplejo(id);
          showSuccess('Éxito', 'Complejo eliminado correctamente');
          loadComplejos();
        } catch (error: any) {
          showError('Error', 'No se pudo eliminar el complejo');
        }
      }
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Complejos</Text>
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
            <Ionicons name="business-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No tienes complejos</Text>
            <Text style={styles.emptyText}>
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
              style={styles.complejoCard}
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
                  <Text style={styles.complejoName}>{complejo.nombre}</Text>
                  <View style={styles.complejoAddress}>
                    <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.complejoAddressText}>
                      {complejo.direccion_texto || 
                       (complejo.direccion_lat && complejo.direccion_lng 
                         ? `${complejo.direccion_lat.toFixed(6)}, ${complejo.direccion_lng.toFixed(6)}`
                         : 'Sin dirección')}
                    </Text>
                  </View>
                  {complejo.fotos && complejo.fotos.length > 0 && (
                    <View style={styles.complejoFotos}>
                      <Ionicons name="images-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.complejoFotosText}>
                        {complejo.fotos.length} {complejo.fotos.length === 1 ? 'foto' : 'fotos'}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(complejo.id, complejo.nombre)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
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
        onConfirm={handleConfirm}
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
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
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
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  complejoInfo: {
    flex: 1,
  },
  complejoName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  complejoAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  complejoAddressText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  complejoFotos: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  complejoFotosText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  deleteButton: {
    padding: Spacing.xs,
  },
});

