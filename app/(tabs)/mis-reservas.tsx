import React, { useState, useEffect, useCallback } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { obtenerReservasJugador, cancelarReserva, ReservaWithRelations } from '../../lib/reservas';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';

type FiltroEstado = 'todas' | 'pendiente' | 'completada' | 'cancelada';

export default function MisReservasScreen() {
  const colors = useThemeColors();
  const [reservas, setReservas] = useState<ReservaWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      loadReservas();
    }, [])
  );

  const loadReservas = async () => {
    try {
      setLoading(true);
      const data = await obtenerReservasJugador();
      setReservas(data);
    } catch (error: any) {
      console.error('Error al cargar reservas:', error);
      showError('Error', 'No se pudieron cargar las reservas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReservas();
  };

  const handleCancelarReserva = (reservaId: string) => {
    showError(
      'Cancelar Reserva',
      '¿Estás seguro de que deseas cancelar esta reserva?',
      () => {
        cancelarReservaAsync(reservaId);
      },
      () => {},
      'Cancelar',
      'Confirmar'
    );
  };

  const cancelarReservaAsync = async (reservaId: string) => {
    try {
      await cancelarReserva(reservaId);
      showSuccess('Éxito', 'Reserva cancelada correctamente');
      loadReservas();
    } catch (error: any) {
      console.error('Error al cancelar reserva:', error);
      showError('Error', error.message || 'No se pudo cancelar la reserva');
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'completada':
        return Colors.success;
      case 'cancelada':
        return Colors.error;
      case 'pendiente':
      default:
        return Colors.warning;
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'completada':
        return 'Completada';
      case 'cancelada':
        return 'Cancelada';
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

  const reservasFiltradas = reservas.filter((r) => {
    if (filtroEstado === 'todas') return true;
    return r.estado === filtroEstado;
  });

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando reservas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.title, { color: colors.text }]}>Mis Reservas</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtrosContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosContent}>
          {(['todas', 'pendiente', 'completada', 'cancelada'] as FiltroEstado[]).map((estado) => (
            <TouchableOpacity
              key={estado}
              style={[
                styles.filtroChip,
                {
                  backgroundColor: filtroEstado === estado ? Colors.primary : colors.surface,
                  borderColor: filtroEstado === estado ? Colors.primary : colors.border,
                },
              ]}
              onPress={() => setFiltroEstado(estado)}
            >
              <Text
                style={[
                  styles.filtroChipText,
                  { color: filtroEstado === estado ? Colors.textInverse : colors.text },
                ]}
              >
                {estado === 'todas' ? 'Todas' : estado.charAt(0).toUpperCase() + estado.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista de Reservas */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {reservasFiltradas.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filtroEstado === 'todas' ? 'No hay reservas' : `No hay reservas ${filtroEstado === 'pendiente' ? 'pendientes' : filtroEstado + 's'}`}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {filtroEstado === 'todas' 
                ? 'Aún no has realizado ninguna reserva'
                : `No tienes reservas con estado "${filtroEstado}"`
              }
            </Text>
          </View>
        ) : (
          reservasFiltradas.map((reserva) => {
            const { fecha, hora } = formatFechaHora(reserva.fecha_hora);
            const estadoColor = getEstadoColor(reserva.estado);
            const esPendiente = reserva.estado === 'pendiente';
            const precio = (reserva.cancha as any)?.precio_por_hora || 0;

            return (
              <View
                key={reserva.id}
                style={[
                  styles.reservaCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: esPendiente ? Colors.primary + '40' : colors.border,
                    borderLeftWidth: esPendiente ? 4 : 1,
                  },
                  esPendiente && Shadows.md,
                ]}
              >
                {/* Badge de Pendiente */}
                {esPendiente && (
                  <View style={[styles.pendienteBadge, { backgroundColor: Colors.primary + '20' }]}>
                    <Ionicons name="time-outline" size={16} color={Colors.primary} />
                    <Text style={[styles.pendienteBadgeText, { color: Colors.primary }]}>Pendiente</Text>
                  </View>
                )}

                <View style={styles.reservaHeader}>
                  <View style={styles.reservaInfo}>
                    <Text style={[styles.reservaNombre, { color: colors.text }]}>
                      {(reserva.cancha as any)?.nombre || 'Cancha'}
                    </Text>
                    <Text style={[styles.reservaComplejo, { color: colors.textSecondary }]}>
                      {(reserva.cancha as any)?.complejo?.nombre || 'Complejo'}
                    </Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: estadoColor + '20' }]}>
                    <Text style={[styles.estadoBadgeText, { color: estadoColor }]}>
                      {getEstadoTexto(reserva.estado)}
                    </Text>
                  </View>
                </View>

                <View style={styles.reservaBody}>
                  <View style={styles.reservaRow}>
                    <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.reservaLabel, { color: colors.textSecondary }]}>Fecha:</Text>
                    <Text style={[styles.reservaValue, { color: colors.text }]}>{fecha}</Text>
                  </View>
                  <View style={styles.reservaRow}>
                    <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.reservaLabel, { color: colors.textSecondary }]}>Hora:</Text>
                    <Text style={[styles.reservaValue, { color: colors.text }]}>{hora}</Text>
                  </View>
                  <View style={styles.reservaRow}>
                    <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.reservaLabel, { color: colors.textSecondary }]}>Precio:</Text>
                    <Text style={[styles.reservaValue, { color: Colors.success }]}>{formatCurrency(precio)}</Text>
                  </View>
                </View>

                {esPendiente && (
                  <View style={styles.reservaActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton, { borderColor: Colors.error }]}
                      onPress={() => handleCancelarReserva(reserva.id)}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                      <Text style={[styles.actionButtonText, { color: Colors.error }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
  },
  header: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  filtrosContainer: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filtrosContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  filtroChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  filtroChipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
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
  reservaCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  pendienteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  pendienteBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    marginLeft: 4,
  },
  reservaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  reservaInfo: {
    flex: 1,
  },
  reservaNombre: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 2,
  },
  reservaComplejo: {
    fontSize: Typography.fontSize.sm,
  },
  estadoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  estadoBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  reservaBody: {
    gap: Spacing.xs,
  },
  reservaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  reservaLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  reservaValue: {
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },
  reservaActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  cancelButton: {
    flex: 1,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
});
