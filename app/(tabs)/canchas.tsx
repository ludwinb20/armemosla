import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../constants/theme';
import { getCanchas, CanchaWithRelations } from '../../lib/canchas';
import { getComplejos } from '../../lib/complejos';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';

export default function CanchasScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [complejos, setComplejos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filterComplejoId, setFilterComplejoId] = useState<string>('');
  const [searchNombre, setSearchNombre] = useState('');
  const [showInactivas, setShowInactivas] = useState(false);
  const { alertVisible, alertOptions, showError, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    React.useCallback(() => {
      loadComplejos();
      loadCanchas();
    }, [])
  );

  useEffect(() => {
    loadCanchas();
  }, [filterComplejoId, showInactivas]);

  const loadComplejos = async () => {
    try {
      const data = await getComplejos();
      setComplejos(data.map(c => ({ id: c.id, nombre: c.nombre })));
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
    }
  };

  const loadCanchas = async () => {
    try {
      setLoading(true);
      const activo = showInactivas ? undefined : true;
      const data = await getCanchas(filterComplejoId || undefined, activo);
      
      // Filtrar por nombre si hay búsqueda
      let filteredData = data;
      if (searchNombre.trim()) {
        filteredData = data.filter(cancha =>
          cancha.nombre?.toLowerCase().includes(searchNombre.toLowerCase().trim())
        );
      }
      
      setCanchas(filteredData);
    } catch (error: any) {
      console.error('Error al cargar canchas:', error);
      showError('Error', 'No se pudieron cargar las canchas');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchNombre(text);
    // Filtrar en tiempo real
    if (text.trim()) {
      const filtered = canchas.filter(cancha =>
        cancha.nombre?.toLowerCase().includes(text.toLowerCase().trim())
      );
      setCanchas(filtered);
    } else {
      loadCanchas();
    }
  };

  if (loading && canchas.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <PlayerLoadingView style={styles.loadingContainer} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Canchas</Text>
        <TouchableOpacity
          onPress={() => router.push('/cancha-form')}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        {/* Selector de complejo */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Complejo:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.complejoSelector}>
            <TouchableOpacity
              style={[
                styles.complejoChip,
                !filterComplejoId && styles.complejoChipActive,
              ]}
              onPress={() => setFilterComplejoId('')}
            >
              <Text
                style={[
                  styles.complejoChipText,
                  !filterComplejoId && styles.complejoChipTextActive,
                ]}
              >
                Todos
              </Text>
            </TouchableOpacity>
            {complejos.map((complejo) => (
              <TouchableOpacity
                key={complejo.id}
                style={[
                  styles.complejoChip,
                  filterComplejoId === complejo.id && styles.complejoChipActive,
                ]}
                onPress={() => setFilterComplejoId(complejo.id)}
              >
                <Text
                  style={[
                    styles.complejoChipText,
                    filterComplejoId === complejo.id && styles.complejoChipTextActive,
                  ]}
                >
                  {complejo.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Búsqueda por nombre */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar por nombre..."
            placeholderTextColor={colors.textTertiary}
            value={searchNombre}
            onChangeText={handleSearchChange}
          />
          {searchNombre.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchNombre('');
              loadCanchas();
            }}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Toggle mostrar inactivas */}
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Mostrar inactivas</Text>
          <Switch
            value={showInactivas}
            onValueChange={setShowInactivas}
            trackColor={{ false: colors.borderLight, true: Colors.primary + '40' }}
            thumbColor={showInactivas ? Colors.primary : colors.textSecondary}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadCanchas}
            tintColor={Colors.primary}
          />
        }
      >
        {canchas.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="football-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No hay canchas</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchNombre || filterComplejoId
                ? 'No se encontraron canchas con los filtros aplicados'
                : 'Crea tu primera cancha para comenzar'}
            </Text>
            {!searchNombre && !filterComplejoId && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/cancha-form')}
              >
                <Text style={styles.emptyButtonText}>Crear Cancha</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          canchas.map((cancha) => (
            <TouchableOpacity
              key={cancha.id}
              style={[
                styles.canchaCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                cancha.activo && { borderColor: colors.borderLight, borderWidth: 2 },
              ]}
              onPress={() => router.push(`/cancha-form?id=${cancha.id}`)}
            >
              <View style={styles.canchaHeader}>
                {cancha.fotos && cancha.fotos.length > 0 && (
                  <Image
                    source={{ uri: cancha.fotos[0].foto_url }}
                    style={styles.canchaImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.canchaInfo}>
                  <View style={styles.canchaNameRow}>
                    <Text style={[styles.canchaName, { color: colors.text }]}>
                      {cancha.nombre || `Cancha ${cancha.id.slice(0, 8)}`}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        cancha.activo 
                          ? { backgroundColor: Colors.secondary + '20', borderColor: Colors.secondary }
                          : { backgroundColor: Colors.error + '20', borderColor: Colors.error },
                      ]}
                    >
                      <Ionicons
                        name={cancha.activo ? 'checkmark-circle' : 'close-circle'}
                        size={12}
                        color={cancha.activo ? Colors.secondary : Colors.error}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: cancha.activo ? Colors.secondary : Colors.error },
                        ]}
                      >
                        {cancha.activo ? 'Activa' : 'Inactiva'}
                      </Text>
                    </View>
                  </View>
                  {cancha.complejo && (
                    <View style={styles.canchaComplejo}>
                      <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.canchaComplejoText, { color: colors.textSecondary }]}>{cancha.complejo.nombre}</Text>
                    </View>
                  )}
                  <View style={styles.canchaDetails}>
                    <View style={styles.canchaDetailItem}>
                      <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.canchaDetailText, { color: colors.textSecondary }]}>
                        {cancha.jugadores_por_equipo} vs {cancha.jugadores_por_equipo}
                      </Text>
                    </View>
                    <View style={styles.canchaDetailItem}>
                      <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.canchaDetailText, { color: colors.textSecondary }]}>
                        L {cancha.precio_por_hora.toLocaleString()}/hora
                      </Text>
                    </View>
                    {cancha.largo && cancha.ancho && (
                      <View style={styles.canchaDetailItem}>
                        <Ionicons name="resize-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.canchaDetailText, { color: colors.textSecondary }]}>
                          {cancha.largo}m x {cancha.ancho}m
                        </Text>
                      </View>
                    )}
                  </View>
                  {cancha.fotos && cancha.fotos.length > 0 && (
                    <View style={styles.canchaFotos}>
                      <Ionicons name="images-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.canchaFotosText, { color: colors.textSecondary }]}>
                        {cancha.fotos.length} {cancha.fotos.length === 1 ? 'foto' : 'fotos'}
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
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  addButton: {
    padding: Spacing.xs,
  },
  filtersContainer: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  filterRow: {
    marginBottom: Spacing.sm,
  },
  filterLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  complejoSelector: {
    flexDirection: 'row',
  },
  complejoChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  complejoChipActive: {
    // Estilos aplicados dinámicamente
  },
  complejoChipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    marginLeft: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
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
  canchaCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  canchaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  canchaImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.borderLight,
  },
  canchaInfo: {
    flex: 1,
  },
  canchaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  canchaName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    flex: 1,
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
  canchaComplejo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  canchaComplejoText: {
    fontSize: Typography.fontSize.xs,
    marginLeft: Spacing.xs,
  },
  canchaDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  canchaDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  canchaDetailText: {
    fontSize: Typography.fontSize.xs,
  },
  canchaFotos: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  canchaFotosText: {
    fontSize: Typography.fontSize.xs,
    marginLeft: Spacing.xs,
  },
});

