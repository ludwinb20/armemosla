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
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import {
  getFacturaMesActual,
  getHistorialFacturas,
  getFacturaById,
  marcarFacturaPagada,
  FacturaMensual,
  FacturaWithDetalles,
} from '../../lib/pagos';
import { generarYCompartirFacturaPDF } from '../../lib/pdf';
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
  const colors = useThemeColors();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  const [loading, setLoading] = useState(true);
  const [facturaActual, setFacturaActual] = useState<FacturaMensual | null>(null);
  const [historial, setHistorial] = useState<FacturaMensual[]>([]);
  const [facturaDetalle, setFacturaDetalle] = useState<FacturaWithDetalles | null>(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroAño, setFiltroAño] = useState(new Date().getFullYear());
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [nombreAdmin, setNombreAdmin] = useState<string>('');
  const [canjesMes, setCanjesMes] = useState<CanjeRecompensa[]>([]);
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      loadData();
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
      const [factura, historialData] = await Promise.all([
        getFacturaMesActual(),
        getHistorialFacturas(),
      ]);
      
      setFacturaActual(factura);
      setHistorial(historialData);

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

  const handleMarcarPagado = async (facturaId: string) => {
    Alert.alert(
      'Marcar como pagado',
      '¿Estás seguro de que deseas marcar esta factura como pagada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await marcarFacturaPagada(facturaId);
              showSuccess('Éxito', 'Factura marcada como pagada');
              loadData();
            } catch (error: any) {
              console.error('Error al marcar como pagado:', error);
              showError('Error', 'No se pudo marcar la factura como pagada');
            }
          },
        },
      ]
    );
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pagado':
        return Colors.success;
      case 'vencido':
        return Colors.error;
      case 'pendiente':
      default:
        return Colors.warning;
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'pagado':
        return 'Pagado';
      case 'vencido':
        return 'Vencido';
      case 'pendiente':
      default:
        return 'Pendiente';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const historialFiltrado = historial.filter((f) => f.año === filtroAño);

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

        {/* Resumen del Mes Actual */}
        {facturaActual && (
          <View style={styles.resumenContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen del Mes Actual</Text>
            <Text style={[styles.periodoText, { color: colors.textSecondary }]}>
              {MESES[facturaActual.mes - 1]} {facturaActual.año}
            </Text>

            <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Total Facturado</Text>
                <Text style={[styles.resumenValue, { color: colors.text }]}>
                  {formatCurrency(facturaActual.total_facturado)}
                </Text>
              </View>
              <View style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Comisión (10%)</Text>
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
                    <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Comisión neta</Text>
                    <Text style={[styles.resumenValue, { color: getEstadoColor(facturaActual.estado_pago), fontWeight: '700' }]}>
                      {formatCurrency(facturaActual.comision_neta ?? facturaActual.comision)}
                    </Text>
                  </View>
                </>
              )}
              <View style={[styles.resumenRow, styles.resumenRowLast]}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Estado</Text>
                <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(facturaActual.estado_pago) + '20' }]}>
                  <Text style={[styles.estadoBadgeText, { color: getEstadoColor(facturaActual.estado_pago) }]}>
                    {getEstadoTexto(facturaActual.estado_pago)}
                  </Text>
                </View>
              </View>
              <View style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Fecha Límite</Text>
                <Text style={[styles.resumenValue, { color: colors.text }]}>
                  {new Date(facturaActual.fecha_limite_pago).toLocaleDateString('es-ES')}
                </Text>
              </View>

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
                  {factura.estado_pago !== 'pagado' && (
                    <TouchableOpacity
                      style={[styles.historialActionButton, styles.historialActionButtonSuccess, { borderColor: Colors.success }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleMarcarPagado(factura.id);
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                      <Text style={[styles.historialActionText, { color: Colors.success }]}>Pagado</Text>
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
