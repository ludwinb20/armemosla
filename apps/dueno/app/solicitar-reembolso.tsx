import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import { supabase } from '../lib/supabase';
import {
  solicitarReembolso,
  notifyAdminsSolicitudReembolso,
  getSolicitudPendientePorTransferencia,
} from '../lib/solicitudesReembolso';
import type { Transferencia } from '../lib/transferencias';
import { Screen, Text, Button, Input, Card } from '@/components/ui';

export default function SolicitarReembolsoScreen() {
  const { transferenciaId } = useLocalSearchParams<{ transferenciaId: string }>();
  const router = useRouter();
  const { colors } = useGlassTheme();
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } =
    useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transferencia, setTransferencia] = useState<Transferencia | null>(null);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [transferenciaId])
  );

  const loadData = async () => {
    if (!transferenciaId) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('Error', 'Sesión no válida');
        router.back();
        return;
      }

      const pendiente = await getSolicitudPendientePorTransferencia(transferenciaId);
      if (pendiente) {
        showError('Solicitud existente', 'Ya hay una solicitud de reembolso pendiente para esta transferencia.');
        router.back();
        return;
      }

      const { data, error } = await supabase
        .from('transferencias')
        .select('*')
        .eq('id', transferenciaId)
        .eq('admin_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data || data.estado !== 'confirmada') {
        showError('No disponible', 'Solo podés solicitar reembolso de transferencias confirmadas.');
        router.back();
        return;
      }

      setTransferencia(data as Transferencia);
      setMonto(String(data.monto));
    } catch (error: unknown) {
      console.error(error);
      showError('Error', 'No se pudo cargar la transferencia');
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
    if (!transferenciaId || !transferencia) return;

    const montoNum = parseFloat(monto.replace(',', '.'));
    const maxMonto = Number(transferencia.monto);

    if (!Number.isFinite(montoNum) || montoNum <= 0 || montoNum > maxMonto) {
      showError('Monto inválido', `Ingresá un monto entre 0.01 y ${formatCurrency(maxMonto)}`);
      return;
    }
    if (!motivo.trim()) {
      showError('Motivo requerido', 'Explicá por qué solicitás el reembolso');
      return;
    }

    try {
      setSubmitting(true);
      const solicitudId = await solicitarReembolso(transferenciaId, montoNum, motivo.trim());
      void notifyAdminsSolicitudReembolso(solicitudId);
      showSuccess(
        'Solicitud enviada',
        'Armemosla revisará tu solicitud. Si se aprueba, te devolveremos el monto por transferencia bancaria a la cuenta desde la que pagaste.',
        () => router.back()
      );
    } catch (error: unknown) {
      showError('Error', error instanceof Error ? error.message : 'No se pudo enviar la solicitud');
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

  const maxMonto = transferencia ? Number(transferencia.monto) : 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-md py-sm border-b border-border-subtle">
        <Pressable onPress={() => router.back()} className="w-10 h-10 justify-center items-center">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h4">Solicitar reembolso</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerClassName="p-lg pb-xxl" keyboardShouldPersistTaps="handled">
        <Card
          className="mb-lg flex-row gap-sm items-start"
          style={{ backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }}
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.warning} />
          <Text variant="caption" className="flex-1">
            Si se aprueba, Armemosla te devolverá el dinero por transferencia bancaria. No se descuenta automáticamente de facturas futuras.
          </Text>
        </Card>

        {transferencia && (
          <Card className="mb-lg">
            <Text variant="caption">Referencia bancaria</Text>
            <Text variant="body" className="font-medium mt-0.5">{transferencia.numero_transaccion}</Text>
            <Text variant="caption" className="mt-sm">Monto transferido</Text>
            <Text variant="body" className="font-medium mt-0.5">{formatCurrency(maxMonto)}</Text>
          </Card>
        )}

        <Input
          label="Monto a reembolsar"
          value={monto}
          onChangeText={setMonto}
          keyboardType="decimal-pad"
          placeholder={`Máx. ${formatCurrency(maxMonto)}`}
          containerClassName="mb-md"
        />

        <Input
          label="Motivo"
          value={motivo}
          onChangeText={setMotivo}
          placeholder="Ej. pagué de más, transferencia duplicada, error en el monto..."
          multiline
          numberOfLines={4}
          className="min-h-[100px]"
          containerClassName="mb-lg"
        />

        <Button onPress={() => void handleSubmit()} loading={submitting}>
          Enviar solicitud
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
