import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
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
import { supabase } from '../lib/supabase';
import {
  solicitarReembolso,
  notifyAdminsSolicitudReembolso,
  getSolicitudPendientePorTransferencia,
} from '../lib/solicitudesReembolso';
import type { Transferencia } from '../lib/transferencias';

export default function SolicitarReembolsoScreen() {
  const { transferenciaId } = useLocalSearchParams<{ transferenciaId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <PlayerLoadingView message="Cargando..." />
      </SafeAreaView>
    );
  }

  const maxMonto = transferencia ? Number(transferencia.monto) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Solicitar reembolso</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoBox, { backgroundColor: Colors.warning + '15', borderColor: Colors.warning + '40' }]}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.warning} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            Si se aprueba, Armemosla te devolverá el dinero por transferencia bancaria. No se descuenta automáticamente de facturas futuras.
          </Text>
        </View>

        {transferencia && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Referencia bancaria</Text>
            <Text style={[styles.value, { color: colors.text }]}>{transferencia.numero_transaccion}</Text>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.sm }]}>Monto transferido</Text>
            <Text style={[styles.value, { color: colors.text }]}>{formatCurrency(maxMonto)}</Text>
          </View>
        )}

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Monto a reembolsar</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={monto}
          onChangeText={setMonto}
          keyboardType="decimal-pad"
          placeholder={`Máx. ${formatCurrency(maxMonto)}`}
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Motivo</Text>
        <TextInput
          style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={motivo}
          onChangeText={setMotivo}
          placeholder="Ej. pagué de más, transferencia duplicada, error en el monto..."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: Colors.primary }, submitting && styles.submitDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color={Colors.textInverse} />
              <Text style={styles.submitText}>Enviar solicitud</Text>
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
        onCancel={handleCancel}
        onClose={hideAlert}
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
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semibold },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  infoBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  infoText: { flex: 1, fontSize: Typography.fontSize.sm, lineHeight: 20 },
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  label: { fontSize: Typography.fontSize.sm },
  value: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.medium, marginTop: 2 },
  fieldLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.md,
    marginBottom: Spacing.md,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.md,
    minHeight: 100,
    marginBottom: Spacing.lg,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: Colors.textInverse, fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
});
