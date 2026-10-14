import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGlassTheme } from '@/hooks/useGlassTheme';
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
import { Screen, Text, Button, Input, Card, Divider } from '@/components/ui';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function PagarFacturaScreen() {
  const { facturaId } = useLocalSearchParams<{ facturaId: string }>();
  const router = useRouter();
  const { colors } = useGlassTheme();
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
      <Screen>
        <PlayerLoadingView message="Preparando pago..." />
      </Screen>
    );
  }

  if (errorCarga || !factura) {
    return (
      <Screen>
        <View className="flex-1 justify-center items-center p-lg gap-md">
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text variant="body" className="text-center">{errorCarga ?? 'Error'}</Text>
          <Button onPress={() => router.back()}>Volver</Button>
        </View>
      </Screen>
    );
  }

  const total = getTotalAPagar(factura);

  return (
    <Screen>
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

      <View className="flex-row items-center justify-between px-md py-sm border-b border-border-subtle">
        <Pressable onPress={() => router.back()} className="p-xs">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h4">Pagar factura</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="p-md pb-xl" keyboardShouldPersistTaps="handled">
          <Card className="mb-md">
            <Text variant="caption">
              {MESES[factura.mes - 1]} {factura.año}
            </Text>
            <Text variant="h2" className="mt-xs">{formatCurrency(total)}</Text>
            {(factura.monto_mora ?? 0) > 0 && (
              <Text variant="caption" style={{ color: colors.error }} className="mt-xs">
                Incluye mora: {formatCurrency(factura.monto_mora ?? 0)}
              </Text>
            )}
          </Card>

          <Card className="mb-lg flex-row gap-sm items-start">
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            <Text variant="caption" className="flex-1">
              El pago se procesa de forma segura con PixelPay. Los datos de tu tarjeta no se guardan en Armemosla.
            </Text>
          </Card>

          {metodos.length > 0 && !usarNuevaTarjeta && (
            <>
              <Text variant="label" className="mb-sm">Tarjetas guardadas</Text>
              {metodos.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setMetodoSeleccionado(m.id)}
                  className="mb-sm"
                >
                  <Card
                    className="flex-row items-center gap-sm"
                    style={{
                      borderColor: metodoSeleccionado === m.id ? colors.primary : colors.borderSubtle,
                      borderWidth: metodoSeleccionado === m.id ? 2 : 1,
                    }}
                  >
                    <Ionicons
                      name={metodoSeleccionado === m.id ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={metodoSeleccionado === m.id ? colors.primary : colors.textSecondary}
                    />
                    <Ionicons name="card-outline" size={24} color={colors.text} />
                    <View className="flex-1">
                      <Text variant="body">{etiquetaMetodoPago(m)}</Text>
                      {m.es_predeterminado && (
                        <Text variant="caption" style={{ color: colors.primary }}>Predeterminada</Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => void marcarMetodoPredeterminado(m.id).then(cargar)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        eliminarMetodoPago(m.id)
                          .then(cargar)
                          .catch((err) => showError('Error', err.message))
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </Pressable>
                  </Card>
                </Pressable>
              ))}
              <Pressable onPress={() => setUsarNuevaTarjeta(true)} className="mb-md">
                <Text variant="caption" style={{ color: colors.primary }}>Usar otra tarjeta</Text>
              </Pressable>
            </>
          )}

          {(usarNuevaTarjeta || metodos.length === 0) && (
            <>
              <Text variant="label" className="mb-sm">
                {metodos.length > 0 ? 'Nueva tarjeta' : 'Datos de la tarjeta'}
              </Text>
              {metodos.length > 0 && (
                <Pressable onPress={() => setUsarNuevaTarjeta(false)} className="mb-sm">
                  <Text variant="caption" style={{ color: colors.primary }}>← Volver a tarjetas guardadas</Text>
                </Pressable>
              )}

              <Input
                placeholder="Número de tarjeta"
                value={cardNumber}
                onChangeText={setCardNumber}
                keyboardType="number-pad"
                maxLength={19}
                containerClassName="mb-sm"
              />
              <Input
                placeholder="Nombre del titular"
                value={cardHolder}
                onChangeText={setCardHolder}
                autoCapitalize="words"
                containerClassName="mb-sm"
              />
              <View className="flex-row gap-sm mb-sm">
                <Input
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChangeText={setCardExpiry}
                  keyboardType="number-pad"
                  maxLength={5}
                  containerClassName="flex-1"
                />
                <Input
                  placeholder="CVV"
                  value={cardCvv}
                  onChangeText={setCardCvv}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  containerClassName="flex-1"
                />
              </View>

              <View className="flex-row items-center justify-between my-md">
                <Text variant="caption" className="flex-1 mr-sm">Guardar tarjeta para próximos pagos</Text>
                <Switch
                  value={debeGuardarTarjeta}
                  onValueChange={setDebeGuardarTarjeta}
                  trackColor={{ false: colors.borderSubtle, true: colors.primary }}
                />
              </View>

              <Button variant="outline" onPress={handleSoloGuardarTarjeta} disabled={procesando} className="mt-xs">
                Solo guardar tarjeta
              </Button>
            </>
          )}
        </ScrollView>

        <View className="p-md border-t border-border-subtle">
          {!usarNuevaTarjeta && metodoSeleccionado ? (
            <Button onPress={handlePagarConGuardada} loading={procesando}>
              Pagar {formatCurrency(total)}
            </Button>
          ) : (
            <Button onPress={handlePagarConNuevaTarjeta} loading={procesando}>
              Pagar {formatCurrency(total)}
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>

      {procesando && (
        <View className="absolute inset-0 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <PlayerLoadingView message="Procesando pago..." />
        </View>
      )}
    </Screen>
  );
}
