import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import {
  getFacturaMesActual,
  getFacturaMesPasado,
  getHistorialFacturas,
  getFacturaById,
  adminTieneComplejosOcultos,
  esFacturaPagable,
  getTotalAPagar,
  getComisionBase,
  textoProximoPagoMesActual,
  getFechaOcultamientoComplejos,
  moraCongelada,
  labelEstadoPago,
  colorEstadoPago,
  FacturaMensual,
  FacturaWithDetalles,
} from '../../lib/pagos';
import { generarYCompartirFacturaPDF, generarYCompartirFacturaFiscalPDF } from '../../lib/pdf';
import {
  getHistorialTransferencias,
  getMontoPendiente,
  getReembolsosPorFactura,
  Transferencia,
  Reembolso,
} from '../../lib/transferencias';
import {
  getSolicitudesPorFactura,
  cancelarSolicitudReembolso,
  SolicitudReembolso,
} from '../../lib/solicitudesReembolso';
import { getFacturaFiscal } from '../../lib/datosFiscales';
import { obtenerCanjesMes, CanjeRecompensa } from '../../lib/canjes';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
} from '../../lib/rnModalPresets';
import { supabase } from '../../lib/supabase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function PagosScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  const [loading, setLoading] = useState(true);
  const [facturaActual, setFacturaActual] = useState<FacturaMensual | null>(null);
  const [facturaPorPagar, setFacturaPorPagar] = useState<FacturaMensual | null>(null);
  const [complejosOcultos, setComplejosOcultos] = useState(false);
  const [historial, setHistorial] = useState<FacturaMensual[]>([]);
  const [facturaDetalle, setFacturaDetalle] = useState<FacturaWithDetalles | null>(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroAño, setFiltroAño] = useState(new Date().getFullYear());
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [nombreAdmin, setNombreAdmin] = useState<string>('');
  const [canjesMes, setCanjesMes] = useState<CanjeRecompensa[]>([]);
  const [transferenciasFactura, setTransferenciasFactura] = useState<(Transferencia & { monto_aplicado: number })[]>([]);
  const [reembolsosFactura, setReembolsosFactura] = useState<Reembolso[]>([]);
  const [solicitudesFactura, setSolicitudesFactura] = useState<SolicitudReembolso[]>([]);
  const [montoPendiente, setMontoPendiente] = useState(0);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [])
  );

  useEffect(() => {
    loadNombreAdmin();
  }, []);

  const loadNombreAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setNombreAdmin(profile.full_name || profile.email || 'Administrador');
        }
      }
    } catch (error) {
      console.error('Error al cargar nombre del admin:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [factura, facturaPasada, historialData, ocultos] = await Promise.all([
        getFacturaMesActual(),
        getFacturaMesPasado(),
        getHistorialFacturas(),
        adminTieneComplejosOcultos(),
      ]);

      setFacturaActual(factura);
      setComplejosOcultos(ocultos);

      const pendientePago =
        facturaPasada && esFacturaPagable(facturaPasada) ? facturaPasada : null;

      setFacturaPorPagar(pendientePago);
      setHistorial(historialData);

      if (pendientePago) {
        const [historialTransf, reembolsos, solicitudes, pendiente] = await Promise.all([
          getHistorialTransferencias(pendientePago.id),
          getReembolsosPorFactura(pendientePago.id),
          getSolicitudesPorFactura(pendientePago.id),
          getMontoPendiente(pendientePago.id),
        ]);
        setTransferenciasFactura(historialTransf);
        setReembolsosFactura(reembolsos);
        setSolicitudesFactura(solicitudes);
        setMontoPendiente(pendiente);
      } else {
        setTransferenciasFactura([]);
        setReembolsosFactura([]);
        setSolicitudesFactura([]);
        setMontoPendiente(0);
      }

      if (factura) {
        const canjes = await obtenerCanjesMes(factura.mes, factura.año);
        setCanjesMes(canjes);
      } else {
        setCanjesMes([]);
      }
    } catch (error: any) {
      console.error('Error al cargar datos:', error);
      showError('Error', 'No se pudieron cargar los datos de pagos');
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async (factura: FacturaMensual) => {
    try {
      setGenerandoPDF(true);
      const facturaCompleta = await getFacturaById(factura.id);
      if (!facturaCompleta) {
        showError('Error', 'No se pudo obtener la factura');
        return;
      }
      await generarYCompartirFacturaPDF(facturaCompleta, nombreAdmin);
      showSuccess('Éxito', 'PDF generado correctamente');
    } catch (error: any) {
      console.error('Error al generar PDF:', error);
      showError('Error', error.message || 'No se pudo generar el PDF');
    } finally {
      setGenerandoPDF(false);
    }
  };

  const handleVerDetalle = async (factura: FacturaMensual) => {
    try {
      const detalle = await getFacturaById(factura.id);
      if (detalle) {
        setFacturaDetalle(detalle);
        const canjes = await obtenerCanjesMes(factura.mes, factura.año);
        setCanjesMes(canjes);
        setShowDetalleModal(true);
      }
    } catch (error: any) {
      console.error('Error al cargar detalle:', error);
      showError('Error', 'No se pudo cargar el detalle de la factura');
    }
  };

  const handleReportarTransferencia = (factura: FacturaMensual) => {
    router.push({ pathname: '/reportar-pago', params: { facturaId: factura.id } });
  };

  const handleSolicitarReembolso = (transferenciaId: string) => {
    router.push({ pathname: '/solicitar-reembolso', params: { transferenciaId } });
  };

  const handleCancelarSolicitud = (solicitudId: string) => {
    Alert.alert(
      'Cancelar solicitud',
      '¿Querés cancelar esta solicitud de reembolso?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await cancelarSolicitudReembolso(solicitudId);
                await loadData();
                showSuccess('Listo', 'Solicitud cancelada');
              } catch (error: unknown) {
                showError('Error', error instanceof Error ? error.message : 'No se pudo cancelar');
              }
            })();
          },
        },
      ]
    );
  };

  const solicitudPorTransferencia = (transferenciaId: string) =>
    solicitudesFactura.find((s) => s.transferencia_id === transferenciaId);

  const handleDescargarFacturaFiscal = async (factura: FacturaMensual) => {
    try {
      setGenerandoPDF(true);
      const fiscal = await getFacturaFiscal(factura.id);
      if (!fiscal) {
        showError('Sin factura fiscal', 'No hay factura fiscal RTN emitida para este periodo');
        return;
      }
      await generarYCompartirFacturaFiscalPDF(fiscal);
      showSuccess('Éxito', 'Factura fiscal generada');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo generar la factura fiscal';
      showError('Error', msg);
    } finally {
      setGenerandoPDF(false);
    }
  };

  const getEstadoColor = (estado: string) => colorEstadoPago(estado as FacturaMensual['estado_pago']);
  const getEstadoTexto = (estado: string) => labelEstadoPago(estado as FacturaMensual['estado_pago']);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const historialFiltrado = historial.filter(
    (f) =>
      f.año === filtroAño &&
      (!facturaActual || f.id !== facturaActual.id) &&
      (!facturaPorPagar || f.id !== facturaPorPagar.id)
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <PlayerLoadingView style={styles.loadingContainer} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Pagos / Facturación</Text>
        </View>

        <TouchableOpacity
          style={[styles.scanRecompensaButton, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary }]}
          onPress={() => router.push('/escanear-recompensa')}
        >
          <Ionicons name="qr-code-outline" size={22} color={Colors.primary} />
          <View style={styles.scanRecompensaTextWrap}>
            <Text style={[styles.scanRecompensaTitle, { color: colors.text }]}>Escanear recompensa</Text>
            <Text style={[styles.scanRecompensaSubtitle, { color: colors.textSecondary }]}>
              Canjeá el QR de un jugador al llegar a la cancha
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>

        {complejosOcultos && (
          <View style={[styles.alertaBanner, { backgroundColor: Colors.error + '18', borderColor: Colors.error }]}>
            <Ionicons name="eye-off-outline" size={22} color={Colors.error} />
            <Text style={[styles.alertaBannerText, { color: colors.text }]}>
              Tus complejos están ocultos en la app por falta de pago. Regularizá tu factura pendiente para que los jugadores vuelvan a reservar.
            </Text>
          </View>
        )}

        {facturaPorPagar && (
          <View style={styles.resumenContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Factura a pagar</Text>
            <Text style={[styles.periodoText, { color: colors.textSecondary }]}>
              {MESES[facturaPorPagar.mes - 1]} {facturaPorPagar.año}
            </Text>

            <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Comisión neta</Text>
                <Text style={[styles.resumenValue, { color: colors.text }]}>
                  {formatCurrency(getComisionBase(facturaPorPagar))}
                </Text>
              </View>
              {(facturaPorPagar.monto_mora ?? 0) > 0 && (
                <>
                  <View style={styles.resumenRow}>
                    <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>
                      Mora ({facturaPorPagar.dias_retraso} día{facturaPorPagar.dias_retraso === 1 ? '' : 's'} · 3%/día)
                    </Text>
                    <Text style={[styles.resumenValue, { color: Colors.error }]}>
                      +{formatCurrency(facturaPorPagar.monto_mora ?? 0)}
                    </Text>
                  </View>
                  <Text style={[styles.moraAviso, { color: Colors.error }]}>
                    Pasaste el día 20 sin pagar. La mora (3% diario) se acumula solo hasta el{' '}
                    {getFechaOcultamientoComplejos(facturaPorPagar.mes, facturaPorPagar.año).toLocaleDateString('es-HN')}
                    .
                  </Text>
                  {moraCongelada(facturaPorPagar) && (
                    <Text style={[styles.moraAviso, { color: colors.textSecondary }]}>
                      El total ya no aumenta. Tus complejos están ocultos en búsqueda hasta que pagues la factura pendiente.
                    </Text>
                  )}
                </>
              )}
              <View style={[styles.resumenRow, styles.resumenRowLast]}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary, fontWeight: '700' }]}>Total a pagar</Text>
                <Text style={[styles.resumenValue, { color: Colors.primary, fontWeight: '700', fontSize: Typography.fontSize.lg }]}>
                  {formatCurrency(getTotalAPagar(facturaPorPagar))}
                </Text>
              </View>
              <View style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Estado</Text>
                <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(facturaPorPagar.estado_pago) + '20' }]}>
                  <Text style={[styles.estadoBadgeText, { color: getEstadoColor(facturaPorPagar.estado_pago) }]}>
                    {getEstadoTexto(facturaPorPagar.estado_pago)}
                  </Text>
                </View>
              </View>
              <View style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Fecha límite</Text>
                <Text style={[styles.resumenValue, { color: colors.text }]}>
                  {new Date(facturaPorPagar.fecha_limite_pago).toLocaleDateString('es-HN')}
                </Text>
              </View>
              {facturaPorPagar.estado_pago === 'en_revision' && montoPendiente > 0 && (
                <View style={styles.resumenRow}>
                  <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Pendiente de confirmar</Text>
                  <Text style={[styles.resumenValue, { color: Colors.warning }]}>
                    {formatCurrency(montoPendiente)}
                  </Text>
                </View>
              )}
              {facturaPorPagar.estado_pago === 'en_revision' && (
                <Text style={[styles.moraAviso, { color: colors.textSecondary }]}>
                  Tu pago está en revisión. Mientras tanto no se aplican mora ni se ocultan tus complejos.
                </Text>
              )}
              {facturaPorPagar.estado_pago === 'retrasado' && !moraCongelada(facturaPorPagar) && (
                <Text style={[styles.moraAviso, { color: colors.textSecondary }]}>
                  Si no pagás antes del{' '}
                  {getFechaOcultamientoComplejos(facturaPorPagar.mes, facturaPorPagar.año).toLocaleDateString('es-HN')}
                  , tus complejos dejarán de mostrarse en la app y la mora dejará de aumentar.
                </Text>
              )}

              <View style={styles.resumenActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary, { borderColor: colors.border }]}
                  onPress={() => handleVerDetalle(facturaPorPagar)}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.text} />
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Ver Detalle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary, { backgroundColor: Colors.primary }]}
                  onPress={() => handleDescargarPDF(facturaPorPagar)}
                  disabled={generandoPDF}
                >
                  {generandoPDF ? (
                    <ActivityIndicator size="small" color={Colors.textInverse} />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color={Colors.textInverse} />
                      <Text style={[styles.actionButtonText, { color: Colors.textInverse }]}>PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.pagarButton, { backgroundColor: Colors.primary }]}
                onPress={() => handleReportarTransferencia(facturaPorPagar)}
              >
                <Ionicons name="swap-horizontal-outline" size={22} color={Colors.textInverse} />
                <Text style={styles.pagarButtonText}>Reportar transferencia</Text>
              </TouchableOpacity>
              <Text style={[styles.pagoNota, { color: colors.textSecondary }]}>
                Transferí a una cuenta de Armemosla y reportá el pago con el número de referencia bancaria.
              </Text>

              {transferenciasFactura.length > 0 && (
                <View style={{ marginTop: Spacing.md }}>
                  <Text style={[styles.sectionTitle, { color: colors.text, fontSize: Typography.fontSize.md }]}>
                    Historial de transferencias
                  </Text>
                  {transferenciasFactura.map((t) => {
                    const solicitud = solicitudPorTransferencia(t.id);
                    return (
                    <View
                      key={t.id}
                      style={[styles.historialCard, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: Spacing.xs }]}
                    >
                      <View style={styles.historialRow}>
                        <Text style={[styles.historialLabel, { color: colors.textSecondary }]}>
                          {new Date(t.created_at).toLocaleDateString('es-HN')} · Ref {t.numero_transaccion}
                        </Text>
                        <Text style={[styles.historialValue, { color: colors.text }]}>
                          {formatCurrency(Number(t.monto_aplicado))}
                        </Text>
                      </View>
                      <Text style={[styles.historialFecha, { color: getEstadoColor(t.estado === 'confirmada' ? 'pagado' : t.estado === 'rechazada' ? 'retrasado' : 'en_revision') }]}>
                        {t.estado === 'pendiente_revision' ? 'En revisión' : t.estado === 'confirmada' ? 'Confirmada' : t.estado === 'rechazada' ? `Rechazada${t.notas_admin ? `: ${t.notas_admin}` : ''}` : t.estado === 'reembolsada' ? 'Reembolsada' : t.estado}
                      </Text>
                      {solicitud?.estado === 'pendiente' && (
                        <View style={{ marginTop: Spacing.xs }}>
                          <Text style={[styles.historialFecha, { color: Colors.warning }]}>
                            Solicitud de reembolso en revisión ({formatCurrency(Number(solicitud.monto))})
                          </Text>
                          <TouchableOpacity onPress={() => handleCancelarSolicitud(solicitud.id)}>
                            <Text style={{ color: Colors.error, fontSize: Typography.fontSize.sm, marginTop: 4 }}>
                              Cancelar solicitud
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {solicitud?.estado === 'rechazada' && solicitud.respuesta_plataforma && (
                        <Text style={[styles.historialFecha, { color: Colors.error, marginTop: Spacing.xs }]}>
                          Reembolso rechazado: {solicitud.respuesta_plataforma}
                        </Text>
                      )}
                      {t.estado === 'confirmada' && !solicitud && (
                        <TouchableOpacity
                          style={[styles.solicitarReembolsoBtn, { borderColor: Colors.warning }]}
                          onPress={() => handleSolicitarReembolso(t.id)}
                        >
                          <Ionicons name="return-down-back-outline" size={16} color={Colors.warning} />
                          <Text style={{ color: Colors.warning, fontSize: Typography.fontSize.sm }}>
                            Solicitar reembolso
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    );
                  })}
                </View>
              )}

              {reembolsosFactura.length > 0 && (
                <View style={{ marginTop: Spacing.sm }}>
                  <Text style={[styles.sectionTitle, { color: colors.text, fontSize: Typography.fontSize.md }]}>
                    Reembolsos
                  </Text>
                  {reembolsosFactura.map((r) => (
                    <Text key={r.id} style={[styles.moraAviso, { color: Colors.error }]}>
                      Reembolso {formatCurrency(Number(r.monto))}: {r.visible_mensaje}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Resumen del Mes Actual */}
        {facturaActual && (
          <View style={styles.resumenContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Mes en curso</Text>
            <Text style={[styles.periodoText, { color: colors.textSecondary }]}>
              {MESES[facturaActual.mes - 1]} {facturaActual.año} · acumulando reservas
            </Text>

            <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Total Facturado</Text>
                <Text style={[styles.resumenValue, { color: colors.text }]}>
                  {formatCurrency(facturaActual.total_facturado)}
                </Text>
              </View>
              <View style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Comisión estimada (10%)</Text>
                <Text style={[styles.resumenValue, { color: colors.text }]}>
                  {formatCurrency(facturaActual.comision)}
                </Text>
              </View>
              {(facturaActual.total_descuentos_canje ?? 0) > 0 && (
                <>
                  <View style={styles.resumenRow}>
                    <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Descuentos por canjes</Text>
                    <Text style={[styles.resumenValue, { color: Colors.success }]}>
                      -{formatCurrency(facturaActual.total_descuentos_canje ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.resumenRow}>
                    <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Comisión neta estimada</Text>
                    <Text style={[styles.resumenValue, { color: colors.text, fontWeight: '700' }]}>
                      {formatCurrency(facturaActual.comision_neta ?? facturaActual.comision)}
                    </Text>
                  </View>
                </>
              )}
              <View style={[styles.resumenRow, styles.resumenRowLast]}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Estado</Text>
                <View style={[styles.estadoBadge, { backgroundColor: Colors.primary + '20' }]}>
                  <Text style={[styles.estadoBadgeText, { color: Colors.primary }]}>En curso</Text>
                </View>
              </View>
              <Text style={[styles.enCursoNota, { color: colors.textSecondary }]}>
                {textoProximoPagoMesActual()}. Hasta fin de mes seguirá actualizándose con nuevas reservas completadas.
              </Text>

              <View style={styles.resumenActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary, { borderColor: colors.border }]}
                  onPress={() => handleVerDetalle(facturaActual)}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.text} />
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Ver Detalle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary, { backgroundColor: Colors.primary }]}
                  onPress={() => handleDescargarPDF(facturaActual)}
                  disabled={generandoPDF}
                >
                  {generandoPDF ? (
                    <ActivityIndicator size="small" color={Colors.textInverse} />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color={Colors.textInverse} />
                      <Text style={[styles.actionButtonText, { color: Colors.textInverse }]}>Descargar PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {canjesMes.length > 0 && facturaActual && (
          <View style={styles.historialContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Canjes de recompensas</Text>
            <Text style={[styles.periodoText, { color: colors.textSecondary }]}>
              {MESES[facturaActual.mes - 1]} {facturaActual.año}
            </Text>
            {canjesMes.map((canje) => (
              <View
                key={canje.id}
                style={[styles.historialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.historialCardHeader}>
                  <View>
                    <Text style={[styles.historialPeriodo, { color: colors.text }]}>{canje.logro_titulo}</Text>
                    <Text style={[styles.historialFecha, { color: colors.textSecondary }]}>
                      {canje.jugador?.full_name || canje.jugador?.email || 'Jugador'} · {canje.cancha?.nombre}
                    </Text>
                  </View>
                  <Text style={[styles.historialValue, { color: Colors.success }]}>
                    -{formatCurrency(canje.monto_descontado)}
                  </Text>
                </View>
                <Text style={[styles.historialFecha, { color: colors.textSecondary }]}>
                  {new Date(canje.created_at).toLocaleDateString('es-HN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Historial de Pagos */}
        <View style={styles.historialContainer}>
          <View style={styles.historialHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Historial de Pagos</Text>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowFiltros(!showFiltros)}
            >
              <Ionicons name="filter-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {showFiltros && (
            <View style={[styles.filtroContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.filtroLabel, { color: colors.text }]}>Año:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((año) => (
                  <TouchableOpacity
                    key={año}
                    style={[
                      styles.filtroChip,
                      filtroAño === año && [styles.filtroChipActive, { backgroundColor: Colors.primary }],
                    ]}
                    onPress={() => setFiltroAño(año)}
                  >
                    <Text
                      style={[
                        styles.filtroChipText,
                        { color: filtroAño === año ? Colors.textInverse : colors.text },
                      ]}
                    >
                      {año}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {historialFiltrado.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No hay facturas</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aún no hay facturas para el año seleccionado
              </Text>
            </View>
          ) : (
            historialFiltrado.map((factura) => (
              <TouchableOpacity
                key={factura.id}
                style={[styles.historialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleVerDetalle(factura)}
              >
                <View style={styles.historialCardHeader}>
                  <View>
                    <Text style={[styles.historialPeriodo, { color: colors.text }]}>
                      {MESES[factura.mes - 1]} {factura.año}
                    </Text>
                    <Text style={[styles.historialFecha, { color: colors.textSecondary }]}>
                      Vence: {new Date(factura.fecha_limite_pago).toLocaleDateString('es-ES')}
                    </Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(factura.estado_pago) + '20' }]}>
                    <Text style={[styles.estadoBadgeText, { color: getEstadoColor(factura.estado_pago) }]}>
                      {getEstadoTexto(factura.estado_pago)}
                    </Text>
                  </View>
                </View>
                <View style={styles.historialCardBody}>
                  <View style={styles.historialRow}>
                    <Text style={[styles.historialLabel, { color: colors.textSecondary }]}>Total Facturado:</Text>
                    <Text style={[styles.historialValue, { color: colors.text }]}>
                      {formatCurrency(factura.total_facturado)}
                    </Text>
                  </View>
                  <View style={styles.historialRow}>
                    <Text style={[styles.historialLabel, { color: colors.textSecondary }]}>Comisión:</Text>
                    <Text style={[styles.historialValue, { color: getEstadoColor(factura.estado_pago) }]}>
                      {formatCurrency(factura.comision)}
                    </Text>
                  </View>
                </View>
                <View style={styles.historialCardActions}>
                  <TouchableOpacity
                    style={[styles.historialActionButton, { borderColor: colors.border }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDescargarPDF(factura);
                    }}
                  >
                    <Ionicons name="download-outline" size={16} color={colors.text} />
                    <Text style={[styles.historialActionText, { color: colors.text }]}>PDF</Text>
                  </TouchableOpacity>
                  {factura.estado_pago !== 'pagado' && esFacturaPagable(factura) && (
                    <TouchableOpacity
                      style={[styles.historialActionButton, { borderColor: Colors.primary }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleReportarTransferencia(factura);
                      }}
                    >
                      <Ionicons name="swap-horizontal-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.historialActionText, { color: Colors.primary }]}>Reportar</Text>
                    </TouchableOpacity>
                  )}
                  {factura.estado_pago === 'pagado' && (
                    <TouchableOpacity
                      style={[styles.historialActionButton, { borderColor: Colors.success }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        void handleDescargarFacturaFiscal(factura);
                      }}
                    >
                      <Ionicons name="document-text-outline" size={16} color={Colors.success} />
                      <Text style={[styles.historialActionText, { color: Colors.success }]}>RTN</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal de Detalle */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showDetalleModal}
        onBackdropPress={() => setShowDetalleModal(false)}
        onBackButtonPress={() => setShowDetalleModal(false)}
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Detalle de Factura</Text>
              <TouchableOpacity onPress={() => setShowDetalleModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {facturaDetalle && (
              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.detalleSection}>
                  <Text style={[styles.detalleLabel, { color: colors.textSecondary }]}>Período</Text>
                  <Text style={[styles.detalleValue, { color: colors.text }]}>
                    {MESES[facturaDetalle.mes - 1]} {facturaDetalle.año}
                  </Text>
                </View>

                <View style={styles.detalleSection}>
                  <Text style={[styles.detalleLabel, { color: colors.textSecondary }]}>Total Facturado</Text>
                  <Text style={[styles.detalleValue, { color: colors.text }]}>
                    {formatCurrency(facturaDetalle.total_facturado)}
                  </Text>
                </View>

                <View style={styles.detalleSection}>
                  <Text style={[styles.detalleLabel, { color: colors.textSecondary }]}>Comisión (10%)</Text>
                  <Text style={[styles.detalleValue, { color: colors.text }]}>
                    {formatCurrency(facturaDetalle.comision)}
                  </Text>
                </View>

                {(facturaDetalle.total_descuentos_canje ?? 0) > 0 && (
                  <>
                    <View style={styles.detalleSection}>
                      <Text style={[styles.detalleLabel, { color: colors.textSecondary }]}>Descuentos por canjes</Text>
                      <Text style={[styles.detalleValue, { color: Colors.success }]}>
                        -{formatCurrency(facturaDetalle.total_descuentos_canje ?? 0)}
                      </Text>
                    </View>
                    <View style={styles.detalleSection}>
                      <Text style={[styles.detalleLabel, { color: colors.textSecondary }]}>Comisión neta</Text>
                      <Text style={[styles.detalleValue, { color: Colors.primary, fontWeight: '700' }]}>
                        {formatCurrency(facturaDetalle.comision_neta ?? facturaDetalle.comision)}
                      </Text>
                    </View>
                  </>
                )}

                <View style={styles.detalleSection}>
                  <Text style={[styles.detalleLabel, { color: colors.textSecondary }]}>Estado</Text>
                  <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(facturaDetalle.estado_pago) + '20' }]}>
                    <Text style={[styles.estadoBadgeText, { color: getEstadoColor(facturaDetalle.estado_pago) }]}>
                      {getEstadoTexto(facturaDetalle.estado_pago)}
                    </Text>
                  </View>
                </View>

                {canjesMes.length > 0 && (
                  <View style={styles.detalleSection}>
                    <Text style={[styles.detalleSectionTitle, { color: colors.text }]}>Canjes de recompensas</Text>
                    {canjesMes.map((canje) => (
                      <View
                        key={canje.id}
                        style={[styles.detalleCanchaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Text style={[styles.detalleCanchaNombre, { color: colors.text }]}>
                          {canje.logro_titulo}
                        </Text>
                        <Text style={[styles.detalleCanchaComplejo, { color: colors.textSecondary }]}>
                          {canje.jugador?.full_name || canje.jugador?.email || 'Jugador'} · {canje.cancha?.nombre || 'Cancha'}
                        </Text>
                        <View style={styles.detalleCanchaRow}>
                          <Text style={[styles.detalleCanchaLabel, { color: colors.textSecondary }]}>
                            {new Date(canje.created_at).toLocaleDateString('es-HN')}
                          </Text>
                          <Text style={[styles.detalleCanchaValue, { color: Colors.success }]}>
                            -{formatCurrency(canje.monto_descontado)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {facturaDetalle.detalles && facturaDetalle.detalles.length > 0 && (
                  <View style={styles.detalleSection}>
                    <Text style={[styles.detalleSectionTitle, { color: colors.text }]}>Desglose por Cancha</Text>
                    {facturaDetalle.detalles.map((detalle) => (
                      <View
                        key={detalle.id}
                        style={[styles.detalleCanchaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Text style={[styles.detalleCanchaNombre, { color: colors.text }]}>
                          {detalle.cancha?.nombre || 'N/A'}
                        </Text>
                        {detalle.cancha?.complejo && (
                          <Text style={[styles.detalleCanchaComplejo, { color: colors.textSecondary }]}>
                            {detalle.cancha.complejo.nombre}
                          </Text>
                        )}
                        <View style={styles.detalleCanchaRow}>
                          <Text style={[styles.detalleCanchaLabel, { color: colors.textSecondary }]}>
                            Reservas: {detalle.total_reservas}
                          </Text>
                          <Text style={[styles.detalleCanchaValue, { color: colors.text }]}>
                            {formatCurrency(detalle.total_facturado)}
                          </Text>
                        </View>
                        <View style={styles.detalleCanchaRow}>
                          <Text style={[styles.detalleCanchaLabel, { color: colors.textSecondary }]}>Comisión:</Text>
                          <Text style={[styles.detalleCanchaValue, { color: Colors.primary }]}>
                            {formatCurrency(detalle.comision)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.modalActionButton, { backgroundColor: Colors.primary }]}
                  onPress={() => {
                    setShowDetalleModal(false);
                    if (facturaDetalle) {
                      handleDescargarPDF(facturaDetalle);
                    }
                  }}
                >
                  <Ionicons name="download-outline" size={20} color={Colors.textInverse} />
                  <Text style={[styles.modalActionButtonText, { color: Colors.textInverse }]}>Descargar PDF</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  scanRecompensaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  scanRecompensaTextWrap: { flex: 1 },
  scanRecompensaTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  scanRecompensaSubtitle: {
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  alertaBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  alertaBannerText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  moraAviso: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  enCursoNota: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  pagarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  pagarButtonText: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.semibold,
    fontSize: Typography.fontSize.md,
  },
  pagoNota: {
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  resumenContainer: {
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  periodoText: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.md,
  },
  resumenCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  resumenRowLast: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resumenLabel: {
    fontSize: Typography.fontSize.md,
  },
  resumenValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  estadoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  estadoBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  resumenActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  historialContainer: {
    padding: Spacing.md,
  },
  historialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  filterButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  filtroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filtroLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  filtroChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginRight: Spacing.xs,
    borderColor: Colors.border,
  },
  filtroChipActive: {
    borderColor: Colors.primary,
  },
  filtroChipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  historialCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    ...Shadows.sm,
  },
  historialCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  historialPeriodo: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  historialFecha: {
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.xs / 2,
  },
  historialCardBody: {
    marginBottom: Spacing.sm,
  },
  historialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  solicitarReembolsoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs / 2,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  historialLabel: {
    fontSize: Typography.fontSize.sm,
  },
  historialValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  historialCardActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  historialActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.xs / 2,
  },
  historialActionButtonSuccess: {
    borderColor: Colors.success,
  },
  historialActionText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  modalSheetOuter: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  modalCard: {
    borderRadius: BorderRadius.lg,
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  modalBodyContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.md,
  },
  detalleSection: {
    marginBottom: Spacing.md,
  },
  detalleSectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  detalleLabel: {
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xs / 2,
  },
  detalleValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  detalleCanchaCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  detalleCanchaNombre: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.xs / 2,
  },
  detalleCanchaComplejo: {
    fontSize: Typography.fontSize.xs,
    marginBottom: Spacing.xs,
  },
  detalleCanchaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs / 2,
  },
  detalleCanchaLabel: {
    fontSize: Typography.fontSize.xs,
  },
  detalleCanchaValue: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  modalActionButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});
