import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';
import PlayerLoadingView from './lottie/PlayerLoadingView';
import { getReservas, ReservaWithRelations } from '../lib/reservas';
import { getComplejos, ComplejoWithFotos } from '../lib/complejos';
import { getCanchas, CanchaWithRelations } from '../lib/canchas';
import { useFocusEffect } from 'expo-router';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimLeft,
} from '../lib/rnModalPresets';

const { width } = Dimensions.get('window');
const cardWidth = (width - Spacing.md * 2 - Spacing.sm) / 2;

interface FiltrosInforme {
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  complejoIds: string[];
  canchaIds: string[];
}

export default function DashboardAdmin() {
  const router = useRouter();
  const colors = useThemeColors();
  const rBackdrop = getRModalBackdropProps();
  const rCenter = getRModalCenterSheetStyle();
  const { modalMaxHeight, modalScrollAreaMaxHeight } = getRModalCardLayout();
  const [loading, setLoading] = useState(true);
  const [loadingInforme, setLoadingInforme] = useState(false);
  const [stats, setStats] = useState({
    totalComplejos: 0,
    totalCanchas: 0,
    reservasHoy: 0,
    reservasPendientes: 0,
    ingresosMes: 0,
  });
  const [complejos, setComplejos] = useState<ComplejoWithFotos[]>([]);
  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [reservasInforme, setReservasInforme] = useState<ReservaWithRelations[]>([]);
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosInforme>({
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: new Date().toISOString().split('T')[0],
    horaInicio: '00:00',
    horaFin: '23:59',
    complejoIds: [],
    canchaIds: [],
  });
  const [complejosSeleccionados, setComplejosSeleccionados] = useState<string[]>([]);
  const [canchasSeleccionadas, setCanchasSeleccionadas] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [complejosData, canchasData, reservasHoy, reservasPendientes] = await Promise.all([
        getComplejos(),
        getCanchas(undefined, true),
        loadReservasHoy(),
        loadReservasPendientes(),
      ]);

      setComplejos(complejosData);
      setCanchas(canchasData);
      setStats({
        totalComplejos: complejosData.length,
        totalCanchas: canchasData.length,
        reservasHoy: reservasHoy.length,
        reservasPendientes: reservasPendientes.length,
        ingresosMes: await calcularIngresosMes(),
      });
    } catch (error: any) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReservasHoy = async () => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const finHoy = new Date();
      finHoy.setHours(23, 59, 59, 999);
      return await getReservas(hoy.toISOString(), finHoy.toISOString());
    } catch (error) {
      console.error('Error al cargar reservas de hoy:', error);
      return [];
    }
  };

  const loadReservasPendientes = async () => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const finMes = new Date();
      finMes.setMonth(finMes.getMonth() + 1);
      finMes.setDate(0);
      finMes.setHours(23, 59, 59, 999);
      const reservas = await getReservas(hoy.toISOString(), finMes.toISOString());
      return reservas.filter((r) => r.estado === 'pendiente');
    } catch (error) {
      console.error('Error al cargar reservas pendientes:', error);
      return [];
    }
  };

  const calcularIngresosMes = async () => {
    try {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const finMes = new Date();
      finMes.setMonth(finMes.getMonth() + 1);
      finMes.setDate(0);
      finMes.setHours(23, 59, 59, 999);
      
      const reservas = await getReservas(inicioMes.toISOString(), finMes.toISOString());
      const reservasCompletadas = reservas.filter((r) => r.estado === 'completada');
      
      // Calcular ingresos basado en precio de canchas
      let total = 0;
      for (const reserva of reservasCompletadas) {
        if (reserva.cancha) {
          const cancha = canchas.find((c) => c.id === reserva.cancha_id);
          if (cancha) {
            total += cancha.precio_por_hora || 0;
          }
        }
      }
      return total;
    } catch (error) {
      console.error('Error al calcular ingresos:', error);
      return 0;
    }
  };

  const generarInforme = async () => {
    try {
      setLoadingInforme(true);
      
      // Construir rango de fechas con horas
      const fechaInicio = new Date(`${filtros.fechaInicio}T${filtros.horaInicio}:00`);
      const fechaFin = new Date(`${filtros.fechaFin}T${filtros.horaFin}:59`);
      
      // Obtener reservas con filtros
      let reservas = await getReservas(fechaInicio.toISOString(), fechaFin.toISOString());
      
      // Filtrar por complejos
      if (filtros.complejoIds.length > 0) {
        reservas = reservas.filter((r) => {
          const complejoId = r.cancha?.complejo?.id;
          return complejoId && filtros.complejoIds.includes(complejoId);
        });
      }
      
      // Filtrar por canchas
      if (filtros.canchaIds.length > 0) {
        reservas = reservas.filter((r) => filtros.canchaIds.includes(r.cancha_id));
      }
      
      setReservasInforme(reservas);
      setShowFiltros(false);
    } catch (error: any) {
      console.error('Error al generar informe:', error);
    } finally {
      setLoadingInforme(false);
    }
  };

  const exportarPDF = async () => {
    try {
      if (reservasInforme.length === 0) {
        alert('No hay datos para exportar. Por favor genera un informe primero.');
        return;
      }

      // Importar expo-print dinámicamente
      let Print: typeof import('expo-print');
      try {
        Print = await import('expo-print');
      } catch (error) {
        alert('La funcionalidad de exportación a PDF no está disponible. Por favor, ejecuta "npx expo prebuild" y luego "npx expo run:android" o "npx expo run:ios" para compilar el módulo nativo.');
        return;
      }

      // Calcular totalizaciones
      const totalReservas = reservasInforme.length;
      const reservasCompletadas = reservasInforme.filter((r) => r.estado === 'completada');
      const reservasPendientes = reservasInforme.filter((r) => r.estado === 'pendiente');
      const reservasCanceladas = reservasInforme.filter((r) => r.estado === 'cancelada');
      
      let ingresosTotales = 0;
      const ingresosPorCancha: Record<string, number> = {};
      
      reservasCompletadas.forEach((reserva) => {
        const cancha = canchas.find((c) => c.id === reserva.cancha_id);
        if (cancha) {
          const monto = cancha.precio_por_hora || 0;
          ingresosTotales += monto;
          if (!ingresosPorCancha[reserva.cancha_id]) {
            ingresosPorCancha[reserva.cancha_id] = 0;
          }
          ingresosPorCancha[reserva.cancha_id] += monto;
        }
      });

      // Generar HTML para el PDF
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #333;
            }
            h1 {
              color: #00C56E;
              border-bottom: 2px solid #00C56E;
              padding-bottom: 10px;
            }
            h2 {
              color: #666;
              margin-top: 30px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #00C56E;
              color: white;
            }
            tr:nth-child(even) {
              background-color: #f2f2f2;
            }
            .total {
              font-weight: bold;
              font-size: 1.2em;
              margin-top: 20px;
            }
            .summary {
              background-color: #f9f9f9;
              padding: 15px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <h1>Informe de Reservas</h1>
          
          <div class="summary">
            <h2>Resumen</h2>
            <p><strong>Período:</strong> ${new Date(filtros.fechaInicio).toLocaleDateString('es-HN')} - ${new Date(filtros.fechaFin).toLocaleDateString('es-HN')}</p>
            <p><strong>Horario:</strong> ${filtros.horaInicio} - ${filtros.horaFin}</p>
            <p><strong>Total de Reservas:</strong> ${totalReservas}</p>
            <p><strong>Completadas:</strong> ${reservasCompletadas.length}</p>
            <p><strong>Pendientes:</strong> ${reservasPendientes.length}</p>
            <p><strong>Canceladas:</strong> ${reservasCanceladas.length}</p>
            <p><strong>Ingresos Totales:</strong> L ${ingresosTotales.toLocaleString()}</p>
          </div>

          <h2>Detalle de Reservas</h2>
          <table>
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Cancha</th>
                <th>Complejo</th>
                <th>Estado</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${reservasInforme.map((reserva) => {
                const fecha = new Date(reserva.fecha_hora);
                const cancha = canchas.find((c) => c.id === reserva.cancha_id);
                const monto = cancha?.precio_por_hora || 0;
                return `
                  <tr>
                    <td>${fecha.toLocaleString('es-HN')}</td>
                    <td>${reserva.cancha?.nombre || 'N/A'}</td>
                    <td>${reserva.cancha?.complejo?.nombre || 'N/A'}</td>
                    <td>${reserva.estado}</td>
                    <td>L ${monto.toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="total">
            <p><strong>Total de Ingresos:</strong> L ${ingresosTotales.toLocaleString()}</p>
          </div>
        </body>
        </html>
      `;

      // Generar PDF
      const { uri } = await Print.printToFileAsync({ html });
      
      // Intentar compartir el PDF
      try {
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        } else {
          alert(`PDF generado en: ${uri}`);
        }
      } catch (error) {
        // Si expo-sharing no está disponible, solo mostrar la ruta
        alert(`PDF generado en: ${uri}`);
      }
    } catch (error: any) {
      console.error('Error al exportar PDF:', error);
      alert('Error al exportar PDF: ' + error.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const toggleComplejo = (complejoId: string) => {
    setComplejosSeleccionados((prev) =>
      prev.includes(complejoId)
        ? prev.filter((id) => id !== complejoId)
        : [...prev, complejoId]
    );
  };

  const toggleCancha = (canchaId: string) => {
    setCanchasSeleccionadas((prev) =>
      prev.includes(canchaId)
        ? prev.filter((id) => id !== canchaId)
        : [...prev, canchaId]
    );
  };

  useEffect(() => {
    setFiltros((prev) => ({
      ...prev,
      complejoIds: complejosSeleccionados,
      canchaIds: canchasSeleccionadas,
    }));
  }, [complejosSeleccionados, canchasSeleccionadas]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <PlayerLoadingView style={styles.loadingContainer} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Bienvenido</Text>
            <Text style={[styles.userName, { color: colors.text }]}>Administrador</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalComplejos}</Text>
              <View style={styles.statFooter}>
                <Ionicons name="business-outline" size={16} color={Colors.primary} />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Complejos</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalCanchas}</Text>
              <View style={styles.statFooter}>
                <Ionicons name="football-outline" size={16} color={Colors.secondary} />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Canchas</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.reservasHoy}</Text>
              <View style={styles.statFooter}>
                <Ionicons name="calendar-outline" size={16} color={Colors.success} />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hoy</Text>
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.reservasPendientes}</Text>
              <View style={styles.statFooter}>
                <Ionicons name="time-outline" size={16} color={Colors.warning} />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pendientes</Text>
              </View>
            </View>
          </View>

          {/* Ingresos del mes */}
          <View style={styles.incomeCard}>
            <View style={styles.incomeHeader}>
              <Ionicons name="cash-outline" size={24} color="#FFFFFF" />
              <Text style={[styles.incomeLabel, { color: '#FFFFFF' }]}>Ingresos del mes</Text>
            </View>
            <Text style={[styles.incomeValue, { color: '#FFFFFF' }]}>{formatCurrency(stats.ingresosMes)}</Text>
          </View>
        </View>

        {/* Sección de Informes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Informes</Text>
            <TouchableOpacity onPress={() => setShowFiltros(true)}>
              <Ionicons name="filter-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {reservasInforme.length > 0 ? (
            <View style={[styles.informeContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.informeTitle, { color: colors.text }]}>
                Informe Generado ({reservasInforme.length} reservas)
              </Text>
              <View style={styles.informeStats}>
                <View style={styles.informeStat}>
                  <Text style={[styles.informeStatLabel, { color: colors.textSecondary }]}>Completadas</Text>
                  <Text style={[styles.informeStatValue, { color: colors.text }]}>
                    {reservasInforme.filter((r) => r.estado === 'completada').length}
                  </Text>
                </View>
                <View style={styles.informeStat}>
                  <Text style={[styles.informeStatLabel, { color: colors.textSecondary }]}>Pendientes</Text>
                  <Text style={[styles.informeStatValue, { color: colors.text }]}>
                    {reservasInforme.filter((r) => r.estado === 'pendiente').length}
                  </Text>
                </View>
                <View style={styles.informeStat}>
                  <Text style={[styles.informeStatLabel, { color: colors.textSecondary }]}>Canceladas</Text>
                  <Text style={[styles.informeStatValue, { color: colors.text }]}>
                    {reservasInforme.filter((r) => r.estado === 'cancelada').length}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={exportarPDF}
                disabled={loadingInforme}
              >
                <Ionicons name="download-outline" size={20} color={Colors.textInverse} />
                <Text style={styles.exportButtonText}>Exportar PDF</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.emptyInforme, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyInformeText, { color: colors.textSecondary }]}>
                No hay informe generado. Usa el filtro para generar uno.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal de Filtros */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimLeft}
        isVisible={showFiltros}
        onBackdropPress={() => setShowFiltros(false)}
        onBackButtonPress={() => setShowFiltros(false)}
        avoidKeyboard
        style={rCenter}
      >
        <SafeAreaView style={styles.modalSheetOuter} edges={['top', 'bottom']}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, maxHeight: modalMaxHeight }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Filtros de Informe</Text>
              <TouchableOpacity onPress={() => setShowFiltros(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {/* Fechas */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Fecha Inicio</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={filtros.fechaInicio}
                  onChangeText={(text) => setFiltros((prev) => ({ ...prev, fechaInicio: text }))}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Fecha Fin</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={filtros.fechaFin}
                  onChangeText={(text) => setFiltros((prev) => ({ ...prev, fechaFin: text }))}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              {/* Horas */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Hora Inicio</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={filtros.horaInicio}
                  onChangeText={(text) => setFiltros((prev) => ({ ...prev, horaInicio: text }))}
                  placeholder="HH:MM"
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Hora Fin</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={filtros.horaFin}
                  onChangeText={(text) => setFiltros((prev) => ({ ...prev, horaFin: text }))}
                  placeholder="HH:MM"
                />
              </View>

              {/* Complejos */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Complejos</Text>
                <ScrollView style={styles.filterScroll} nestedScrollEnabled>
                  {complejos.map((complejo) => (
                    <TouchableOpacity
                      key={complejo.id}
                      style={[
                        styles.filterOption,
                        {
                          backgroundColor: complejosSeleccionados.includes(complejo.id)
                            ? Colors.primary + '20'
                            : colors.background,
                          borderColor: complejosSeleccionados.includes(complejo.id)
                            ? Colors.primary
                            : colors.border,
                        },
                      ]}
                      onPress={() => toggleComplejo(complejo.id)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          {
                            color: complejosSeleccionados.includes(complejo.id)
                              ? Colors.primary
                              : colors.text,
                          },
                        ]}
                      >
                        {complejo.nombre}
                      </Text>
                      {complejosSeleccionados.includes(complejo.id) && (
                        <Ionicons name="checkmark" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Canchas */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Canchas</Text>
                <ScrollView style={styles.filterScroll} nestedScrollEnabled>
                  {canchas.map((cancha) => (
                    <TouchableOpacity
                      key={cancha.id}
                      style={[
                        styles.filterOption,
                        {
                          backgroundColor: canchasSeleccionadas.includes(cancha.id)
                            ? Colors.primary + '20'
                            : colors.background,
                          borderColor: canchasSeleccionadas.includes(cancha.id)
                            ? Colors.primary
                            : colors.border,
                        },
                      ]}
                      onPress={() => toggleCancha(cancha.id)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          {
                            color: canchasSeleccionadas.includes(cancha.id)
                              ? Colors.primary
                              : colors.text,
                          },
                        ]}
                      >
                        {cancha.nombre || `Cancha ${cancha.id.slice(0, 8)}`}
                      </Text>
                      {canchasSeleccionadas.includes(cancha.id) && (
                        <Ionicons name="checkmark" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={styles.generateButton}
                onPress={generarInforme}
                disabled={loadingInforme}
              >
                {loadingInforme ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={20} color={Colors.textInverse} />
                    <Text style={styles.generateButtonText}>Generar Informe</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </RNModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  userName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
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
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  statCard: {
    width: cardWidth,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  statValue: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
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
    marginLeft: Spacing.xs,
    opacity: 0.9,
  },
  incomeValue: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
  },
  informeContainer: {
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  informeTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  informeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  informeStat: {
    alignItems: 'center',
  },
  informeStatLabel: {
    fontSize: Typography.fontSize.xs,
    marginBottom: Spacing.xs,
  },
  informeStatValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  exportButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  emptyInforme: {
    marginHorizontal: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    ...Shadows.sm,
  },
  emptyInformeText: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  modalSheetOuter: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  modalCard: {
    borderRadius: BorderRadius.lg,
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalScrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  filterGroup: {
    marginBottom: Spacing.lg,
  },
  filterLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  filterInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
  },
  filterScroll: {
    maxHeight: 150,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  filterOptionText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  generateButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});
