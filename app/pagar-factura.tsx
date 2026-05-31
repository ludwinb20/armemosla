import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import {
  getFacturaById,
  getTotalAPagar,
  FacturaWithDetalles,
  moraCongelada,
  getFechaOcultamientoComplejos,
} from '../lib/pagos';
import {
  solicitarPagoPayPal,
  confirmarPagoPayPal,
  confirmarTarjetaAgregada,
  pagarConMetodoGuardado,
  iniciarAgregarTarjeta,
  listarMetodosPago,
  eliminarMetodoPago,
  marcarMetodoPredeterminado,
  etiquetaMetodoPago,
  MetodoPagoPayPal,
} from '../lib/paypal';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function PagarFacturaScreen() {
  const { facturaId } = useLocalSearchParams<{ facturaId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } =
    useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [factura, setFactura] = useState<FacturaWithDetalles | null>(null);
  const [metodos, setMetodos] = useState<MetodoPagoPayPal[]>([]);
  const [metodoSeleccionado, setMetodoSeleccionado] = useState<string | null>(null);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [webViewLoading, setWebViewLoading] = useState(false);
  const [webViewModo, setWebViewModo] = useState<'pago' | 'tarjeta'>('pago');
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const checkoutFinalizado = useRef(false);
  const facturaRef = useRef(factura);
  const webViewModoRef = useRef(webViewModo);
  facturaRef.current = factura;
  webViewModoRef.current = webViewModo;

  const cargar = useCallback(async () => {
    if (!facturaId) return;
    try {
      setLoading(true);
      setErrorCarga(null);
      const [facturaData, metodosData] = await Promise.all([
        getFacturaById(facturaId),
        listarMetodosPago().catch(() => [] as MetodoPagoPayPal[]),
      ]);
      if (!facturaData) {
        setErrorCarga('No se encontró la factura');
        setFactura(null);
        return;
      }
      setFactura(facturaData);
      setMetodos(metodosData);
      const predeterminado = metodosData.find((m) => m.es_predeterminado) ?? metodosData[0];
      setMetodoSeleccionado(predeterminado?.id ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo cargar la factura';
      setErrorCarga(msg);
      setFactura(null);
    } finally {
      setLoading(false);
    }
  }, [facturaId]);

  useEffect(() => {
    if (!facturaId) {
      setLoading(false);
      setErrorCarga('Factura no especificada');
      return;
    }
    void cargar();
  }, [facturaId, cargar]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(amount);

  const handlePagarConGuardada = async () => {
    if (!factura || !metodoSeleccionado) return;
    try {
      setProcesando(true);
      await pagarConMetodoGuardado(factura.id, metodoSeleccionado);
      showSuccess('Pago exitoso', 'Tu factura fue pagada correctamente', () => router.replace('/(tabs)/pagos'));
    } catch (e) {
      showError('No se pudo cobrar', e instanceof Error ? e.message : 'Intentá con otra tarjeta');
    } finally {
      setProcesando(false);
    }
  };

  const abrirWebView = (url: string, modo: 'pago' | 'tarjeta') => {
    checkoutFinalizado.current = false;
    setWebViewModo(modo);
    setWebViewUrl(url);
    setWebViewLoading(true);
  };

  const handlePagarConNuevaTarjeta = async () => {
    if (!factura) return;
    try {
      setProcesando(true);
      const res = await solicitarPagoPayPal(factura.id);
      if (res.approval_url) {
        abrirWebView(res.approval_url, 'pago');
      } else {
        showError('Error', 'PayPal no devolvió la URL de checkout');
      }
    } catch (e) {
      showError('Error', e instanceof Error ? e.message : 'No se pudo iniciar el pago');
    } finally {
      setProcesando(false);
    }
  };

  const handleAgregarTarjeta = async () => {
    try {
      setProcesando(true);
      const res = await iniciarAgregarTarjeta();
      abrirWebView(res.approval_url, 'tarjeta');
    } catch (e) {
      showError('Error', e instanceof Error ? e.message : 'No se pudo agregar la tarjeta');
    } finally {
      setProcesando(false);
    }
  };

  const finalizarCheckout = async (url: string) => {
    setWebViewUrl(null);
    setWebViewLoading(false);
    try {
      setProcesando(true);
      const tokenMatch = url.match(/[?&]token=([^&]+)/);
      const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
      if (webViewModoRef.current === 'pago' && facturaRef.current) {
        await confirmarPagoPayPal({
          facturaId: facturaRef.current.id,
          paypalOrderId: token,
        });
        showSuccess('Pago exitoso', 'Tu factura fue pagada correctamente', () =>
          router.replace('/(tabs)/pagos')
        );
      } else {
        await confirmarTarjetaAgregada(token);
        await cargar();
        showSuccess('Tarjeta guardada', 'Tu método de pago quedó registrado de forma segura');
      }
    } catch (e) {
      showError(
        'Confirmación pendiente',
        e instanceof Error ? e.message : 'El pago puede tardar unos segundos. Revisá Pagos.'
      );
      router.replace('/(tabs)/pagos');
    } finally {
      setProcesando(false);
    }
  };

  const interceptarRedirect = (url: string): boolean => {
    if (url.startsWith('armemosla://pagos/return') || url.includes('paypal-return-redirect')) {
      if (!checkoutFinalizado.current) {
        checkoutFinalizado.current = true;
        void finalizarCheckout(url);
      }
      return false;
    }
    if (url.startsWith('armemosla://pagos/cancel') || url.includes('paypal-cancel-redirect')) {
      setWebViewUrl(null);
      setWebViewLoading(false);
      return false;
    }
    return true;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <PlayerLoadingView message="Preparando pago seguro..." />
      </SafeAreaView>
    );
  }

  if (!factura) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            {errorCarga ?? 'No se pudo cargar la factura'}
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const total = getTotalAPagar(factura);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Pagar factura</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.resumen, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.periodo, { color: colors.textSecondary }]}>
            {MESES[factura.mes - 1]} {factura.año}
          </Text>
          <Text style={[styles.total, { color: colors.text }]}>{formatCurrency(total)}</Text>
          {(factura.monto_mora ?? 0) > 0 && (
            <Text style={[styles.mora, { color: Colors.error }]}>
              Incluye mora: {formatCurrency(factura.monto_mora ?? 0)}
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Métodos guardados</Text>

        {metodos.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            Todavía no tenés tarjetas guardadas. Agregá una para pagar en un toque la próxima vez.
          </Text>
        ) : (
          metodos.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.metodoCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: metodoSeleccionado === m.id ? Colors.primary : colors.border,
                },
                metodoSeleccionado === m.id && { borderWidth: 2 },
              ]}
              onPress={() => setMetodoSeleccionado(m.id)}
            >
              <Ionicons
                name={metodoSeleccionado === m.id ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={metodoSeleccionado === m.id ? Colors.primary : colors.textSecondary}
              />
              <Ionicons name="card-outline" size={24} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.metodoLabel, { color: colors.text }]}>{etiquetaMetodoPago(m)}</Text>
                {m.es_predeterminado && (
                  <Text style={[styles.predeterminado, { color: Colors.primary }]}>Predeterminada</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => void marcarMetodoPredeterminado(m.id).then(cargar)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  eliminarMetodoPago(m.id)
                    .then(cargar)
                    .catch((err) => showError('Error', err.message))
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={handleAgregarTarjeta}
          disabled={procesando}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Agregar tarjeta</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.borderLight, backgroundColor: colors.background }]}>
        {metodoSeleccionado ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
            onPress={handlePagarConGuardada}
            disabled={procesando}
          >
            {procesando ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.primaryBtnText}>Pagar con tarjeta guardada</Text>
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.paypalBtn, { borderColor: '#0070BA' }]}
          onPress={handlePagarConNuevaTarjeta}
          disabled={procesando}
        >
          <Ionicons name="card" size={20} color="#0070BA" />
          <Text style={styles.paypalBtnText}>Pagar con otra tarjeta</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!webViewUrl} animationType="slide" onRequestClose={() => setWebViewUrl(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.webHeader, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.webTitle, { color: colors.text }]}>
              {webViewModo === 'pago' ? 'Checkout seguro' : 'Agregar tarjeta'}
            </Text>
            <TouchableOpacity onPress={() => setWebViewUrl(null)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          {webViewUrl ? (
            <View style={{ flex: 1 }}>
              <WebView
                source={{ uri: webViewUrl }}
                originWhitelist={['https://*', 'http://*', 'armemosla://*']}
                onShouldStartLoadWithRequest={(req) => interceptarRedirect(req.url)}
                onNavigationStateChange={(nav) => {
                  interceptarRedirect(nav.url);
                }}
                onLoadStart={() => setWebViewLoading(true)}
                onLoadEnd={() => setWebViewLoading(false)}
                onError={() => {
                  setWebViewLoading(false);
                  showError('Error', 'No se pudo cargar el checkout de PayPal');
                }}
              />
              {webViewLoading ? (
                <View style={styles.webViewOverlay}>
                  <PlayerLoadingView message="Cargando checkout seguro..." compact />
                </View>
              ) : null}
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

      {procesando ? (
        <View style={styles.procesandoOverlay}>
          <PlayerLoadingView message="Procesando pago..." compact />
        </View>
      ) : null}

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
  backBtn: { padding: Spacing.xs, width: 40 },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semibold },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  resumen: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  periodo: { fontSize: Typography.fontSize.sm },
  total: { fontSize: 32, fontWeight: '700', marginTop: Spacing.xs },
  mora: { fontSize: Typography.fontSize.sm, marginTop: Spacing.xs },
  seguridad: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  seguridadText: { flex: 1, fontSize: Typography.fontSize.sm, lineHeight: 20 },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  empty: { fontSize: Typography.fontSize.sm, marginBottom: Spacing.md, lineHeight: 20 },
  metodoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  metodoLabel: { fontWeight: Typography.fontWeight.medium },
  predeterminado: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  secondaryBtnText: { fontWeight: Typography.fontWeight.medium },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  primaryBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.textInverse, fontWeight: Typography.fontWeight.semibold },
  paypalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  paypalBtnText: { color: '#0070BA', fontWeight: Typography.fontWeight.semibold },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  webTitle: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  errorTitle: {
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  webViewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  procesandoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
