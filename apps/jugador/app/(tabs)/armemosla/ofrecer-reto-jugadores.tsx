import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  View,
  Pressable,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  crearRetoDirectoJugador,
  JugadorRetoCandidato,
  listarJugadoresParaReto,
} from '../../../lib/partidos';
import { useCustomAlert } from '../../../hooks/useCustomAlert';
import PlayerLoadingView from '../../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../../components/lottie/PlayerEmptyState';
import CustomAlert from '../../../components/CustomAlert';
import { Screen, Text, Card, Button, Divider } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

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
  const { colors } = useGlassTheme();
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
      <Screen edges={['top', 'bottom']}>
        <PlayerEmptyState
          variant="emptyField"
          title="Reserva inválida"
          text="No se encontró la reserva para ofrecer reto."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center px-md py-md gap-sm">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/armemosla'))}
          className="p-xs"
          hitSlop={12}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View className="flex-1">
          <Text variant="h3">Ofrecer reto</Text>
          <Text variant="caption" className="mt-0.5">
            Jugadores/equipos ordenados por centros deportivos en común.
          </Text>
        </View>
      </View>
      <Divider className="my-0" />

      {loading ? (
        <PlayerLoadingView message="Cargando jugadores/equipos..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.jugador_id}
          contentContainerClassName="p-md pb-xxl"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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
              <View className="py-lg items-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const disabled = item.ya_invitado || sendingToId === item.jugador_id;
            return (
              <Card className="mb-md">
                <View className="flex-row items-center">
                  {item.equipo_logo_url ? (
                    <Image source={{ uri: item.equipo_logo_url }} className="w-11 h-11 rounded-full mr-sm" />
                  ) : (
                    <View
                      className="w-11 h-11 rounded-full mr-sm items-center justify-center"
                      style={{ backgroundColor: colors.borderSubtle }}
                    >
                      <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text variant="label" className="font-semibold">
                      {item.full_name || 'Jugador'}
                    </Text>
                    <Text variant="caption" className="mt-0.5">
                      {item.equipo_nombre_visible}
                    </Text>
                  </View>
                </View>

                <View
                  className="mt-sm self-start flex-row items-center gap-1 px-sm py-1 rounded-sm"
                  style={{ backgroundColor: colors.borderSubtle }}
                >
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text variant="caption">
                    {item.complejos_en_comun} complejos en común
                  </Text>
                </View>

                <Button
                  disabled={disabled}
                  loading={sendingToId === item.jugador_id && !item.ya_invitado}
                  onPress={() => handleOfrecer(item)}
                  className="mt-md"
                >
                  {item.ya_invitado ? 'Reto enviado' : sendingToId === item.jugador_id ? 'Enviando...' : 'Ofrecer reto'}
                </Button>
              </Card>
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
    </Screen>
  );
}
