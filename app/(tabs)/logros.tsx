import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
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
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
} from '../../lib/rnModalPresets';

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
  const colors = useThemeColors();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <PlayerLoadingView message="Cargando logros..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Logros</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Jugá, desbloqueá recompensas y canjealas al llegar a la cancha
          </Text>
        </View>

        {recompensas.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recompensas disponibles</Text>
            {recompensas.map((recompensa) => (
              <View
                key={recompensa.id}
                style={[styles.recompensaCard, { backgroundColor: colors.surface, borderColor: Colors.primary + '40' }]}
              >
                <View style={styles.recompensaHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
                    <Ionicons name="gift-outline" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.recompensaInfo}>
                    <Text style={[styles.recompensaTitulo, { color: colors.text }]}>
                      {recompensa.logro?.titulo || 'Recompensa'}
                    </Text>
                    <Text style={[styles.recompensaDesc, { color: Colors.primary }]}>
                      {descripcionRecompensa(recompensa)}
                    </Text>
                    {recompensa.cancha_restriccion && (
                      <Text style={[styles.recompensaRestriccion, { color: colors.textSecondary }]}>
                        Solo en {recompensa.cancha_restriccion.nombre}
                      </Text>
                    )}
                    {recompensa.expires_at && (
                      <Text style={[styles.recompensaVence, { color: colors.textSecondary }]}>
                        Vence: {formatFecha(recompensa.expires_at)}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.qrButton, { backgroundColor: Colors.primary }]}
                  onPress={() => abrirQrCanje(recompensa)}
                >
                  <Ionicons name="qr-code-outline" size={18} color={Colors.textInverse} />
                  <Text style={styles.qrButtonText}>Mostrar QR para canjear</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tu progreso</Text>
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
                <View
                  key={logro.id}
                  style={[styles.logroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.logroHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: completado ? Colors.success + '20' : colors.background }]}>
                      {iconoLogro(logro.icono, 24, completado ? Colors.success : Colors.primary)}
                    </View>
                    <View style={styles.logroInfo}>
                      <Text style={[styles.logroTitulo, { color: colors.text }]}>{logro.titulo}</Text>
                      <Text style={[styles.logroDesc, { color: colors.textSecondary }]}>{logro.descripcion}</Text>
                    </View>
                  </View>
                  <View style={styles.progressContainer}>
                    <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: completado ? Colors.success : Colors.primary }]} />
                    </View>
                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                      {textoProgresoLogro(logro)}
                    </Text>
                    {aclaracion ? (
                      <Text style={[styles.progressHint, { color: colors.textSecondary }]}>
                        {aclaracion}
                      </Text>
                    ) : null}
                  </View>
                  {completado && (
                    <View style={[styles.completadoBadge, { backgroundColor: Colors.success + '15' }]}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={[styles.completadoText, { color: Colors.success }]}>¡Logro desbloqueado!</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {recompensas.length === 0 && logros.every((l) => (l.progreso?.valor_actual ?? 0) === 0) && (
          <View style={[styles.motivacionCard, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30' }]}>
            <SoccerLottie variant="trophy" size={48} />
            <Text style={[styles.motivacionTitulo, { color: colors.text }]}>Empezá a sumar</Text>
            <Text style={[styles.motivacionText, { color: colors.textSecondary }]}>
              Reservá canchas desde Armemosla y completá partidos. Cada reserva te acerca a recompensas reales.
            </Text>
          </View>
        )}
      </ScrollView>

      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={!!recompensaQr}
        onBackdropPress={cerrarQr}
        onBackButtonPress={cerrarQr}
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Canjear recompensa</Text>
              <TouchableOpacity onPress={cerrarQr}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              {recompensaQr ? (
                <>
                  <Text style={[styles.qrInstruccion, { color: colors.textSecondary }]}>
                    {textoInstruccionCanjeRecompensa(recompensaQr)}
                  </Text>
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={formatoQrCanje(recompensaQr.canje_token)}
                      size={220}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                    />
                  </View>
                  <Text style={[styles.qrLogro, { color: colors.text }]}>
                    {recompensaQr.logro?.titulo} · {descripcionRecompensa(recompensaQr)}
                  </Text>
                </>
              ) : null}
            </ScrollView>
          </View>
        </SafeAreaView>
      </RNModal>

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
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.md,
  },
  logroCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  logroHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logroInfo: { flex: 1 },
  logroTitulo: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
  logroDesc: { fontSize: Typography.fontSize.sm, marginTop: 2 },
  progressContainer: { marginTop: Spacing.md },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: Typography.fontSize.sm, marginTop: Spacing.xs },
  progressHint: { fontSize: Typography.fontSize.xs, marginTop: Spacing.xs, lineHeight: 18 },
  completadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
  },
  completadoText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },
  recompensaCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  recompensaHeader: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  recompensaInfo: { flex: 1 },
  recompensaTitulo: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
  recompensaDesc: { fontSize: Typography.fontSize.sm, marginTop: 2 },
  recompensaRestriccion: { fontSize: Typography.fontSize.xs, marginTop: 4 },
  recompensaVence: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  qrButtonText: { color: Colors.textInverse, fontWeight: Typography.fontWeight.semibold },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyTitle: { fontSize: Typography.fontSize.md, marginTop: Spacing.md },
  motivacionCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  motivacionTitulo: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semibold, marginTop: Spacing.sm },
  motivacionText: { fontSize: Typography.fontSize.sm, textAlign: 'center', marginTop: Spacing.sm },
  modalSheetOuter: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.md },
  modalCard: { borderRadius: BorderRadius.xl, overflow: 'hidden', width: '100%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semibold },
  modalBody: { padding: Spacing.lg },
  qrInstruccion: { fontSize: Typography.fontSize.sm, textAlign: 'center', marginBottom: Spacing.md },
  qrContainer: {
    alignSelf: 'center',
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  qrLogro: { textAlign: 'center', fontWeight: Typography.fontWeight.medium, marginBottom: Spacing.md },
  qrNota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  qrNotaText: { flex: 1, fontSize: Typography.fontSize.sm, lineHeight: 20 },
});
