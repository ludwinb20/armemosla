import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import {
  aclaracionProgresoLogro,
  sincronizarLogrosJugador,
  obtenerLogrosJugador,
  obtenerRecompensasDisponibles,
  formatoQrCanje,
  descripcionRecompensa,
  textoInstruccionCanjeRecompensa,
  textoProgresoLogro,
  LogroConProgreso,
  RecompensaJugador,
} from '../../lib/logros';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import PlayerEmptyState from '../../components/lottie/PlayerEmptyState';
import SoccerLottie from '../../components/lottie/SoccerLottie';
import CustomAlert from '../../components/CustomAlert';
import { Screen, Text, Card, Button, Modal, Divider } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function iconoLogro(icono: string, size: number, color: string) {
  if (icono === 'football') {
    return <MaterialCommunityIcons name="soccer" size={size} color={color} />;
  }
  if (icono === 'compass') {
    return <MaterialCommunityIcons name="compass-outline" size={size} color={color} />;
  }
  return <Ionicons name="trophy" size={size} color={color} />;
}

export default function LogrosScreen() {
  const { colors } = useGlassTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logros, setLogros] = useState<LogroConProgreso[]>([]);
  const [recompensas, setRecompensas] = useState<RecompensaJugador[]>([]);
  const [recompensaQr, setRecompensaQr] = useState<RecompensaJugador | null>(null);
  const { alertVisible, alertOptions, showError, hideAlert, handleConfirm, handleCancel } = useCustomAlert();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const loadData = useCallback(async () => {
    try {
      const sync = await sincronizarLogrosJugador().catch((e: unknown) => ({
        ok: false as const,
        reason: 'error' as const,
        message: e instanceof Error ? e.message : 'Error de sincronización',
      }));
      if (!sync.ok && sync.reason === 'rpc_missing') {
        console.warn('[Logros]', sync.message);
      } else if (!sync.ok) {
        console.warn('[Logros] sync:', sync.message);
      }

      const [logrosResult, recompensasResult] = await Promise.allSettled([
        obtenerLogrosJugador(),
        obtenerRecompensasDisponibles(),
      ]);

      if (logrosResult.status === 'fulfilled') {
        setLogros(logrosResult.value);
      } else {
        console.error('Error al cargar logros:', logrosResult.reason);
        setLogros([]);
      }

      if (recompensasResult.status === 'fulfilled') {
        setRecompensas(recompensasResult.value);
      } else {
        console.error('Error al cargar recompensas:', recompensasResult.reason);
        setRecompensas([]);
      }

      if (logrosResult.status === 'rejected' && recompensasResult.status === 'rejected') {
        showErrorRef.current('Error', 'No se pudieron cargar tus logros');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const abrirQrCanje = (recompensa: RecompensaJugador) => {
    setRecompensaQr(recompensa);
  };

  const cerrarQr = () => {
    setRecompensaQr(null);
  };

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <PlayerLoadingView message="Cargando logros..." />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-xl"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View className="px-lg py-md">
          <Text variant="h3">Logros</Text>
          <Text variant="bodySecondary" className="mt-xs">
            Jugá, desbloqueá recompensas y canjealas al llegar a la cancha
          </Text>
        </View>
        <Divider className="my-0" />

        {recompensas.length > 0 && (
          <View className="px-lg pt-lg">
            <Text variant="h4" className="mb-md">
              Recompensas disponibles
            </Text>
            {recompensas.map((recompensa) => (
              <Card
                key={recompensa.id}
                className="mb-md"
                style={{ borderColor: colors.primary + '40' }}
              >
                <View className="flex-row gap-md mb-md">
                  <View
                    className="w-11 h-11 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.primary + '20' }}
                  >
                    <Ionicons name="gift-outline" size={22} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text variant="label" className="font-semibold">
                      {recompensa.logro?.titulo || 'Recompensa'}
                    </Text>
                    <Text variant="caption" className="mt-0.5" style={{ color: colors.primary }}>
                      {descripcionRecompensa(recompensa)}
                    </Text>
                    {recompensa.cancha_restriccion && (
                      <Text variant="caption" className="mt-1">
                        Solo en {recompensa.cancha_restriccion.nombre}
                      </Text>
                    )}
                    {recompensa.expires_at && (
                      <Text variant="caption" className="mt-0.5">
                        Vence: {formatFecha(recompensa.expires_at)}
                      </Text>
                    )}
                  </View>
                </View>
                <Button onPress={() => abrirQrCanje(recompensa)} size="sm">
                  <View className="flex-row items-center gap-sm">
                    <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                    <Text variant="inverse">Mostrar QR para canjear</Text>
                  </View>
                </Button>
              </Card>
            ))}
          </View>
        )}

        <View className="px-lg pt-lg">
          <Text variant="h4" className="mb-md">
            Tu progreso
          </Text>
          {logros.length === 0 ? (
            <PlayerEmptyState
              variant="trophy"
              title="Próximamente más logros"
              text="Seguí jugando para desbloquear recompensas."
              compact
            />
          ) : (
            logros.map((logro) => {
              const actual = logro.progreso?.valor_actual ?? 0;
              const meta = logro.progreso?.valor_meta ?? 1;
              const pct = Math.min(100, Math.round((actual / meta) * 100));
              const completado = actual >= meta;
              const aclaracion = aclaracionProgresoLogro(logro);

              return (
                <Card key={logro.id} className="mb-md">
                  <View className="flex-row items-start gap-md">
                    <View
                      className="w-11 h-11 rounded-full items-center justify-center"
                      style={{ backgroundColor: completado ? colors.success + '20' : colors.background }}
                    >
                      {iconoLogro(logro.icono, 24, completado ? colors.success : colors.primary)}
                    </View>
                    <View className="flex-1">
                      <Text variant="label" className="font-semibold">
                        {logro.titulo}
                      </Text>
                      <Text variant="caption" className="mt-0.5">
                        {logro.descripcion}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-md">
                    <View
                      className="h-2 rounded overflow-hidden"
                      style={{ backgroundColor: colors.borderSubtle }}
                    >
                      <View
                        className="h-full rounded"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: completado ? colors.success : colors.primary,
                        }}
                      />
                    </View>
                    <Text variant="caption" className="mt-xs">
                      {textoProgresoLogro(logro)}
                    </Text>
                    {aclaracion ? (
                      <Text variant="caption" className="mt-xs leading-[18px]">
                        {aclaracion}
                      </Text>
                    ) : null}
                  </View>
                  {completado && (
                    <View
                      className="flex-row items-center gap-1.5 mt-sm px-sm py-1 rounded-lg self-start"
                      style={{ backgroundColor: colors.success + '15' }}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text variant="caption" style={{ color: colors.success }}>
                        ¡Logro desbloqueado!
                      </Text>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </View>

        {recompensas.length === 0 && logros.every((l) => (l.progreso?.valor_actual ?? 0) === 0) && (
          <Card
            className="mx-lg mt-lg items-center"
            style={{ borderColor: colors.primary + '30', backgroundColor: colors.primary + '10' }}
          >
            <SoccerLottie variant="trophy" size={48} />
            <Text variant="h4" className="mt-sm">
              Empezá a sumar
            </Text>
            <Text variant="caption" className="text-center mt-sm">
              Reservá canchas desde Armemosla y completá partidos. Cada reserva te acerca a recompensas reales.
            </Text>
          </Card>
        )}
      </ScrollView>

      <Modal visible={!!recompensaQr} onClose={cerrarQr} position="center" sheetClassName="max-h-[85%]">
        <View className="flex-row justify-between items-center pb-md">
          <Text variant="h4">Canjear recompensa</Text>
          <Pressable onPress={cerrarQr}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <Divider className="my-0 mb-md" />

        <ScrollView keyboardShouldPersistTaps="handled">
          {recompensaQr ? (
            <>
              <Text variant="caption" className="text-center mb-md">
                {textoInstruccionCanjeRecompensa(recompensaQr)}
              </Text>
              <View className="self-center p-md bg-white rounded-lg mb-md">
                <QRCode
                  value={formatoQrCanje(recompensaQr.canje_token)}
                  size={220}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                />
              </View>
              <Text variant="label" className="text-center mb-md">
                {recompensaQr.logro?.titulo} · {descripcionRecompensa(recompensaQr)}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </Modal>

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
