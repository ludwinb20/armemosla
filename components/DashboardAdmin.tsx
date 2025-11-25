import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../constants/theme';

const { width } = Dimensions.get('window');
const cardWidth = (width - Spacing.md * 2 - Spacing.sm) / 2;

// Datos ficticios
const mockData = {
  stats: {
    totalComplejos: 2,
    totalCanchas: 8,
    reservasHoy: 12,
    reservasPendientes: 5,
    ingresosMes: 45000,
  },
  complejos: [
    {
      id: 1,
      nombre: 'Complejo Deportivo Central',
      direccion: 'Av. Principal 123',
      canchas: 5,
      estado: 'Activo',
    },
    {
      id: 2,
      nombre: 'Canchas del Norte',
      direccion: 'Calle Norte 456',
      canchas: 3,
      estado: 'Activo',
    },
  ],
  canchas: [
    {
      id: 1,
      nombre: 'Cancha 1 - Fútbol 11',
      complejo: 'Complejo Deportivo Central',
      tipo: 'Fútbol 11',
      estado: 'Disponible',
      reservasHoy: 4,
    },
    {
      id: 2,
      nombre: 'Cancha 2 - Fútbol 7',
      complejo: 'Complejo Deportivo Central',
      tipo: 'Fútbol 7',
      estado: 'Ocupada',
      reservasHoy: 3,
    },
    {
      id: 3,
      nombre: 'Cancha 3 - Fútbol 5',
      complejo: 'Complejo Deportivo Central',
      tipo: 'Fútbol 5',
      estado: 'Disponible',
      reservasHoy: 2,
    },
    {
      id: 4,
      nombre: 'Cancha 4 - Fútbol 11',
      complejo: 'Complejo Deportivo Central',
      tipo: 'Fútbol 11',
      estado: 'Mantenimiento',
      reservasHoy: 0,
    },
    {
      id: 5,
      nombre: 'Cancha 5 - Fútbol 7',
      complejo: 'Complejo Deportivo Central',
      tipo: 'Fútbol 7',
      estado: 'Disponible',
      reservasHoy: 1,
    },
    {
      id: 6,
      nombre: 'Cancha A - Fútbol 5',
      complejo: 'Canchas del Norte',
      tipo: 'Fútbol 5',
      estado: 'Disponible',
      reservasHoy: 2,
    },
    {
      id: 7,
      nombre: 'Cancha B - Fútbol 7',
      complejo: 'Canchas del Norte',
      tipo: 'Fútbol 7',
      estado: 'Ocupada',
      reservasHoy: 3,
    },
    {
      id: 8,
      nombre: 'Cancha C - Fútbol 11',
      complejo: 'Canchas del Norte',
      tipo: 'Fútbol 11',
      estado: 'Disponible',
      reservasHoy: 1,
    },
  ],
  reservas: [
    {
      id: 1,
      cancha: 'Cancha 1 - Fútbol 11',
      complejo: 'Complejo Deportivo Central',
      cliente: 'Juan Pérez',
      fecha: '2024-01-15',
      hora: '18:00',
      estado: 'Confirmada',
      monto: 15000,
    },
    {
      id: 2,
      cancha: 'Cancha 2 - Fútbol 7',
      complejo: 'Complejo Deportivo Central',
      cliente: 'María González',
      fecha: '2024-01-15',
      hora: '19:00',
      estado: 'Pendiente',
      monto: 12000,
    },
    {
      id: 3,
      cancha: 'Cancha B - Fútbol 7',
      complejo: 'Canchas del Norte',
      cliente: 'Carlos Rodríguez',
      fecha: '2024-01-15',
      hora: '20:00',
      estado: 'Confirmada',
      monto: 12000,
    },
    {
      id: 4,
      cancha: 'Cancha 3 - Fútbol 5',
      complejo: 'Complejo Deportivo Central',
      cliente: 'Ana Martínez',
      fecha: '2024-01-16',
      hora: '17:00',
      estado: 'Confirmada',
      monto: 10000,
    },
    {
      id: 5,
      cancha: 'Cancha A - Fútbol 5',
      complejo: 'Canchas del Norte',
      cliente: 'Luis Fernández',
      fecha: '2024-01-16',
      hora: '18:00',
      estado: 'Pendiente',
      monto: 10000,
    },
  ],
};

