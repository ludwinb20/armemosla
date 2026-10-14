import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import { getCanchas, CanchaWithRelations } from '../lib/canchas';
import { getReservas, ReservaWithRelations } from '../lib/reservas';
import { parsearQrCanje } from '../lib/logros';
import { canjearRecompensaQR, ResultadoCanjeQR } from '../lib/canjes';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import { Screen, Text, Button, Card, Surface } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { cn } from '@/lib/cn';

type Paso = 'escanear' | 'confirmar' | 'exito';

function formatFechaHora(fechaHora: string) {
  const d = new Date(fechaHora);
  return `${d.toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'HNL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function EscanearRecompensaScreen() {
  const { colors } = useGlassTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [paso, setPaso] = useState<Paso>('escanear');
  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [canchaId, setCanchaId] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [reservasPendientes, setReservasPendientes] = useState<ReservaWithRelations[]>([]);
  const [reservaSeleccionada, setReservaSeleccionada] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCanjeQR | null>(null);
  const escaneadoRef = useRef(false);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      escaneadoRef.current = false;
      loadCanchas();
    }, [])
  );

  const loadCanchas = async () => {
    try {
      const data = await getCanchas();
      setCanchas(data);
      if (data.length === 1) {
        setCanchaId(data[0].id);
      }
    } catch (error) {
      console.error('Error al cargar canchas:', error);
      showError('Error', 'No se pudieron cargar tus canchas');
    }
  };

  const loadReservasPendientes = async (cId: string) => {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date();
    fin.setDate(fin.getDate() + 30);
    fin.setHours(23, 59, 59, 999);

    const reservas = await getReservas(inicio.toISOString(), fin.toISOString(), cId);
    const pendientes = reservas.filter(
      (r) => r.estado === 'pendiente' && r.made_by_player && !r.canje_recompensa_id
    );
    setReservasPendientes(pendientes);
    if (pendientes.length === 1) {
      setReservaSeleccionada(pendientes[0].id);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (escaneadoRef.current) return;
    const parsed = parsearQrCanje(data);
    if (!parsed) {
      showError('QR inválido', 'Este código no es una recompensa de Armemosla');
      return;
    }

    escaneadoRef.current = true;
    setToken(parsed);
    setPaso('confirmar');

    if (canchaId) {
      try {
        setLoading(true);
        await loadReservasPendientes(canchaId);
      } catch {
        showError('Error', 'No se pudieron cargar las reservas pendientes');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCanchaChange = async (cId: string) => {
    setCanchaId(cId);
    setReservaSeleccionada(null);
    if (token && cId) {
      try {
        setLoading(true);
        await loadReservasPendientes(cId);
      } catch {
        showError('Error', 'No se pudieron cargar las reservas pendientes');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleConfirmarCanje = async () => {
    if (!token || !canchaId || !reservaSeleccionada) {
      showError('Datos incompletos', 'Seleccioná la cancha y la reserva del jugador');
      return;
    }

    Alert.alert(
      'Confirmar canje',
      '¿Aplicar esta recompensa a la reserva seleccionada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setLoading(true);
              const res = await canjearRecompensaQR(token, canchaId, reservaSeleccionada);
              setResultado(res);
              setPaso('exito');
              showSuccess('Canje exitoso', `Descuento aplicado: ${formatCurrency(res.monto_descontado)}`);
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : 'No se pudo canjear la recompensa';
              showError('Error al canjear', msg);
              escaneadoRef.current = false;
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const reiniciar = () => {
    escaneadoRef.current = false;
    setToken(null);
    setReservaSeleccionada(null);
    setReservasPendientes([]);
    setResultado(null);
    setPaso('escanear');
  };

  if (!permission) {
    return (
      <Screen>
        <PlayerLoadingView message="Preparando cámara..." />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center p-xl">
          <Ionicons name="camera-outline" size={64} color={colors.textSecondary} />
          <Text variant="h3" className="mt-md">
            Permiso de cámara
          </Text>
          <Text variant="caption" className="text-center mt-sm mb-lg">
            Necesitamos acceso a la cámara para escanear el QR de recompensas de los jugadores.
          </Text>
          <Button onPress={requestPermission}>Permitir cámara</Button>
          <Pressable onPress={() => router.back()} className="mt-md p-sm">
            <Text className="text-primary font-semibold">Volver</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-md py-sm border-b border-border-subtle dark:border-border-subtle-dark">
        <Pressable onPress={() => router.back()} className="p-xs w-10">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h4">Escanear recompensa</Text>
        <View className="w-10" />
      </View>

      {paso === 'escanear' && (
        <View className="flex-1 relative">
          <CameraView
            className="absolute inset-0"
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View className="absolute inset-0 justify-center items-center bg-black/35">
            <Text variant="body" className="text-white mb-lg">
              Apuntá al QR del jugador
            </Text>
            <View
              className="w-[240px] h-[240px] border-2 rounded-lg bg-transparent"
              style={{ borderColor: colors.primary }}
            />
          </View>
        </View>
      )}

      {paso === 'confirmar' && (
        <ScrollView className="flex-1" contentContainerClassName="p-lg">
          <View
            className="flex-row items-center gap-sm p-md rounded-lg mb-lg"
            style={{ backgroundColor: colors.success + '20' }}
          >
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text className="font-medium" style={{ color: colors.success }}>
              QR leído correctamente
            </Text>
          </View>

          <Text variant="label" className="mb-sm">
            Cancha
          </Text>
          {canchas.map((cancha) => (
            <Pressable
              key={cancha.id}
              className={cn(
                'flex-row items-center p-md rounded-lg border mb-sm',
                canchaId === cancha.id ? 'border-2 border-primary' : 'border-border-subtle dark:border-border-subtle-dark'
              )}
              style={{ backgroundColor: colors.surface }}
              onPress={() => handleCanchaChange(cancha.id)}
            >
              <Text variant="body" className="flex-1 font-medium">
                {cancha.nombre}
              </Text>
              {canchaId === cancha.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          ))}

          {canchaId && (
            <>
              <Text variant="label" className="mt-lg mb-sm">
                Reserva pendiente del jugador
              </Text>
              {loading ? (
                <PlayerLoadingView compact style={{ marginVertical: 16 }} />
              ) : reservasPendientes.length === 0 ? (
                <Text variant="caption" className="my-md">
                  No hay reservas pendientes de jugadores en esta cancha.
                </Text>
              ) : (
                reservasPendientes.map((reserva) => (
                  <Pressable
                    key={reserva.id}
                    className={cn(
                      'flex-row items-center p-md rounded-lg border mb-sm',
                      reservaSeleccionada === reserva.id
                        ? 'border-2 border-primary'
                        : 'border-border-subtle dark:border-border-subtle-dark'
                    )}
                    style={{ backgroundColor: colors.surface }}
                    onPress={() => setReservaSeleccionada(reserva.id)}
                  >
                    <View className="flex-1">
                      <Text variant="body" className="font-medium">
                        {reserva.usuario?.email || 'Jugador'}
                      </Text>
                      <Text variant="caption" className="mt-0.5">
                        {formatFechaHora(reserva.fecha_hora)}
                      </Text>
                    </View>
                    {reservaSeleccionada === reserva.id && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    )}
                  </Pressable>
                ))
              )}
            </>
          )}

          <Button
            className="mt-xl"
            onPress={handleConfirmarCanje}
            disabled={loading || !canchaId || !reservaSeleccionada}
            loading={loading}
          >
            Confirmar canje
          </Button>

          <Pressable onPress={reiniciar} className="items-center mt-md p-sm">
            <Text className="text-primary font-semibold">Escanear otro código</Text>
          </Pressable>
        </ScrollView>
      )}

      {paso === 'exito' && resultado && (
        <View className="flex-1 items-center justify-center p-xl">
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <Text variant="h3" className="mt-md">
            ¡Canje aplicado!
          </Text>
          <Card className="w-full my-lg">
            <Text variant="body" className="mb-sm">
              Jugador: <Text className="font-semibold">{resultado.jugador_nombre}</Text>
            </Text>
            <Text variant="body" className="mb-sm">
              Logro: <Text className="font-semibold">{resultado.logro_titulo}</Text>
            </Text>
            <Text variant="body">
              Descuento:{' '}
              <Text className="font-semibold" style={{ color: colors.primary }}>
                {formatCurrency(resultado.monto_descontado)}
              </Text>
            </Text>
          </Card>
          <Button onPress={reiniciar}>Escanear otro</Button>
          <Pressable onPress={() => router.replace('/(tabs)/pagos')} className="mt-md p-sm">
            <Text className="text-primary font-semibold">Volver a pagos</Text>
          </Pressable>
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
