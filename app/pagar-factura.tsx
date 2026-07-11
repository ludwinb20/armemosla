import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import { getFacturaById, getTotalAPagar, FacturaWithDetalles } from '../lib/pagos';
import {
  pagarFacturaConTarjeta,
  pagarFacturaConTarjetaGuardada,
  guardarTarjeta as tokenizarTarjeta,
  listarMetodosPago,
  eliminarMetodoPago,
  marcarMetodoPredeterminado,
  etiquetaMetodoPago,
  parseExpiry,
  validarDatosTarjeta,
  MetodoPagoTarjeta,
} from '../lib/pixelpay';

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
  const [metodos, setMetodos] = useState<MetodoPagoTarjeta[]>([]);
  const [metodoSeleccionado, setMetodoSeleccionado] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [usarNuevaTarjeta, setUsarNuevaTarjeta] = useState(false);
  const [debeGuardarTarjeta, setDebeGuardarTarjeta] = useState(true);

  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const cargar = useCallback(async () => {
    if (!facturaId) return;
    try {
      setLoading(true);
      setErrorCarga(null);
      const [facturaData, metodosData] = await Promise.all([
        getFacturaById(facturaId),
        listarMetodosPago().catch(() => [] as MetodoPagoTarjeta[]),
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
      setUsarNuevaTarjeta(metodosData.length === 0);
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

  const buildDatosTarjeta = () => {
    const parsed = parseExpiry(cardExpiry);
    if (!parsed) return null;
    return {
      card_number: cardNumber,
      card_holder: cardHolder,
      card_cvv: cardCvv,
      expire_month: parsed.month,
      expire_year: parsed.year,
    };
  };

  const handlePagarConGuardada = async () => {
    if (!factura || !metodoSeleccionado) return;
    try {
      setProcesando(true);
      await pagarFacturaConTarjetaGuardada(factura.id, metodoSeleccionado);
      showSuccess('Pago exitoso', 'Tu factura fue pagada correctamente', () => router.replace('/(tabs)/pagos'));
    } catch (e) {
      showError('No se pudo cobrar', e instanceof Error ? e.message : 'Intentá con otra tarjeta');
    } finally {
      setProcesando(false);
    }
  };

  const handlePagarConNuevaTarjeta = async () => {
    if (!factura) return;
    const datos = buildDatosTarjeta();
    if (!datos) {
      showError('Datos incompletos', 'Revisá el vencimiento (MM/AA)');
      return;
    }
    const errorValidacion = validarDatosTarjeta(datos);
    if (errorValidacion) {
      showError('Datos incompletos', errorValidacion);
      return;
    }
    try {
      setProcesando(true);
      await pagarFacturaConTarjeta(factura.id, datos, debeGuardarTarjeta);
      showSuccess('Pago exitoso', 'Tu factura fue pagada correctamente', () => router.replace('/(tabs)/pagos'));
    } catch (e) {
      showError('Pago rechazado', e instanceof Error ? e.message : 'No se pudo procesar el pago');
    } finally {
      setProcesando(false);
    }
  };

  const handleSoloGuardarTarjeta = async () => {
    const datos = buildDatosTarjeta();
    if (!datos) {
      showError('Datos incompletos', 'Revisá el vencimiento (MM/AA)');
      return;
    }
    const errorValidacion = validarDatosTarjeta(datos);
    if (errorValidacion) {
      showError('Datos incompletos', errorValidacion);
      return;
    }
    try {
      setProcesando(true);
      await tokenizarTarjeta(datos);
      setCardNumber('');
      setCardCvv('');
      setCardExpiry('');
      await cargar();
      setUsarNuevaTarjeta(false);
      showSuccess('Tarjeta guardada', 'Podés usarla en tus próximos pagos');
    } catch (e) {
      showError('Error', e instanceof Error ? e.message : 'No se pudo guardar la tarjeta');
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <PlayerLoadingView message="Preparando pago..." />
      </SafeAreaView>
    );
  }

  if (errorCarga || !factura) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>{errorCarga ?? 'Error'}</Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: Colors.primary }]} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const total = getTotalAPagar(factura);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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

      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Pagar factura</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

          <View style={[styles.seguridad, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />
            <Text style={[styles.seguridadText, { color: colors.textSecondary }]}>
              El pago se procesa de forma segura con PixelPay. Los datos de tu tarjeta no se guardan en Armemosla.
            </Text>
          </View>

          {metodos.length > 0 && !usarNuevaTarjeta && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Tarjetas guardadas</Text>
              {metodos.map((m) => (
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
              ))}
              <TouchableOpacity onPress={() => setUsarNuevaTarjeta(true)}>
                <Text style={[styles.linkText, { color: Colors.primary }]}>Usar otra tarjeta</Text>
              </TouchableOpacity>
            </>
          )}

          {(usarNuevaTarjeta || metodos.length === 0) && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {metodos.length > 0 ? 'Nueva tarjeta' : 'Datos de la tarjeta'}
              </Text>
              {metodos.length > 0 && (
                <TouchableOpacity onPress={() => setUsarNuevaTarjeta(false)} style={{ marginBottom: Spacing.sm }}>
                  <Text style={[styles.linkText, { color: Colors.primary }]}>← Volver a tarjetas guardadas</Text>
                </TouchableOpacity>
              )}

              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Número de tarjeta"
                placeholderTextColor={colors.textSecondary}
                value={cardNumber}
                onChangeText={setCardNumber}
                keyboardType="number-pad"
                maxLength={19}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Nombre del titular"
                placeholderTextColor={colors.textSecondary}
                value={cardHolder}
                onChangeText={setCardHolder}
                autoCapitalize="words"
              />
              <View style={styles.rowInputs}>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputHalf,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                  ]}
                  placeholder="MM/AA"
                  placeholderTextColor={colors.textSecondary}
                  value={cardExpiry}
                  onChangeText={setCardExpiry}
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.inputHalf,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                  ]}
                  placeholder="CVV"
                  placeholderTextColor={colors.textSecondary}
                  value={cardCvv}
                  onChangeText={setCardCvv}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Guardar tarjeta para próximos pagos</Text>
                <Switch
                  value={debeGuardarTarjeta}
                  onValueChange={setDebeGuardarTarjeta}
                  trackColor={{ false: colors.border, true: Colors.primary }}
                />
              </View>

              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={handleSoloGuardarTarjeta}
                disabled={procesando}
              >
                <Ionicons name="bookmark-outline" size={18} color={Colors.primary} />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Solo guardar tarjeta</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.borderLight, backgroundColor: colors.background }]}>
          {!usarNuevaTarjeta && metodoSeleccionado ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
              onPress={handlePagarConGuardada}
              disabled={procesando}
            >
              {procesando ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.primaryBtnText}>Pagar {formatCurrency(total)}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
              onPress={handlePagarConNuevaTarjeta}
              disabled={procesando}
            >
              {procesando ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.primaryBtnText}>Pagar {formatCurrency(total)}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {procesando && (
        <View style={styles.procesandoOverlay}>
          <ActivityIndicator size="large" color={Colors.textInverse} />
          <Text style={{ color: Colors.textInverse, marginTop: Spacing.sm }}>Procesando pago...</Text>
        </View>
      )}
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
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semibold },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  resumen: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
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
  linkText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium, marginBottom: Spacing.md },
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
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.fontSize.md,
    marginBottom: Spacing.sm,
  },
  rowInputs: { flexDirection: 'row', gap: Spacing.sm },
  inputHalf: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  switchLabel: { flex: 1, fontSize: Typography.fontSize.sm, marginRight: Spacing.sm },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  secondaryBtnText: { fontWeight: Typography.fontWeight.medium },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  primaryBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.textInverse, fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.md },
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
  procesandoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
