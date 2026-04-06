import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { obtenerReservasJugador, ReservaWithRelations } from '../../../lib/reservas';
import { obtenerPartidosJugador } from '../../../lib/partidos';
import { useCustomAlert } from '../../../hooks/useCustomAlert';
import CustomAlert from '../../../components/CustomAlert';
import { useThemeColors } from '../../../hooks/useThemeColors';

export default function RivalDesdeReservaScreen() {
  const colors = useThemeColors();
  const [reservas, setReservas] = useState<ReservaWithRelations[]>([]);
  const [reservaIdsConPartidoActivo, setReservaIdsConPartidoActivo] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { alertVisible, alertOptions, showError, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  const load = async () => {
    try {
      setLoading(true);
      const [todasReservas, misPartidos] = await Promise.all([
        obtenerReservasJugador(),
        obtenerPartidosJugador(),
      ]);
      const pendientes = todasReservas.filter((r) => r.estado === 'pendiente');
      setReservas(pendientes);

      const activos = new Set<string>();
      for (const p of misPartidos) {
        if (p.estado === 'abierto' || p.estado === 'en_negociacion') {
          activos.add(p.reserva_id);
        }
      }
      setReservaIdsConPartidoActivo(activos);
    } catch (e: any) {
      console.error(e);
      showError('Error', 'No se pudieron cargar tus reservas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const formatFechaHora = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    return {
      fecha: fecha.toLocaleDateString('es-HN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      hora: fecha.toLocaleTimeString('es-HN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const irBuscarRival = (reservaId: string) => {
    router.push({
      pathname: '/(tabs)/armemosla/buscar-rival',
      params: { openCrear: '1', reservaId },
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando reservas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/armemosla'))}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityLabel="Volver a Armemosla"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={[styles.title, { color: colors.text }]}>Buscar rival</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Elige una reserva pendiente
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {reservas.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={56} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No tienes reservas pendientes</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Aparta una cancha primero para poder publicar un partido y buscar rival.
            </Text>
          </View>
        ) : (
          reservas.map((reserva) => {
            const { fecha, hora } = formatFechaHora(reserva.fecha_hora);
            const yaTienePartido = reservaIdsConPartidoActivo.has(reserva.id);
            const cancha = reserva.cancha as any;
            const complejo = cancha?.complejo;

            return (
              <View
                key={reserva.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  Shadows.sm,
                ]}
              >
                <View style={[styles.pendienteBadge, { backgroundColor: Colors.primary + '20' }]}>
                  <Ionicons name="time-outline" size={14} color={Colors.primary} />
                  <Text style={[styles.pendienteBadgeText, { color: Colors.primary }]}>Pendiente</Text>
                </View>

                <Text style={[styles.canchaNombre, { color: colors.text }]}>
                  {cancha?.nombre || 'Cancha'}
                </Text>
                <Text style={[styles.complejoNombre, { color: colors.textSecondary }]}>
                  {complejo?.nombre || 'Complejo'}
                </Text>

                <View style={styles.row}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.meta, { color: colors.text }]}>{fecha}</Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.meta, { color: colors.text }]}>{hora}</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.cta,
                    { backgroundColor: yaTienePartido ? colors.borderLight : Colors.primary },
                  ]}
                  onPress={() => !yaTienePartido && irBuscarRival(reserva.id)}
                  disabled={yaTienePartido}
                >
                  <Ionicons
                    name="people-outline"
                    size={20}
                    color={yaTienePartido ? colors.textSecondary : Colors.textInverse}
                  />
                  <Text
                    style={[
                      styles.ctaText,
                      { color: yaTienePartido ? colors.textSecondary : Colors.textInverse },
                    ]}
                  >
                    {yaTienePartido ? 'Ya tienes partido abierto' : 'Buscar rival'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, fontSize: Typography.fontSize.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  headerTitles: { flex: 1 },
  title: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold },
  subtitle: { fontSize: Typography.fontSize.sm, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginTop: Spacing.md },
  emptyText: { fontSize: Typography.fontSize.sm, textAlign: 'center', marginTop: Spacing.sm },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  pendienteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  pendienteBadgeText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },
  canchaNombre: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  complejoNombre: { fontSize: Typography.fontSize.sm, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 4 },
  meta: { fontSize: Typography.fontSize.sm },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  ctaText: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semibold },
});
