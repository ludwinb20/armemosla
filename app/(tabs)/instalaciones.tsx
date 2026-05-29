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
import { getComplejos, ComplejoWithFotos } from '../../lib/complejos';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';

type ViewType = 'complejos' | 'canchas';

export default function InstalacionesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [viewType, setViewType] = useState<ViewType>('complejos');
  
  // Estados para Complejos
  const [complejos, setComplejos] = useState<ComplejoWithFotos[]>([]);
  const [loadingComplejos, setLoadingComplejos] = useState(true);
  
  // Estados para Canchas
  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [complejosList, setComplejosList] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loadingCanchas, setLoadingCanchas] = useState(true);
  const [filterComplejoId, setFilterComplejoId] = useState<string>('');
  const [searchNombre, setSearchNombre] = useState('');
  const [showInactivas, setShowInactivas] = useState(false);
  
  const { alertVisible, alertOptions, showError, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    React.useCallback(() => {
      if (viewType === 'complejos') {
        loadComplejos();
      } else {
        loadComplejosList();
        loadCanchas();
      }
    }, [viewType])
  );

  useEffect(() => {
    if (viewType === 'canchas') {
      loadCanchas();
    }
  }, [filterComplejoId, showInactivas]);

  const loadComplejos = async () => {
    try {
      setLoadingComplejos(true);
      const data = await getComplejos();
      setComplejos(data);
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
      showError('Error', 'No se pudieron cargar los complejos');
    } finally {
      setLoadingComplejos(false);
    }
  };

  const loadComplejosList = async () => {
    try {
      const data = await getComplejos();
      setComplejosList(data.map(c => ({ id: c.id, nombre: c.nombre })));
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
    }
  };

  const loadCanchas = async () => {
    try {
      setLoadingCanchas(true);
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
      setLoadingCanchas(false);
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

  const loading = viewType === 'complejos' ? loadingComplejos : loadingCanchas;
  const isEmpty = viewType === 'complejos' ? complejos.length === 0 : canchas.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Instalaciones</Text>
        <TouchableOpacity
          onPress={() => router.push(viewType === 'complejos' ? '/complejo-form' : '/cancha-form')}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Selector de vista */}
      <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            viewType === 'complejos' && [styles.segmentButtonActive, { backgroundColor: Colors.primary }],
          ]}
          onPress={() => setViewType('complejos')}
        >
          <Ionicons 
            name="business-outline" 
            size={18} 
            color={viewType === 'complejos' ? Colors.textInverse : colors.textSecondary} 
          />
          <Text
            style={[
              styles.segmentButtonText,
              { color: viewType === 'complejos' ? Colors.textInverse : colors.textSecondary },
            ]}
          >
            Complejos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            viewType === 'canchas' && [styles.segmentButtonActive, { backgroundColor: Colors.primary }],
          ]}
          onPress={() => setViewType('canchas')}
        >
          <Ionicons 
            name="football-outline" 
            size={18} 
            color={viewType === 'canchas' ? Colors.textInverse : colors.textSecondary} 
          />
          <Text
            style={[
              styles.segmentButtonText,
              { color: viewType === 'canchas' ? Colors.textInverse : colors.textSecondary },
            ]}
          >
            Canchas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtros solo para Canchas */}
      {viewType === 'canchas' && (
        <View style={[styles.filtersContainer, { borderBottomColor: colors.borderLight }]}>
          {/* Selector de complejo */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Complejo:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.complejoSelector}>
              <TouchableOpacity
                style={[
                  styles.complejoChip,
                  { borderColor: colors.border },
                  !filterComplejoId && [styles.complejoChipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }],
                ]}
                onPress={() => setFilterComplejoId('')}
              >
                <Text
                  style={[
                    styles.complejoChipText,
                    { color: !filterComplejoId ? Colors.textInverse : colors.text },
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>
              {complejosList.map((complejo) => (
                <TouchableOpacity
                  key={complejo.id}
                  style={[
                    styles.complejoChip,
                    { borderColor: colors.border },
                    filterComplejoId === complejo.id && [styles.complejoChipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }],
                  ]}
                  onPress={() => setFilterComplejoId(complejo.id)}
                >
                  <Text
                    style={[
                      styles.complejoChipText,
                      { color: filterComplejoId === complejo.id ? Colors.textInverse : colors.text },
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
      )}

      {/* Contenido */}
      {loading && isEmpty ? (
        <PlayerLoadingView style={styles.loadingContainer} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={viewType === 'complejos' ? loadComplejos : loadCanchas}
              tintColor={Colors.primary}
            />
          }
        >
          {viewType === 'complejos' ? (
            // Vista de Complejos
            complejos.length === 0 ? (
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
                      <View style={[styles.complejoLogoPlaceholder, { backgroundColor: colors.borderLight }]}>
                        <Ionicons name="business" size={32} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.complejoInfo}>
                      <View style={styles.complejoNameRow}>
                        <Text style={[styles.complejoName, { color: colors.text }]}>{complejo.nombre}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            complejo.activo 
                              ? { backgroundColor: Colors.secondary + '20', borderColor: Colors.secondary }
                              : { backgroundColor: Colors.error + '20', borderColor: Colors.error },
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
                              { color: complejo.activo ? Colors.secondary : Colors.error },
                            ]}
                          >
                            {complejo.activo ? 'Activo' : 'Inactivo'}
                          </Text>
                        </View>
                      </View>
                      {complejo.direccion_texto && (
                        <View style={styles.complejoAddress}>
                          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                          <Text style={[styles.complejoAddressText, { color: colors.textSecondary }]}>
                            {complejo.direccion_texto}
                          </Text>
                        </View>
                      )}
                      {complejo.fotos && complejo.fotos.length > 0 && (
                        <View style={styles.complejoFotos}>
                          <Ionicons name="images-outline" size={14} color={colors.textSecondary} />
                          <Text style={[styles.complejoFotosText, { color: colors.textSecondary }]}>
                            {complejo.fotos.length} {complejo.fotos.length === 1 ? 'foto' : 'fotos'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )
          ) : (
            // Vista de Canchas
            canchas.length === 0 ? (
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
            )
          )}
        </ScrollView>
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
  segmentContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  segmentButtonActive: {
    // Estilos aplicados dinámicamente
  },
  segmentButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
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
  // Estilos de Complejos
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
  // Estilos de Canchas
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


