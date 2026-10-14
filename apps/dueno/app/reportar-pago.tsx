import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Image,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGlassTheme } from '@/hooks/useGlassTheme';
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
import { Screen, Text, Button, Input, Card } from '@/components/ui';

export default function ReportarPagoScreen() {
  const { facturaId } = useLocalSearchParams<{ facturaId: string }>();
  const router = useRouter();
  const { colors } = useGlassTheme();
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
      <Screen>
        <PlayerLoadingView message="Cargando..." />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-md py-sm border-b border-border-subtle">
        <Pressable onPress={() => router.back()} className="p-xs">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h4">Reportar transferencia</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerClassName="p-md pb-xxl" keyboardShouldPersistTaps="handled">
        {factura && (
          <Card className="mb-sm">
            <Text variant="label" className="mb-sm">Resumen</Text>
            <View className="flex-row justify-between mb-xs">
              <Text variant="caption">Total factura</Text>
              <Text variant="caption" className="font-semibold">
                {formatCurrency(getTotalAPagar(factura))}
              </Text>
            </View>
            {montoPendiente > 0 && montoPendiente < getTotalAPagar(factura) && (
              <View className="flex-row justify-between mb-xs">
                <Text variant="caption">Pendiente</Text>
                <Text variant="caption" className="font-semibold" style={{ color: colors.warning }}>
                  {formatCurrency(montoPendiente)}
                </Text>
              </View>
            )}
            <Text variant="caption" className="mt-xs">
              Podés pagar el total o hacer un pago parcial. La factura queda en revisión hasta cubrir el monto.
            </Text>
          </Card>
        )}

        <Text variant="label" className="mt-md mb-sm">Cuenta destino</Text>
        {cuentas.map((cuenta) => (
          <Pressable key={cuenta.id} onPress={() => setCuentaId(cuenta.id)} className="mb-sm">
            <Card
              className="flex-row items-center gap-sm"
              style={{
                borderColor: cuentaId === cuenta.id ? colors.primary : colors.borderSubtle,
                borderWidth: cuentaId === cuenta.id ? 2 : 1,
              }}
            >
              {cuenta.logo_url ? (
                <Image source={{ uri: cuenta.logo_url }} className="w-12 h-8" resizeMode="contain" />
              ) : (
                <Ionicons name="business-outline" size={32} color={colors.primary} />
              )}
              <View className="flex-1">
                <Text variant="body" className="font-semibold">{cuenta.banco_nombre}</Text>
                <Text variant="caption">{cuenta.numero_cuenta}</Text>
                <Text variant="caption">{cuenta.titular}</Text>
              </View>
              {cuentaId === cuenta.id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </Card>
          </Pressable>
        ))}

        <Text variant="label" className="mt-md mb-sm">Datos del pago</Text>
        <Card>
          <Input
            label="Monto transferido (L)"
            value={monto}
            onChangeText={setMonto}
            keyboardType="decimal-pad"
            placeholder="0.00"
            containerClassName="mb-sm"
          />

          <Input
            label="Número de transacción / referencia"
            value={numeroTransaccion}
            onChangeText={setNumeroTransaccion}
            placeholder="Ej. 123456789"
            autoCapitalize="characters"
            containerClassName="mb-sm"
          />

          <View className="flex-row items-center mt-md gap-sm">
            <View className="flex-1">
              <Text variant="body" className="font-medium">Factura con RTN</Text>
              <Text variant="caption" className="mt-xs">
                {tieneDatosFiscales
                  ? 'Se emitirá factura fiscal al confirmar el pago'
                  : 'Configurá tus datos fiscales en Perfil para habilitar esta opción'}
              </Text>
            </View>
            <Switch
              value={solicitaRtn}
              onValueChange={setSolicitaRtn}
              disabled={!tieneDatosFiscales}
              trackColor={{ false: colors.borderSubtle, true: colors.primary }}
            />
          </View>

          {!tieneDatosFiscales && (
            <Pressable onPress={() => router.push('/(tabs)/perfil')} className="mt-sm">
              <Text variant="caption" style={{ color: colors.primary }}>
                Ir a Perfil → Datos de facturación
              </Text>
            </Pressable>
          )}
        </Card>

        <Button onPress={handleSubmit} loading={submitting} className="mt-lg">
          Enviar para revisión
        </Button>
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
    </Screen>
  );
}
