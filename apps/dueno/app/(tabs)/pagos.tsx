import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import RNModal from 'react-native-modal';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  cargarFacturasPagosScreen,
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
import { Screen, Text, Button, Card, Input, Chip, Divider, Callout, DialogSheet } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { cn } from '@/lib/cn';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimCenter,
} from '../../lib/rnModalPresets';
import { supabase } from '../../lib/supabase';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function PagosScreen() {
  const { colors } = useGlassTheme();
  const router = useRouter();
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
  const loadInFlightRef = useRef(false);

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
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    try {
      setLoading(true);
      const [{ facturaActual: factura, facturaPasada, historial: historialData }, ocultos] =
        await Promise.all([cargarFacturasPagosScreen(), adminTieneComplejosOcultos()]);

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
      loadInFlightRef.current = false;
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
      <Screen className="flex-1" edges={['top', 'bottom']}>
        <PlayerLoadingView />
      </Screen>
    );
  }

  return (
    <Screen className="flex-1" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-md"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={colors.primary}
          />
        }
      >
        <View className="flex-row justify-between items-center px-md pt-sm pb-md border-b mb-md" style={{ borderBottomColor: colors.borderLight }}>
          <Text style={{ color: colors.text }}>Pagos / Facturación</Text>
        </View>

        <Callout
          variant="primary"
          icon="qr-code-outline"
          title="Escanear recompensa"
          subtitle="Canjeá el QR de un jugador al llegar a la cancha"
          onPress={() => router.push('/escanear-recompensa')}
        />

        {complejosOcultos && (
          <Callout
            variant="error"
            icon="eye-off-outline"
            message="Tus complejos están ocultos en la app por falta de pago. Regularizá tu factura pendiente para que los jugadores vuelvan a reservar."
          />
        )}

        {facturaPorPagar && (
          <View className="mb-lg">
            <Text className="text-lg font-bold mb-sm" style={{ color: colors.text }}>Factura a pagar</Text>
            <Text className="text-sm mb-sm" style={{ color: colors.textSecondary }}>
              {MESES[facturaPorPagar.mes - 1]} {facturaPorPagar.año}
            </Text>

            <View className="rounded-md p-md border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="flex-row justify-between items-center py-xs">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>Comisión neta</Text>
                <Text className="text-md font-medium" style={{ color: colors.text }}>
                  {formatCurrency(getComisionBase(facturaPorPagar))}
                </Text>
              </View>
              {(facturaPorPagar.monto_mora ?? 0) > 0 && (
                <>
                  <View className="flex-row justify-between items-center py-xs">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      Mora ({facturaPorPagar.dias_retraso} día{facturaPorPagar.dias_retraso === 1 ? '' : 's'} · 3%/día)
                    </Text>
                    <Text className="text-md font-medium" style={{ color: colors.error }}>
                      +{formatCurrency(facturaPorPagar.monto_mora ?? 0)}
                    </Text>
                  </View>
                  <Text className="text-sm leading-5" style={{ color: colors.error }}>
                    Pasaste el día 20 sin pagar. La mora (3% diario) se acumula solo hasta el{' '}
                    {getFechaOcultamientoComplejos(facturaPorPagar.mes, facturaPorPagar.año).toLocaleDateString('es-HN')}
                    .
                  </Text>
                  {moraCongelada(facturaPorPagar) && (
                    <Text className="text-sm leading-5" style={{ color: colors.textSecondary }}>
                      El total ya no aumenta. Tus complejos están ocultos en búsqueda hasta que pagues la factura pendiente.
                    </Text>
                  )}
                </>
              )}
              <View className="flex-row justify-between items-center py-xs border-t pt-sm mt-sm">
                <Text className="text-sm" style={{ color: colors.textSecondary, fontWeight: '700' }}>Total a pagar</Text>
                <Text className="text-md font-medium" style={{ color: colors.primary, fontWeight: '700' }}>
                  {formatCurrency(getTotalAPagar(facturaPorPagar))}
                </Text>
              </View>
              <View className="flex-row justify-between items-center py-xs">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>Estado</Text>
                <View className="self-start px-sm py-0.5 rounded-sm" style={{ backgroundColor: getEstadoColor(facturaPorPagar.estado_pago) + '20' }}>
                  <Text className="text-xs font-semibold" style={{ color: getEstadoColor(facturaPorPagar.estado_pago) }}>
                    {getEstadoTexto(facturaPorPagar.estado_pago)}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between items-center py-xs">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>Fecha límite</Text>
                <Text className="text-md font-medium" style={{ color: colors.text }}>
                  {new Date(facturaPorPagar.fecha_limite_pago).toLocaleDateString('es-HN')}
                </Text>
              </View>
              {facturaPorPagar.estado_pago === 'en_revision' && montoPendiente > 0 && (
                <View className="flex-row justify-between items-center py-xs">
                  <Text className="text-sm" style={{ color: colors.textSecondary }}>Pendiente de confirmar</Text>
                  <Text className="text-md font-medium" style={{ color: colors.warning }}>
                    {formatCurrency(montoPendiente)}
                  </Text>
                </View>
              )}
              {facturaPorPagar.estado_pago === 'en_revision' && (
                <Text className="text-sm leading-5" style={{ color: colors.textSecondary }}>
                  Tu pago está en revisión. Mientras tanto no se aplican mora ni se ocultan tus complejos.
                </Text>
              )}
              {facturaPorPagar.estado_pago === 'retrasado' && !moraCongelada(facturaPorPagar) && (
                <Text className="text-sm leading-5" style={{ color: colors.textSecondary }}>
                  Si no pagás antes del{' '}
                  {getFechaOcultamientoComplejos(facturaPorPagar.mes, facturaPorPagar.año).toLocaleDateString('es-HN')}
                  , tus complejos dejarán de mostrarse en la app y la mora dejará de aumentar.
                </Text>
              )}

              <View className="flex-row gap-sm mt-md">
                <TouchableOpacity
                  className={cn("flex-1 flex-row items-center justify-center p-sm rounded-md gap-xs", "border")} style={{ borderColor: colors.border }}
                  onPress={() => handleVerDetalle(facturaPorPagar)}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.text} />
                  <Text className="text-sm font-medium" style={{ color: colors.text }}>Ver Detalle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={cn("flex-1 flex-row items-center justify-center p-sm rounded-md gap-xs")} style={{ backgroundColor: colors.primary }}
                  onPress={() => handleDescargarPDF(facturaPorPagar)}
                  disabled={generandoPDF}
                >
                  {generandoPDF ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color={colors.textInverse} />
                      <Text className="text-sm font-medium" style={{ color: colors.textInverse }}>PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                className="flex-row items-center justify-center p-md rounded-md mt-md gap-sm" style={{ backgroundColor: colors.primary }}
                onPress={() => handleReportarTransferencia(facturaPorPagar)}
              >
                <Ionicons name="swap-horizontal-outline" size={22} color={colors.textInverse} />
                <Text className="text-md font-semibold text-text-inverse">Reportar transferencia</Text>
              </TouchableOpacity>
              <Text className="mt-sm text-center text-sm" style={{ color: colors.textSecondary }}>
                Transferí a una cuenta de Armemosla y reportá el pago con el número de referencia bancaria.
              </Text>

              {transferenciasFactura.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text className="text-lg font-bold mb-sm" style={{ color: colors.text }}>
                    Historial de transferencias
                  </Text>
                  {transferenciasFactura.map((t) => {
                    const solicitud = solicitudPorTransferencia(t.id);
                    return (
                    <View
                      key={t.id}
                      className="rounded-md p-md border mb-sm" style={{ backgroundColor: colors.background, borderColor: colors.border, marginBottom: 8 }}
                    >
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>
                          {new Date(t.created_at).toLocaleDateString('es-HN')} · Ref {t.numero_transaccion}
                        </Text>
                        <Text className="text-md font-medium" style={{ color: colors.text }}>
                          {formatCurrency(Number(t.monto_aplicado))}
                        </Text>
                      </View>
                      <Text className="text-xs mt-1" style={{ color: getEstadoColor(t.estado === 'confirmada' ? 'pagado' : t.estado === 'rechazada' ? 'retrasado' : 'en_revision') }}>
                        {t.estado === 'pendiente_revision' ? 'En revisión' : t.estado === 'confirmada' ? 'Confirmada' : t.estado === 'rechazada' ? `Rechazada${t.notas_admin ? `: ${t.notas_admin}` : ''}` : t.estado === 'reembolsada' ? 'Reembolsada' : t.estado}
                      </Text>
                      {solicitud?.estado === 'pendiente' && (
                        <View style={{ marginTop: 4 }}>
                          <Text className="text-xs mt-1" style={{ color: colors.warning }}>
                            Solicitud de reembolso en revisión ({formatCurrency(Number(solicitud.monto))})
                          </Text>
                          <TouchableOpacity onPress={() => handleCancelarSolicitud(solicitud.id)}>
                            <Text style={{ color: colors.error, marginTop: 4 }}>
                              Cancelar solicitud
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {solicitud?.estado === 'rechazada' && solicitud.respuesta_plataforma && (
                        <Text className="text-xs mt-1" style={{ color: colors.error, marginTop: 4 }}>
                          Reembolso rechazado: {solicitud.respuesta_plataforma}
                        </Text>
                      )}
                      {t.estado === 'confirmada' && !solicitud && (
                        <TouchableOpacity
                          className="flex-row items-center gap-xs p-sm rounded-md border mt-xs self-start" style={{ borderColor: colors.warning }}
                          onPress={() => handleSolicitarReembolso(t.id)}
                        >
                          <Ionicons name="return-down-back-outline" size={16} color={colors.warning} />
                          <Text style={{ color: colors.warning }}>
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
                <View style={{ marginTop: 4 }}>
                  <Text className="text-lg font-bold mb-sm" style={{ color: colors.text }}>
                    Reembolsos
                  </Text>
                  {reembolsosFactura.map((r) => (
                    <Text key={r.id} className="text-sm leading-5" style={{ color: colors.error }}>
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
          <View className="mb-lg">
            <Text className="text-lg font-bold mb-sm" style={{ color: colors.text }}>Mes en curso</Text>
            <Text className="text-sm mb-sm" style={{ color: colors.textSecondary }}>
              {MESES[facturaActual.mes - 1]} {facturaActual.año} · acumulando reservas
            </Text>

            <View className="rounded-md p-md border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="flex-row justify-between items-center py-xs">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>Total Facturado</Text>
                <Text className="text-md font-medium" style={{ color: colors.text }}>
                  {formatCurrency(facturaActual.total_facturado)}
                </Text>
              </View>
              <View className="flex-row justify-between items-center py-xs">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>Comisión estimada (10%)</Text>
                <Text className="text-md font-medium" style={{ color: colors.text }}>
                  {formatCurrency(facturaActual.comision)}
                </Text>
              </View>
              {(facturaActual.total_descuentos_canje ?? 0) > 0 && (
                <>
                  <View className="flex-row justify-between items-center py-xs">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>Descuentos por canjes</Text>
                    <Text className="text-md font-medium" style={{ color: colors.success }}>
                      -{formatCurrency(facturaActual.total_descuentos_canje ?? 0)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center py-xs">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>Comisión neta estimada</Text>
                    <Text className="text-md font-medium" style={{ color: colors.text, fontWeight: '700' }}>
                      {formatCurrency(facturaActual.comision_neta ?? facturaActual.comision)}
                    </Text>
                  </View>
                </>
              )}
              <View className="flex-row justify-between items-center py-xs border-t pt-sm mt-sm">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>Estado</Text>
                <View className="self-start px-sm py-0.5 rounded-sm" style={{ backgroundColor: colors.primary + '20' }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.primary }}>En curso</Text>
                </View>
              </View>
              <Text className="mt-sm text-sm" style={{ color: colors.textSecondary }}>
                {textoProximoPagoMesActual()}. Hasta fin de mes seguirá actualizándose con nuevas reservas completadas.
              </Text>

              <View className="flex-row gap-sm mt-md">
                <TouchableOpacity
                  className={cn("flex-1 flex-row items-center justify-center p-sm rounded-md gap-xs", "border")} style={{ borderColor: colors.border }}
                  onPress={() => handleVerDetalle(facturaActual)}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.text} />
                  <Text className="text-sm font-medium" style={{ color: colors.text }}>Ver Detalle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={cn("flex-1 flex-row items-center justify-center p-sm rounded-md gap-xs")} style={{ backgroundColor: colors.primary }}
                  onPress={() => handleDescargarPDF(facturaActual)}
                  disabled={generandoPDF}
                >
                  {generandoPDF ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color={colors.textInverse} />
                      <Text className="text-sm font-medium" style={{ color: colors.textInverse }}>Descargar PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {canjesMes.length > 0 && facturaActual && (
          <View className="mb-lg">
            <Text className="text-lg font-bold mb-sm" style={{ color: colors.text }}>Canjes de recompensas</Text>
            <Text className="text-sm mb-sm" style={{ color: colors.textSecondary }}>
              {MESES[facturaActual.mes - 1]} {facturaActual.año}
            </Text>
            {canjesMes.map((canje) => (
              <View
                key={canje.id}
                className="rounded-md p-md border mb-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              >
                <View className="flex-row justify-between items-start mb-sm">
                  <View>
                    <Text className="text-md font-semibold" style={{ color: colors.text }}>{canje.logro_titulo}</Text>
                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                      {canje.jugador?.full_name || canje.jugador?.email || 'Jugador'} · {canje.cancha?.nombre}
                    </Text>
                  </View>
                  <Text className="text-md font-medium" style={{ color: colors.success }}>
                    -{formatCurrency(canje.monto_descontado)}
                  </Text>
                </View>
                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
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
        <View className="mb-lg">
          <View className="flex-row justify-between items-center mb-sm">
            <Text className="text-lg font-bold mb-sm" style={{ color: colors.text }}>Historial de Pagos</Text>
            <TouchableOpacity
              className="p-sm rounded-md border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              onPress={() => setShowFiltros(!showFiltros)}
            >
              <Ionicons name="filter-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {showFiltros && (
            <View className="p-md rounded-md border mb-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <Text className="text-sm font-medium mb-xs" style={{ color: colors.text }}>Año:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((año) => (
                  <TouchableOpacity
                    key={año}
                    className={cn(
                      "px-md py-sm rounded-md mr-sm",
                      filtroAño === año && "bg-primary",
                    )}
                    onPress={() => setFiltroAño(año)}
                  >
                    <Text
                      className={cn("text-sm")} style={{ color: filtroAño === año ? colors.textInverse : colors.text }}
                    >
                      {año}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {historialFiltrado.length === 0 ? (
            <View style={""}>
              <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
              <Text className="text-lg font-bold mt-md" style={{ color: colors.text }}>No hay facturas</Text>
              <Text style={{ color: colors.textSecondary }}>
                Aún no hay facturas para el año seleccionado
              </Text>
            </View>
          ) : (
            historialFiltrado.map((factura) => (
              <TouchableOpacity
                key={factura.id}
                className="rounded-md p-md border mb-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                onPress={() => handleVerDetalle(factura)}
              >
                <View className="flex-row justify-between items-start mb-sm">
                  <View>
                    <Text className="text-md font-semibold" style={{ color: colors.text }}>
                      {MESES[factura.mes - 1]} {factura.año}
                    </Text>
                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                      Vence: {new Date(factura.fecha_limite_pago).toLocaleDateString('es-ES')}
                    </Text>
                  </View>
                  <View className="self-start px-sm py-0.5 rounded-sm" style={{ backgroundColor: getEstadoColor(factura.estado_pago) + '20' }}>
                    <Text className="text-xs font-semibold" style={{ color: getEstadoColor(factura.estado_pago) }}>
                      {getEstadoTexto(factura.estado_pago)}
                    </Text>
                  </View>
                </View>
                <View className="mb-sm">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>Total Facturado:</Text>
                    <Text className="text-md font-medium" style={{ color: colors.text }}>
                      {formatCurrency(factura.total_facturado)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>Comisión:</Text>
                    <Text className="text-md font-medium" style={{ color: getEstadoColor(factura.estado_pago) }}>
                      {formatCurrency(factura.comision)}
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-sm">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center p-sm rounded-md border gap-xs" style={{ borderColor: colors.border }}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDescargarPDF(factura);
                    }}
                  >
                    <Ionicons name="download-outline" size={16} color={colors.text} />
                    <Text className="text-sm font-medium" style={{ color: colors.text }}>PDF</Text>
                  </TouchableOpacity>
                  {factura.estado_pago !== 'pagado' && esFacturaPagable(factura) && (
                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center p-sm rounded-md border gap-xs" style={{ borderColor: colors.primary }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleReportarTransferencia(factura);
                      }}
                    >
                      <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
                      <Text className="text-sm font-medium" style={{ color: colors.primary }}>Reportar</Text>
                    </TouchableOpacity>
                  )}
                  {factura.estado_pago === 'pagado' && (
                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center p-sm rounded-md border gap-xs" style={{ borderColor: colors.success }}
                      onPress={(e) => {
                        e.stopPropagation();
                        void handleDescargarFacturaFiscal(factura);
                      }}
                    >
                      <Ionicons name="document-text-outline" size={16} color={colors.success} />
                      <Text className="text-sm font-medium" style={{ color: colors.success }}>RTN</Text>
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
        {...rModalAnimCenter}
        isVisible={showDetalleModal}
        onBackdropPress={() => setShowDetalleModal(false)}
        onBackButtonPress={() => setShowDetalleModal(false)}
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
            <View className="flex-row justify-between items-center p-lg border-b flex-shrink-0" style={{ borderBottomColor: colors.borderLight }}>
              <Text className="text-xl font-bold" style={{ color: colors.text }}>Detalle de Factura</Text>
              <TouchableOpacity onPress={() => setShowDetalleModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {facturaDetalle && (
              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerClassName="p-lg pb-lg"
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                <View className="mb-md">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>Período</Text>
                  <Text className="text-md font-medium" style={{ color: colors.text }}>
                    {MESES[facturaDetalle.mes - 1]} {facturaDetalle.año}
                  </Text>
                </View>

                <View className="mb-md">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>Total Facturado</Text>
                  <Text className="text-md font-medium" style={{ color: colors.text }}>
                    {formatCurrency(facturaDetalle.total_facturado)}
                  </Text>
                </View>

                <View className="mb-md">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>Comisión (10%)</Text>
                  <Text className="text-md font-medium" style={{ color: colors.text }}>
                    {formatCurrency(facturaDetalle.comision)}
                  </Text>
                </View>

                {(facturaDetalle.total_descuentos_canje ?? 0) > 0 && (
                  <>
                    <View className="mb-md">
                      <Text className="text-xs" style={{ color: colors.textSecondary }}>Descuentos por canjes</Text>
                      <Text className="text-md font-medium" style={{ color: colors.success }}>
                        -{formatCurrency(facturaDetalle.total_descuentos_canje ?? 0)}
                      </Text>
                    </View>
                    <View className="mb-md">
                      <Text className="text-xs" style={{ color: colors.textSecondary }}>Comisión neta</Text>
                      <Text className="text-md font-medium" style={{ color: colors.primary, fontWeight: '700' }}>
                        {formatCurrency(facturaDetalle.comision_neta ?? facturaDetalle.comision)}
                      </Text>
                    </View>
                  </>
                )}

                <View className="mb-md">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>Estado</Text>
                  <View className="self-start px-sm py-0.5 rounded-sm" style={{ backgroundColor: getEstadoColor(facturaDetalle.estado_pago) + '20' }}>
                    <Text className="text-xs font-semibold" style={{ color: getEstadoColor(facturaDetalle.estado_pago) }}>
                      {getEstadoTexto(facturaDetalle.estado_pago)}
                    </Text>
                  </View>
                </View>

                {canjesMes.length > 0 && (
                  <View className="mb-md">
                    <Text className="text-md font-bold mb-sm" style={{ color: colors.text }}>Canjes de recompensas</Text>
                    {canjesMes.map((canje) => (
                      <View
                        key={canje.id}
                        className="rounded-md p-md border mb-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <Text className="text-md font-semibold" style={{ color: colors.text }}>
                          {canje.logro_titulo}
                        </Text>
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>
                          {canje.jugador?.full_name || canje.jugador?.email || 'Jugador'} · {canje.cancha?.nombre || 'Cancha'}
                        </Text>
                        <View className="flex-row justify-between items-center">
                          <Text className="text-sm" style={{ color: colors.textSecondary }}>
                            {new Date(canje.created_at).toLocaleDateString('es-HN')}
                          </Text>
                          <Text className="text-md font-medium" style={{ color: colors.success }}>
                            -{formatCurrency(canje.monto_descontado)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {facturaDetalle.detalles && facturaDetalle.detalles.length > 0 && (
                  <View className="mb-md">
                    <Text className="text-md font-bold mb-sm" style={{ color: colors.text }}>Desglose por Cancha</Text>
                    {facturaDetalle.detalles.map((detalle) => (
                      <View
                        key={detalle.id}
                        className="rounded-md p-md border mb-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <Text className="text-md font-semibold" style={{ color: colors.text }}>
                          {detalle.cancha?.nombre || 'N/A'}
                        </Text>
                        {detalle.cancha?.complejo && (
                          <Text className="text-sm" style={{ color: colors.textSecondary }}>
                            {detalle.cancha.complejo.nombre}
                          </Text>
                        )}
                        <View className="flex-row justify-between items-center">
                          <Text className="text-sm" style={{ color: colors.textSecondary }}>
                            Reservas: {detalle.total_reservas}
                          </Text>
                          <Text className="text-md font-medium" style={{ color: colors.text }}>
                            {formatCurrency(detalle.total_facturado)}
                          </Text>
                        </View>
                        <View className="flex-row justify-between items-center">
                          <Text className="text-sm" style={{ color: colors.textSecondary }}>Comisión:</Text>
                          <Text className="text-md font-medium" style={{ color: colors.primary }}>
                            {formatCurrency(detalle.comision)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  className="flex-row items-center justify-center p-md rounded-md gap-sm mt-md" style={{ backgroundColor: colors.primary }}
                  onPress={() => {
                    setShowDetalleModal(false);
                    if (facturaDetalle) {
                      handleDescargarPDF(facturaDetalle);
                    }
                  }}
                >
                  <Ionicons name="download-outline" size={20} color={colors.textInverse} />
                  <Text className="text-md font-semibold" style={{ color: colors.textInverse }}>Descargar PDF</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
        </DialogSheet>
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
    </Screen>
  );
}

