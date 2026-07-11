import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useThemeColors } from '../../hooks/useThemeColors';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import {
  listarPagosPendientes,
  listarTransferenciasConfirmadas,
  confirmarTransferencia,
  rechazarTransferencia,
  registrarReembolso,
  listarSolicitudesReembolsoPendientes,
  aprobarSolicitudReembolso,
  rechazarSolicitudReembolso,
  TransferenciaPendiente,
  SolicitudReembolsoPendiente,
} from '../../lib/adminPagos';
import { getTotalAPagar } from '../../lib/pagos';
import { getMontoConfirmado } from '../../lib/transferencias';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
} from '../../lib/rnModalPresets';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type TabActiva = 'revision' | 'reembolsos';

type ItemRevision =
  | { tipo: 'pago'; item: TransferenciaPendiente; fecha: string }
  | { tipo: 'reembolso'; item: SolicitudReembolsoPendiente; fecha: string };

export default function RevisionPagosScreen() {
  const colors = useThemeColors();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabActiva, setTabActiva] = useState<TabActiva>('revision');
  const [pendientes, setPendientes] = useState<TransferenciaPendiente[]>([]);
  const [confirmadas, setConfirmadas] = useState<TransferenciaPendiente[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudReembolsoPendiente[]>([]);
  const [selected, setSelected] = useState<TransferenciaPendiente | null>(null);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudReembolsoPendiente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showReembolsoModal, setShowReembolsoModal] = useState(false);
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [reembolsoMonto, setReembolsoMonto] = useState('');
  const [reembolsoMotivo, setReembolsoMotivo] = useState('');
  const [reembolsoMensaje, setReembolsoMensaje] = useState('');
  const [solicitudMensaje, setSolicitudMensaje] = useState('');
  const [solicitudRechazo, setSolicitudRechazo] = useState('');
  const [processing, setProcessing] = useState(false);
  const [montoConfirmado, setMontoConfirmado] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [])
  );

  const loadData = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const [dataPendientes, dataConfirmadas, dataSolicitudes] = await Promise.all([
        listarPagosPendientes(),
        listarTransferenciasConfirmadas(),
        listarSolicitudesReembolsoPendientes(),
      ]);
      setPendientes(dataPendientes);
      setConfirmadas(dataConfirmadas);
      setSolicitudes(dataSolicitudes);
    } catch (error) {
      console.error(error);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  const openDetalle = async (item: TransferenciaPendiente) => {
    setSelected(item);
    setMotivoRechazo('');
    if (item.factura_id) {
      const confirmado = await getMontoConfirmado(item.factura_id);
      setMontoConfirmado(confirmado);
    }
    setShowModal(true);
  };

  const openReembolso = (item: TransferenciaPendiente) => {
    setSelected(item);
    setReembolsoMonto(String(item.monto_aplicado ?? item.monto));
    setReembolsoMotivo('');
    setReembolsoMensaje('');
    setShowReembolsoModal(true);
  };

  const openSolicitud = (item: SolicitudReembolsoPendiente) => {
    setSelectedSolicitud(item);
    setSolicitudMensaje('');
    setSolicitudRechazo('');
    setShowSolicitudModal(true);
  };

  const handleAprobarSolicitud = async () => {
    if (!selectedSolicitud) return;
    if (!solicitudMensaje.trim()) {
      Alert.alert('Mensaje requerido', 'Indicá el mensaje que verá el admin del complejo');
      return;
    }

    Alert.alert(
      'Aprobar reembolso',
      `¿Aprobar solicitud de ${formatCurrency(Number(selectedSolicitud.monto))}? Deberás transferir ese monto al admin por banco.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: () => {
            void (async () => {
              try {
                setProcessing(true);
                await aprobarSolicitudReembolso(selectedSolicitud.id, solicitudMensaje.trim());
                setShowSolicitudModal(false);
                await loadData({ silent: true });
                Alert.alert('Listo', 'Solicitud aprobada y reembolso registrado.');
              } catch (error: unknown) {
                Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo aprobar');
              } finally {
                setProcessing(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleRechazarSolicitud = async () => {
    if (!selectedSolicitud) return;
    if (!solicitudRechazo.trim()) {
      Alert.alert('Motivo requerido', 'Indicá por qué se rechaza la solicitud');
      return;
    }
    try {
      setProcessing(true);
      await rechazarSolicitudReembolso(selectedSolicitud.id, solicitudRechazo.trim());
      setShowSolicitudModal(false);
      await loadData({ silent: true });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo rechazar');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(amount);

  const handleConfirmar = async () => {
    if (!selected) return;
    try {
      setProcessing(true);
      await confirmarTransferencia(selected.id);
      setShowModal(false);
      await loadData({ silent: true });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo confirmar');
    } finally {
      setProcessing(false);
    }
  };

  const handleRechazar = async () => {
    if (!selected) return;
    if (!motivoRechazo.trim()) {
      Alert.alert('Motivo requerido', 'Indicá por qué se rechaza la transferencia');
      return;
    }
    try {
      setProcessing(true);
      await rechazarTransferencia(selected.id, motivoRechazo.trim());
      setShowModal(false);
      await loadData({ silent: true });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo rechazar');
    } finally {
      setProcessing(false);
    }
  };

  const handleRegistrarReembolso = async () => {
    if (!selected) return;

    const montoNum = parseFloat(reembolsoMonto.replace(',', '.'));
    const maxMonto = Number(selected.monto_aplicado ?? selected.monto);

    if (!Number.isFinite(montoNum) || montoNum <= 0 || montoNum > maxMonto) {
      Alert.alert('Monto inválido', `Ingresá un monto entre 0.01 y ${formatCurrency(maxMonto)}`);
      return;
    }
    if (!reembolsoMotivo.trim()) {
      Alert.alert('Motivo requerido', 'Indicá el motivo interno del reembolso');
      return;
    }
    if (!reembolsoMensaje.trim()) {
      Alert.alert('Mensaje requerido', 'Indicá el mensaje que verá el admin del complejo');
      return;
    }

    const transferenciaId = selected.id;
    const motivo = reembolsoMotivo.trim();
    const mensaje = reembolsoMensaje.trim();

    Alert.alert(
      'Confirmar reembolso',
      `¿Registrar reembolso de ${formatCurrency(montoNum)}? La factura puede volver a estado pendiente si el total confirmado ya no cubre el monto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Registrar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setProcessing(true);
                await registrarReembolso(transferenciaId, montoNum, motivo, mensaje);
                setShowReembolsoModal(false);
                await loadData({ silent: true });
                Alert.alert('Listo', 'Reembolso registrado. El admin lo verá en su historial de pagos.');
              } catch (error: unknown) {
                Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo registrar el reembolso');
              } finally {
                setProcessing(false);
              }
            })();
          },
        },
      ]
    );
  };

  const renderSolicitudCard = (item: SolicitudReembolsoPendiente) => (
    <TouchableOpacity
      key={`reembolso-${item.id}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => openSolicitud(item)}
    >
      <View style={[styles.rtnBadge, { backgroundColor: Colors.error + '20', marginBottom: Spacing.xs }]}>
        <Text style={{ color: Colors.error, fontSize: Typography.fontSize.xs }}>Reembolso solicitado</Text>
      </View>
      <View style={styles.cardHeader}>
        <Text style={[styles.adminName, { color: colors.text }]}>
          {item.admin_nombre || item.admin_email || 'Admin'}
        </Text>
        <Text style={[styles.monto, { color: Colors.error }]}>
          {formatCurrency(Number(item.monto))}
        </Text>
      </View>
      {item.transferencia && (
        <Text style={[styles.ref, { color: colors.textSecondary }]}>
          Ref: {item.transferencia.numero_transaccion}
        </Text>
      )}
      <Text style={[styles.periodo, { color: colors.textSecondary }]} numberOfLines={2}>
        {item.motivo}
      </Text>
    </TouchableOpacity>
  );

  const itemsRevision: ItemRevision[] = [
    ...pendientes.map((item) => ({
      tipo: 'pago' as const,
      item,
      fecha: item.created_at,
    })),
    ...solicitudes.map((item) => ({
      tipo: 'reembolso' as const,
      item,
      fecha: item.created_at,
    })),
  ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const totalPorRevisar = pendientes.length + solicitudes.length;

  const renderTransferenciaCard = (
    item: TransferenciaPendiente,
    onPress: () => void,
    badge?: { label: string; color: string }
  ) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      {badge && (
        <View style={[styles.rtnBadge, { backgroundColor: badge.color + '20', marginBottom: Spacing.xs }]}>
          <Text style={{ color: badge.color, fontSize: Typography.fontSize.xs }}>{badge.label}</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <Text style={[styles.adminName, { color: colors.text }]}>
          {item.admin_nombre || item.admin_email || 'Admin'}
        </Text>
        <Text style={[styles.monto, { color: Colors.primary }]}>
          {formatCurrency(Number(item.monto_aplicado))}
        </Text>
      </View>
      {item.factura && (
        <Text style={[styles.periodo, { color: colors.textSecondary }]}>
          Factura {MESES[item.factura.mes - 1]} {item.factura.año}
        </Text>
      )}
      <Text style={[styles.ref, { color: colors.textSecondary }]}>
        Ref: {item.numero_transaccion}
      </Text>
      {item.solicita_factura_rtn && (
        <View style={[styles.rtnBadge, { backgroundColor: Colors.primary + '20' }]}>
          <Text style={{ color: Colors.primary, fontSize: Typography.fontSize.xs }}>Solicita RTN</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <PlayerLoadingView message="Cargando pagos..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Revisión de pagos</Text>
        <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, tabActiva === 'revision' && { backgroundColor: Colors.primary }]}
            onPress={() => setTabActiva('revision')}
          >
            <Text style={[styles.tabText, { color: tabActiva === 'revision' ? Colors.textInverse : colors.text }]}>
              Por revisar ({totalPorRevisar})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tabActiva === 'reembolsos' && { backgroundColor: Colors.warning }]}
            onPress={() => setTabActiva('reembolsos')}
          >
            <Text style={[styles.tabText, { color: tabActiva === 'reembolsos' ? Colors.textInverse : colors.text }]}>
              Reembolso directo ({confirmadas.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(); }} />
        }
      >
        {tabActiva === 'revision' && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Pagos reportados y solicitudes de reembolso. Confirmá o rechazá cada ítem.
          </Text>
        )}
        {tabActiva === 'reembolsos' && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Reembolso directo sin solicitud previa. Al reembolsar, la factura puede reabrirse si el total ya no cubre el monto.
          </Text>
        )}

        {tabActiva === 'revision' ? (
          itemsRevision.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nada pendiente</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Cuando un admin reporte un pago o solicite un reembolso, aparecerá aquí.
              </Text>
            </View>
          ) : (
            itemsRevision.map((entry) =>
              entry.tipo === 'pago'
                ? renderTransferenciaCard(
                    entry.item,
                    () => void openDetalle(entry.item),
                    { label: 'Pago reportado', color: Colors.primary }
                  )
                : renderSolicitudCard(entry.item)
            )
          )
        ) : confirmadas.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cash-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin transferencias confirmadas</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Las transferencias confirmadas aparecerán aquí para registrar reembolsos directos.
            </Text>
          </View>
        ) : (
          confirmadas.map((item) =>
            renderTransferenciaCard(
              item,
              () => openReembolso(item),
              { label: 'Confirmada · tocar para reembolsar', color: Colors.success }
            )
          )
        )}
      </ScrollView>

      {/* Modal revisión pendiente */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showModal}
        onBackdropPress={() => setShowModal(false)}
        onBackButtonPress={() => setShowModal(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modal, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Detalle transferencia</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView
                style={{ maxHeight: modalScrollAreaMaxHeight }}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Admin</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {selected.admin_nombre || selected.admin_email}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Monto reportado</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatCurrency(Number(selected.monto_aplicado))}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Referencia bancaria</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{selected.numero_transaccion}</Text>

                {selected.cuenta_bancaria && (
                  <>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Cuenta destino</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selected.cuenta_bancaria.banco_nombre} · {selected.cuenta_bancaria.numero_cuenta}
                    </Text>
                  </>
                )}

                {selected.factura && (
                  <>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Progreso factura</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      Confirmado: {formatCurrency(montoConfirmado)} / {formatCurrency(getTotalAPagar(selected.factura))}
                    </Text>
                  </>
                )}

                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Motivo rechazo</Text>
                <TextInput
                  style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                  value={motivoRechazo}
                  onChangeText={setMotivoRechazo}
                  placeholder="Ej. referencia no encontrada en extracto"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  blurOnSubmit={false}
                />

                <TouchableOpacity
                  style={[styles.btnConfirm, { backgroundColor: Colors.primary }]}
                  onPress={() => void handleConfirmar()}
                  disabled={processing}
                >
                  {processing ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.btnText}>Confirmar transferencia</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnReject, { borderColor: Colors.error }]}
                  onPress={() => void handleRechazar()}
                  disabled={processing}
                >
                  <Text style={[styles.btnRejectText, { color: Colors.error }]}>Rechazar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Modal reembolso */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showReembolsoModal}
        onBackdropPress={() => !processing && setShowReembolsoModal(false)}
        onBackButtonPress={() => !processing && setShowReembolsoModal(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modal, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Registrar reembolso</Text>
              <TouchableOpacity onPress={() => setShowReembolsoModal(false)} disabled={processing}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selected && (
              <>
                <ScrollView
                  style={{ maxHeight: modalScrollAreaMaxHeight }}
                  contentContainerStyle={styles.modalBody}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                >
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selected.admin_nombre || selected.admin_email} · Ref {selected.numero_transaccion}
                  </Text>
                  <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                    Máximo reembolsable: {formatCurrency(Number(selected.monto_aplicado ?? selected.monto))}
                  </Text>

                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Monto a reembolsar (L)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={reembolsoMonto}
                    onChangeText={setReembolsoMonto}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                  />

                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Motivo interno</Text>
                  <TextInput
                    style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={reembolsoMotivo}
                    onChangeText={setReembolsoMotivo}
                    placeholder="Ej. pago duplicado, error de conciliación"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    blurOnSubmit={false}
                  />

                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Mensaje visible al admin</Text>
                  <TextInput
                    style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={reembolsoMensaje}
                    onChangeText={setReembolsoMensaje}
                    placeholder="Ej. Reembolsamos L 500 por transferencia duplicada."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    blurOnSubmit={false}
                  />
                </ScrollView>

                <View style={[styles.modalFooter, { borderTopColor: colors.borderLight }]}>
                  <TouchableOpacity
                    style={[styles.btnConfirm, { backgroundColor: Colors.warning, marginTop: 0, opacity: processing ? 0.7 : 1 }]}
                    onPress={() => void handleRegistrarReembolso()}
                    disabled={processing}
                  >
                    {processing ? <ActivityIndicator color="#fff" /> : (
                      <Text style={styles.btnText}>Registrar reembolso</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Modal solicitud reembolso */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showSolicitudModal}
        onBackdropPress={() => !processing && setShowSolicitudModal(false)}
        onBackButtonPress={() => !processing && setShowSolicitudModal(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modal, { backgroundColor: colors.background, maxHeight: modalMaxHeight }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Solicitud de reembolso</Text>
              <TouchableOpacity onPress={() => setShowSolicitudModal(false)} disabled={processing}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedSolicitud && (
              <>
                <ScrollView
                  style={{ maxHeight: modalScrollAreaMaxHeight }}
                  contentContainerStyle={styles.modalBody}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                >
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Admin</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedSolicitud.admin_nombre || selectedSolicitud.admin_email}
                  </Text>

                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Monto solicitado</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatCurrency(Number(selectedSolicitud.monto))}
                  </Text>

                  {selectedSolicitud.transferencia && (
                    <>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Referencia</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {selectedSolicitud.transferencia.numero_transaccion}
                      </Text>
                    </>
                  )}

                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Motivo del admin</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedSolicitud.motivo}</Text>

                  <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                    Si aprobás, transferí el monto al admin por banco y el sistema ajustará su factura.
                  </Text>

                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Mensaje visible al aprobar</Text>
                  <TextInput
                    style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={solicitudMensaje}
                    onChangeText={setSolicitudMensaje}
                    placeholder="Ej. Reembolsamos L 500 por transferencia duplicada."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    blurOnSubmit={false}
                  />

                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Motivo de rechazo (opcional)</Text>
                  <TextInput
                    style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={solicitudRechazo}
                    onChangeText={setSolicitudRechazo}
                    placeholder="Solo si vas a rechazar la solicitud"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    blurOnSubmit={false}
                  />
                </ScrollView>

                <View style={[styles.modalFooter, { borderTopColor: colors.borderLight }]}>
                  <TouchableOpacity
                    style={[styles.btnConfirm, { backgroundColor: Colors.success, marginTop: 0, opacity: processing ? 0.7 : 1 }]}
                    onPress={() => void handleAprobarSolicitud()}
                    disabled={processing}
                  >
                    {processing ? <ActivityIndicator color="#fff" /> : (
                      <Text style={styles.btnText}>Aprobar y registrar reembolso</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnReject, { borderColor: Colors.error, opacity: processing ? 0.7 : 1 }]}
                    onPress={() => void handleRechazarSolicitud()}
                    disabled={processing}
                  >
                    <Text style={[styles.btnRejectText, { color: Colors.error }]}>Rechazar solicitud</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </RNModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.sm },
  tabs: { flexDirection: 'row', borderRadius: BorderRadius.md, borderWidth: 1, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, alignItems: 'center' },
  tabText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },
  hint: { fontSize: Typography.fontSize.sm, lineHeight: 20, marginBottom: Spacing.sm },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginTop: Spacing.md },
  emptyText: { fontSize: Typography.fontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
  card: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, ...Shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  adminName: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold, flex: 1 },
  monto: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },
  periodo: { fontSize: Typography.fontSize.sm, marginTop: 4 },
  ref: { fontSize: Typography.fontSize.xs, marginTop: 4 },
  rtnBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, marginTop: Spacing.xs },
  modalSheetOuter: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  modal: { borderRadius: BorderRadius.lg, overflow: 'hidden', width: '100%', maxWidth: 440, alignSelf: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1 },
  modalTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  modalBody: { padding: Spacing.md, paddingBottom: Spacing.lg },
  modalHint: { fontSize: Typography.fontSize.sm, lineHeight: 20, marginBottom: Spacing.md, marginTop: Spacing.xs },
  modalFooter: { padding: Spacing.md, borderTopWidth: 1 },
  detailLabel: { fontSize: Typography.fontSize.xs, marginTop: Spacing.sm },
  detailValue: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, fontSize: Typography.fontSize.md, marginTop: Spacing.xs },
  textArea: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, minHeight: 80, marginTop: Spacing.xs, textAlignVertical: 'top' },
  btnConfirm: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.lg },
  btnText: { color: '#fff', fontWeight: Typography.fontWeight.semibold },
  btnReject: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.sm, borderWidth: 1 },
  btnRejectText: { fontWeight: Typography.fontWeight.semibold },
});
