import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import {
  getFacturaById,
  getTotalAPagar,
  FacturaWithDetalles,
} from '../lib/pagos';
import {
  listarCuentasBancarias,
  reportarTransferencia,
  getMontoPendiente,
  notifyAdminsPagoPendiente,
  CuentaBancaria,
} from '../lib/transferencias';
import { datosFiscalesCompletos } from '../lib/datosFiscales';

export default function ReportarPagoScreen() {
  const { facturaId } = useLocalSearchParams<{ facturaId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } =
    useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [factura, setFactura] = useState<FacturaWithDetalles | null>(null);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [numeroTransaccion, setNumeroTransaccion] = useState('');
  const [solicitaRtn, setSolicitaRtn] = useState(false);
  const [tieneDatosFiscales, setTieneDatosFiscales] = useState(false);
  const [montoPendiente, setMontoPendiente] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [facturaId])
  );

  const loadData = async () => {
    if (!facturaId) return;
    try {
      setLoading(true);
      const [facturaData, cuentasData, pendiente, fiscalOk] = await Promise.all([
        getFacturaById(facturaId),
        listarCuentasBancarias(),
        getMontoPendiente(facturaId),
        datosFiscalesCompletos(),
      ]);
      setFactura(facturaData);
      setCuentas(cuentasData);
      setMontoPendiente(pendiente);
      setTieneDatosFiscales(fiscalOk);
      if (cuentasData.length > 0) {
        setCuentaId(cuentasData[0].id);
      }
      const sugerido = pendiente > 0 ? pendiente : facturaData ? getTotalAPagar(facturaData) : 0;
      setMonto(sugerido.toFixed(2));
    } catch (error: unknown) {
      console.error(error);
      showError('Error', 'No se pudo cargar la información de pago');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
    }).format(amount);

  const handleSubmit = async () => {
    if (!facturaId || !cuentaId) {
      showError('Error', 'Seleccioná una cuenta bancaria');
      return;
    }
    const montoNum = parseFloat(monto.replace(',', '.'));
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      showError('Error', 'Ingresá un monto válido');
      return;
    }
    if (!numeroTransaccion.trim()) {
      showError('Error', 'Ingresá el número de transacción');
      return;
    }
    if (solicitaRtn && !tieneDatosFiscales) {
      showError('Datos fiscales', 'Configurá tu RTN en Perfil antes de solicitar factura fiscal');
      return;
    }

    try {
      setSubmitting(true);
      const transferenciaId = await reportarTransferencia({
        facturaId,
        cuentaId,
        numeroTransaccion: numeroTransaccion.trim(),
        monto: montoNum,
        solicitaRtn,
      });
      await notifyAdminsPagoPendiente(transferenciaId);
      showSuccess(
        'Transferencia reportada',
        'Tu pago quedó en revisión. Te avisaremos cuando sea confirmado.'
      );
      setTimeout(() => router.back(), 1500);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'No se pudo reportar la transferencia';
      showError('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <PlayerLoadingView message="Cargando..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Reportar transferencia</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {factura && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Resumen</Text>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Total factura</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {formatCurrency(getTotalAPagar(factura))}
              </Text>
            </View>
            {montoPendiente > 0 && montoPendiente < getTotalAPagar(factura) && (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Pendiente</Text>
                <Text style={[styles.value, { color: Colors.warning }]}>
                  {formatCurrency(montoPendiente)}
                </Text>
              </View>
            )}
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Podés pagar el total o hacer un pago parcial. La factura queda en revisión hasta cubrir el monto.
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Cuenta destino</Text>
        {cuentas.map((cuenta) => (
          <TouchableOpacity
            key={cuenta.id}
            style={[
              styles.cuentaCard,
              {
                backgroundColor: colors.surface,
                borderColor: cuentaId === cuenta.id ? Colors.primary : colors.border,
              },
            ]}
            onPress={() => setCuentaId(cuenta.id)}
          >
            {cuenta.logo_url ? (
              <Image source={{ uri: cuenta.logo_url }} style={styles.bankLogo} resizeMode="contain" />
            ) : (
              <Ionicons name="business-outline" size={32} color={Colors.primary} />
            )}
            <View style={styles.cuentaInfo}>
              <Text style={[styles.bankName, { color: colors.text }]}>{cuenta.banco_nombre}</Text>
              <Text style={[styles.cuentaNum, { color: colors.textSecondary }]}>{cuenta.numero_cuenta}</Text>
              <Text style={[styles.cuentaTitular, { color: colors.textSecondary }]}>{cuenta.titular}</Text>
            </View>
            {cuentaId === cuenta.id && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Datos del pago</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Monto transferido (L)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            value={monto}
            onChangeText={setMonto}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.inputLabel, { color: colors.text }]}>Número de transacción / referencia</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            value={numeroTransaccion}
            onChangeText={setNumeroTransaccion}
            placeholder="Ej. 123456789"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Factura con RTN</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {tieneDatosFiscales
                  ? 'Se emitirá factura fiscal al confirmar el pago'
                  : 'Configurá tus datos fiscales en Perfil para habilitar esta opción'}
              </Text>
            </View>
            <Switch
              value={solicitaRtn}
              onValueChange={setSolicitaRtn}
              disabled={!tieneDatosFiscales}
              trackColor={{ false: colors.border, true: Colors.primary }}
            />
          </View>

          {!tieneDatosFiscales && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/perfil')}>
              <Text style={[styles.link, { color: Colors.primary }]}>Ir a Perfil → Datos de facturación</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: Colors.primary, opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color={Colors.textInverse} />
              <Text style={styles.submitText}>Enviar para revisión</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

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
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  cardTitle: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  label: { fontSize: Typography.fontSize.sm },
  value: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
  hint: { fontSize: Typography.fontSize.xs, lineHeight: 18, marginTop: Spacing.xs },
  cuentaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  bankLogo: { width: 48, height: 32 },
  cuentaInfo: { flex: 1 },
  bankName: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
  cuentaNum: { fontSize: Typography.fontSize.sm, marginTop: 2 },
  cuentaTitular: { fontSize: Typography.fontSize.xs, marginTop: 2 },
  inputLabel: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: Typography.fontSize.md,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.sm },
  switchLabel: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium },
  link: { fontSize: Typography.fontSize.sm, marginTop: Spacing.sm, fontWeight: Typography.fontWeight.medium },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  submitText: { color: Colors.textInverse, fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.md },
});
