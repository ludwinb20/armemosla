import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import { getCanchas, CanchaWithRelations } from '../lib/canchas';
import { getReservas, ReservaWithRelations } from '../lib/reservas';
import { parsearQrCanje } from '../lib/logros';
import { canjearRecompensaQR, ResultadoCanjeQR } from '../lib/canjes';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';

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
  const colors = useThemeColors();
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <PlayerLoadingView message="Preparando cámara..." />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.permisoContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.permisoTitulo, { color: colors.text }]}>Permiso de cámara</Text>
          <Text style={[styles.permisoTexto, { color: colors.textSecondary }]}>
            Necesitamos acceso a la cámara para escanear el QR de recompensas de los jugadores.
          </Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: Colors.primary }]} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Permitir cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={{ color: Colors.primary }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Escanear recompensa</Text>
        <View style={{ width: 40 }} />
      </View>

      {paso === 'escanear' && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <Text style={styles.overlayText}>Apuntá al QR del jugador</Text>
            <View style={styles.scanFrame} />
          </View>
        </View>
      )}

      {paso === 'confirmar' && (
        <ScrollView style={styles.confirmContent} contentContainerStyle={styles.confirmContentInner}>
          <View style={[styles.tokenBadge, { backgroundColor: Colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={[styles.tokenBadgeText, { color: Colors.success }]}>QR leído correctamente</Text>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Cancha</Text>
          {canchas.map((cancha) => (
            <TouchableOpacity
              key={cancha.id}
              style={[
                styles.optionCard,
                { backgroundColor: colors.surface, borderColor: canchaId === cancha.id ? Colors.primary : colors.border },
                canchaId === cancha.id && { borderWidth: 2 },
              ]}
              onPress={() => handleCanchaChange(cancha.id)}
            >
              <Text style={[styles.optionText, { color: colors.text }]}>{cancha.nombre}</Text>
              {canchaId === cancha.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
            </TouchableOpacity>
          ))}

          {canchaId && (
            <>
              <Text style={[styles.label, { color: colors.text, marginTop: Spacing.lg }]}>
                Reserva pendiente del jugador
              </Text>
              {loading ? (
                <PlayerLoadingView compact style={{ marginVertical: Spacing.md }} />
              ) : reservasPendientes.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No hay reservas pendientes de jugadores en esta cancha.
                </Text>
              ) : (
                reservasPendientes.map((reserva) => (
                  <TouchableOpacity
                    key={reserva.id}
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: reservaSeleccionada === reserva.id ? Colors.primary : colors.border,
                      },
                      reservaSeleccionada === reserva.id && { borderWidth: 2 },
                    ]}
                    onPress={() => setReservaSeleccionada(reserva.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionText, { color: colors.text }]}>
                        {reserva.usuario?.email || 'Jugador'}
                      </Text>
                      <Text style={[styles.optionSubtext, { color: colors.textSecondary }]}>
                        {formatFechaHora(reserva.fecha_hora)}
                      </Text>
                    </View>
                    {reservaSeleccionada === reserva.id && (
                      <Ionicons name="checkmark" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: Colors.primary, marginTop: Spacing.xl }]}
            onPress={handleConfirmarCanje}
            disabled={loading || !canchaId || !reservaSeleccionada}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>Confirmar canje</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={reiniciar}>
            <Text style={{ color: Colors.primary }}>Escanear otro código</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {paso === 'exito' && resultado && (
        <View style={styles.exitoContainer}>
          <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
          <Text style={[styles.exitoTitulo, { color: colors.text }]}>¡Canje aplicado!</Text>
          <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.resumenRow, { color: colors.text }]}>
              Jugador: <Text style={styles.resumenValor}>{resultado.jugador_nombre}</Text>
            </Text>
            <Text style={[styles.resumenRow, { color: colors.text }]}>
              Logro: <Text style={styles.resumenValor}>{resultado.logro_titulo}</Text>
            </Text>
            <Text style={[styles.resumenRow, { color: colors.text }]}>
              Descuento:{' '}
              <Text style={[styles.resumenValor, { color: Colors.primary }]}>
                {formatCurrency(resultado.monto_descontado)}
              </Text>
            </Text>
          </View>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: Colors.primary }]} onPress={reiniciar}>
            <Text style={styles.primaryButtonText}>Escanear otro</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(tabs)/pagos')}>
            <Text style={{ color: Colors.primary }}>Volver a pagos</Text>
          </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: { padding: Spacing.xs, width: 40 },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semibold },
  cameraContainer: { flex: 1, position: 'relative' },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayText: { color: '#FFF', fontSize: Typography.fontSize.md, marginBottom: Spacing.lg },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'transparent',
  },
  confirmContent: { flex: 1 },
  confirmContentInner: { padding: Spacing.lg },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  tokenBadgeText: { fontWeight: Typography.fontWeight.medium },
  label: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold, marginBottom: Spacing.sm },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  optionText: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },
  optionSubtext: { fontSize: Typography.fontSize.sm, marginTop: 2 },
  emptyText: { fontSize: Typography.fontSize.sm, marginVertical: Spacing.md },
  primaryButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: Colors.textInverse, fontWeight: Typography.fontWeight.semibold },
  backLink: { alignItems: 'center', marginTop: Spacing.md, padding: Spacing.sm },
  permisoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  permisoTitulo: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, marginTop: Spacing.md },
  permisoTexto: { fontSize: Typography.fontSize.sm, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg },
  exitoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  exitoTitulo: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, marginTop: Spacing.md },
  resumenCard: { width: '100%', padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, marginVertical: Spacing.lg },
  resumenRow: { fontSize: Typography.fontSize.md, marginBottom: Spacing.sm },
  resumenValor: { fontWeight: Typography.fontWeight.semibold },
});
