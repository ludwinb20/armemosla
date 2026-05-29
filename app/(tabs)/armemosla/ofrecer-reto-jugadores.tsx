import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../../constants/theme';
import { useThemeColors } from '../../../hooks/useThemeColors';
import {
  crearRetoDirectoJugador,
  JugadorRetoCandidato,
  listarJugadoresParaReto,
} from '../../../lib/partidos';
import { useCustomAlert } from '../../../hooks/useCustomAlert';
import PlayerLoadingView from '../../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../../components/lottie/PlayerEmptyState';
import CustomAlert from '../../../components/CustomAlert';

const PAGE_SIZE = 15;
const RPC_TIMEOUT_MS = 12000;

const DEMO_JUGADORES: JugadorRetoCandidato[] = [
  {
    jugador_id: 'demo-jugador-1',
    full_name: 'Carlos Pineda',
    avatar_url: null,
    equipo_id: 'demo-equipo-1',
    equipo_nombre: 'Los Catrachos FC',
    equipo_logo_url: null,
    equipo_nombre_visible: 'Los Catrachos FC',
    complejos_en_comun: 4,
    ya_invitado: false,
  },
  {
    jugador_id: 'demo-jugador-2',
    full_name: 'Marvin Zelaya',
    avatar_url: null,
    equipo_id: null,
    equipo_nombre: null,
    equipo_logo_url: null,
    equipo_nombre_visible: 'Equipo de Marvin Zelaya',
    complejos_en_comun: 3,
    ya_invitado: false,
  },
  {
    jugador_id: 'demo-jugador-3',
    full_name: 'Josue Figueroa',
    avatar_url: null,
    equipo_id: 'demo-equipo-3',
    equipo_nombre: 'Reto Progreso',
    equipo_logo_url: null,
    equipo_nombre_visible: 'Reto Progreso',
    complejos_en_comun: 2,
    ya_invitado: false,
  },
];

export default function OfrecerRetoJugadoresScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ reservaId?: string }>();
  const reservaId = typeof params.reservaId === 'string' ? params.reservaId : '';

  const [items, setItems] = useState<JugadorRetoCandidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sendingToId, setSendingToId] = useState<string | null>(null);
  const [usingDemoData, setUsingDemoData] = useState(false);

  const {
    alertVisible,
    alertOptions,
    showError,
    showSuccess,
    handleConfirm,
    handleCancel,
  } = useCustomAlert();

  const canUseScreen = useMemo(() => Boolean(reservaId), [reservaId]);

  const loadPage = useCallback(
    async (nextOffset: number, replace: boolean) => {
      if (!canUseScreen) return;
      const page = await Promise.race<JugadorRetoCandidato[]>([
        listarJugadoresParaReto(reservaId, PAGE_SIZE, nextOffset),
        new Promise<JugadorRetoCandidato[]>((_, reject) =>
          setTimeout(() => reject(new Error('Tiempo de espera agotado cargando jugadores/equipos.')), RPC_TIMEOUT_MS)
        ),
      ]);
      setHasMore(page.length === PAGE_SIZE);
      setOffset(nextOffset + page.length);
      setItems((prev) => (replace ? page : [...prev, ...page]));
    },
    [canUseScreen, reservaId]
  );

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      setUsingDemoData(false);
      await loadPage(0, true);
    } catch (e: any) {
      setItems(DEMO_JUGADORES);
      setHasMore(false);
      setOffset(DEMO_JUGADORES.length);
      setUsingDemoData(true);
      showError(
        'Modo prueba activado',
        (e?.message || 'No se pudo cargar la lista de jugadores/equipos') +
          '. Se muestran jugadores/equipos de prueba.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadPage]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitial();
  };

  const onEndReached = async () => {
    if (loading || loadingMore || !hasMore || usingDemoData) return;
    try {
      setLoadingMore(true);
      await loadPage(offset, false);
    } catch (e: any) {
      showError('Error', e?.message || 'No se pudieron cargar más jugadores');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOfrecer = async (item: JugadorRetoCandidato) => {
    if (item.jugador_id.startsWith('demo-')) {
      setItems((prev) =>
        prev.map((x) =>
          x.jugador_id === item.jugador_id ? { ...x, ya_invitado: true } : x
        )
      );
      showSuccess('Listo', `Reto de prueba enviado a ${item.full_name || 'jugador'}.`);
      return;
    }

    try {
      setSendingToId(item.jugador_id);
      await crearRetoDirectoJugador(reservaId, item.jugador_id);
      setItems((prev) =>
        prev.map((x) =>
          x.jugador_id === item.jugador_id ? { ...x, ya_invitado: true } : x
        )
      );
      showSuccess('Listo', `Reto enviado a ${item.full_name || 'jugador'}.`);
    } catch (e: any) {
      showError('Error', e?.message || 'No se pudo enviar el reto');
    } finally {
      setSendingToId(null);
    }
  };

  if (!canUseScreen) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <PlayerEmptyState
          variant="emptyField"
          title="Reserva inválida"
          text="No se encontró la reserva para ofrecer reto."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/armemosla'))}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={[styles.title, { color: colors.text }]}>Ofrecer reto</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Jugadores/equipos ordenados por centros deportivos en común.
          </Text>
        </View>
      </View>

      {loading ? (
        <PlayerLoadingView message="Cargando jugadores/equipos..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.jugador_id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.45}
          ListEmptyComponent={
            <PlayerEmptyState
              variant="waitingPlayers"
              title="No hay jugadores/equipos disponibles"
              text="Todavía no encontramos jugadores/equipos para ofrecer este reto."
              compact
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const disabled = item.ya_invitado || sendingToId === item.jugador_id;
            return (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  Shadows.sm,
                ]}
              >
                <View style={styles.cardTop}>
                  {item.equipo_logo_url ? (
                    <Image source={{ uri: item.equipo_logo_url }} style={styles.logo} />
                  ) : (
                    <View style={[styles.logoPlaceholder, { backgroundColor: colors.borderLight }]}>
                      <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.metaWrap}>
                    <Text style={[styles.playerName, { color: colors.text }]}>
                      {item.full_name || 'Jugador'}
                    </Text>
                    <Text style={[styles.teamName, { color: colors.textSecondary }]}>
                      {item.equipo_nombre_visible}
                    </Text>
                  </View>
                </View>

                <View style={[styles.scorePill, { backgroundColor: colors.borderLight }]}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.scorePillText, { color: colors.textSecondary }]}>
                    {item.complejos_en_comun} complejos en común
                  </Text>
                </View>

                <TouchableOpacity
                  disabled={disabled}
                  onPress={() => handleOfrecer(item)}
                  style={[
                    styles.offerBtn,
                    {
                      backgroundColor: disabled ? colors.borderLight : Colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.offerBtnText,
                      { color: disabled ? colors.textSecondary : Colors.textInverse },
                    ]}
                  >
                    {item.ya_invitado ? 'Reto enviado' : sendingToId === item.jugador_id ? 'Enviando...' : 'Ofrecer reto'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <CustomAlert
        visible={alertVisible}
        title={alertOptions.title}
        message={alertOptions.message}
        type={alertOptions.type}
        confirmText={alertOptions.confirmText}
        cancelText={alertOptions.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  headerTitles: { flex: 1 },
  title: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold },
  subtitle: { fontSize: Typography.fontSize.sm, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, fontSize: Typography.fontSize.md },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, borderRadius: 22, marginRight: Spacing.sm },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaWrap: { flex: 1 },
  playerName: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
  teamName: { fontSize: Typography.fontSize.sm, marginTop: 2 },
  scorePill: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  scorePillText: { fontSize: Typography.fontSize.xs },
  offerBtn: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  offerBtnText: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginTop: Spacing.md },
  emptyText: { fontSize: Typography.fontSize.sm, textAlign: 'center', marginTop: Spacing.sm },
  footerLoading: { paddingVertical: Spacing.lg },
  backPrimary: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  backPrimaryText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});