export default function DashboardAdmin() {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Activo':
      case 'Disponible':
      case 'Confirmada':
        return Colors.success;
      case 'Ocupada':
        return Colors.warning;
      case 'Mantenimiento':
      case 'Pendiente':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bienvenido</Text>
            <Text style={styles.userName}>Administrador</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Estadísticas */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="business-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.statValue}>{mockData.stats.totalComplejos}</Text>
              <Text style={styles.statLabel}>Complejos</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.secondary + '20' }]}>
                <Ionicons name="football-outline" size={20} color={Colors.secondary} />
              </View>
              <Text style={styles.statValue}>{mockData.stats.totalCanchas}</Text>
              <Text style={styles.statLabel}>Canchas</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.success + '20' }]}>
                <Ionicons name="calendar-outline" size={20} color={Colors.success} />
              </View>
              <Text style={styles.statValue}>{mockData.stats.reservasHoy}</Text>
              <Text style={styles.statLabel}>Hoy</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Ionicons name="time-outline" size={20} color={Colors.warning} />
              </View>
              <Text style={styles.statValue}>{mockData.stats.reservasPendientes}</Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
          </View>

          {/* Ingresos del mes */}
          <View style={styles.incomeCard}>
            <View style={styles.incomeHeader}>
              <Ionicons name="cash-outline" size={24} color={Colors.textInverse} />
              <Text style={styles.incomeLabel}>Ingresos del mes</Text>
            </View>
            <Text style={styles.incomeValue}>{formatCurrency(mockData.stats.ingresosMes)}</Text>
          </View>
        </View>

        {/* Complejos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mis Complejos</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/complejos')}>
              <Text style={styles.seeAllText}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {mockData.complejos.map((complejo) => (
              <View key={complejo.id} style={styles.complejoCard}>
                <View style={styles.complejoHeader}>
                  <View style={styles.complejoIcon}>
                    <Ionicons name="business" size={24} color={Colors.primary} />
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getEstadoColor(complejo.estado) + '20' }]}>
                    <Text style={[styles.statusText, { color: getEstadoColor(complejo.estado) }]}>
                      {complejo.estado}
                    </Text>
                  </View>
                </View>
                <Text style={styles.complejoName}>{complejo.nombre}</Text>
                <Text style={styles.complejoAddress}>{complejo.direccion}</Text>
                <View style={styles.complejoFooter}>
                  <Ionicons name="football-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.complejoCanchas}>{complejo.canchas} canchas</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Canchas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Canchas</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {mockData.canchas.slice(0, 4).map((cancha) => (
            <TouchableOpacity key={cancha.id} style={styles.canchaCard}>
              <View style={styles.canchaInfo}>
                <Text style={styles.canchaName}>{cancha.nombre}</Text>
                <Text style={styles.canchaComplejo}>{cancha.complejo}</Text>
                <View style={styles.canchaMeta}>
                  <Text style={styles.canchaType}>{cancha.tipo}</Text>
                  <View style={styles.canchaReservas}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
                    <Text style={styles.canchaReservasText}>{cancha.reservasHoy} hoy</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.canchaEstado, { backgroundColor: getEstadoColor(cancha.estado) + '20' }]}>
                <Text style={[styles.canchaEstadoText, { color: getEstadoColor(cancha.estado) }]}>
                  {cancha.estado}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Reservas Recientes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reservas Recientes</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {mockData.reservas.map((reserva) => (
            <View key={reserva.id} style={styles.reservaCard}>
              <View style={styles.reservaHeader}>
                <View>
                  <Text style={styles.reservaCancha}>{reserva.cancha}</Text>
                  <Text style={styles.reservaComplejo}>{reserva.complejo}</Text>
                </View>
                <View style={[styles.reservaEstado, { backgroundColor: getEstadoColor(reserva.estado) + '20' }]}>
                  <Text style={[styles.reservaEstadoText, { color: getEstadoColor(reserva.estado) }]}>
                    {reserva.estado}
                  </Text>
                </View>
              </View>
              <View style={styles.reservaDetails}>
                <View style={styles.reservaDetail}>
                  <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.reservaDetailText}>{reserva.cliente}</Text>
                </View>
                <View style={styles.reservaDetail}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.reservaDetailText}>{reserva.fecha} {reserva.hora}</Text>
                </View>
                <View style={styles.reservaDetail}>
                  <Ionicons name="cash-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.reservaAmount}>{formatCurrency(reserva.monto)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  greeting: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  notificationButton: {
    position: 'relative',
    padding: Spacing.xs,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
  },
  statsContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  seeAllText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  statCard: {
    width: cardWidth,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  incomeCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    ...Shadows.sm,
  },
  incomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  incomeLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textInverse,
    marginLeft: Spacing.xs,
    opacity: 0.9,
  },
  incomeValue: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textInverse,
  },
  horizontalScroll: {
    paddingLeft: Spacing.md,
  },
  complejoCard: {
    width: 200,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginRight: Spacing.sm,
    ...Shadows.sm,
  },
  complejoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  complejoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  complejoName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  complejoAddress: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  complejoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  complejoCanchas: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  canchaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    ...Shadows.sm,
  },
  canchaInfo: {
    flex: 1,
  },
  canchaName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  canchaComplejo: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  canchaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  canchaType: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  canchaReservas: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  canchaReservasText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  canchaEstado: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  canchaEstadoText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  reservaCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    ...Shadows.sm,
  },
  reservaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  reservaCancha: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  reservaComplejo: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  reservaEstado: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  reservaEstadoText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  reservaDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  reservaDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reservaDetailText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  reservaAmount: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
});

