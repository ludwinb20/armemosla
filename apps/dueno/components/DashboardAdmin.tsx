import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Pressable,
} from 'react-native';
import RNModal from 'react-native-modal';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { Screen, Text, Button, Input, Card, Surface, DialogSheet } from '@/components/ui';
import { cn } from '@/lib/cn';
import PlayerLoadingView from './lottie/PlayerLoadingView';
import { getReservas, ReservaWithRelations } from '../lib/reservas';
import { getComplejos, ComplejoWithFotos } from '../lib/complejos';
import { getCanchas, CanchaWithRelations } from '../lib/canchas';
import {
  getRModalBackdropProps,
  getRModalCenterSheetStyle,
  getRModalCardLayout,
  rModalAnimCenter,
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
  const { colors } = useGlassTheme();
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
      <Screen>
        <PlayerLoadingView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-xl"
        showsVerticalScrollIndicator={false}
      >
        {/* Estadísticas */}
        <View className="px-md mb-md">
          <Text variant="h4" className="mb-sm">
            Resumen
          </Text>
          <View className="flex-row flex-wrap justify-between mb-sm">
            <Card className="mb-sm items-center justify-center" style={{ width: cardWidth }}>
              <Text variant="h2" className="mb-sm text-center">
                {stats.totalComplejos}
              </Text>
              <View className="flex-row items-center justify-center gap-xs">
                <Ionicons name="business-outline" size={16} color={colors.primary} />
                <Text variant="caption">Complejos</Text>
              </View>
            </Card>

            <Card className="mb-sm items-center justify-center" style={{ width: cardWidth }}>
              <Text variant="h2" className="mb-sm text-center">
                {stats.totalCanchas}
              </Text>
              <View className="flex-row items-center justify-center gap-xs">
                <Ionicons name="football-outline" size={16} color={colors.info} />
                <Text variant="caption">Canchas</Text>
              </View>
            </Card>

            <Card className="mb-sm items-center justify-center" style={{ width: cardWidth }}>
              <Text variant="h2" className="mb-sm text-center">
                {stats.reservasHoy}
              </Text>
              <View className="flex-row items-center justify-center gap-xs">
                <Ionicons name="calendar-outline" size={16} color={colors.success} />
                <Text variant="caption">Hoy</Text>
              </View>
            </Card>

            <Card className="mb-sm items-center justify-center" style={{ width: cardWidth }}>
              <Text variant="h2" className="mb-sm text-center">
                {stats.reservasPendientes}
              </Text>
              <View className="flex-row items-center justify-center gap-xs">
                <Ionicons name="time-outline" size={16} color={colors.warning} />
                <Text variant="caption">Pendientes</Text>
              </View>
            </Card>
          </View>

          {/* Ingresos del mes */}
          <View className="bg-primary rounded-lg p-md mt-sm">
            <View className="flex-row items-center mb-xs">
              <Ionicons name="cash-outline" size={24} color="#FFFFFF" />
              <Text variant="caption" className="ml-xs text-text-inverse opacity-90">
                Ingresos del mes
              </Text>
            </View>
            <Text variant="h2" className="text-text-inverse">
              {formatCurrency(stats.ingresosMes)}
            </Text>
          </View>
        </View>

        {/* Sección de Informes */}
        <View className="mb-md">
          <View className="flex-row justify-between items-center px-md mb-sm">
            <Text variant="h4">Informes</Text>
            <TouchableOpacity onPress={() => setShowFiltros(true)}>
              <Ionicons name="filter-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {reservasInforme.length > 0 ? (
            <Card className="mx-md">
              <Text variant="body" className="font-semibold mb-sm">
                Informe Generado ({reservasInforme.length} reservas)
              </Text>
              <View className="flex-row justify-around mb-md">
                <View className="items-center">
                  <Text variant="caption" className="mb-xs">
                    Completadas
                  </Text>
                  <Text variant="h4">
                    {reservasInforme.filter((r) => r.estado === 'completada').length}
                  </Text>
                </View>
                <View className="items-center">
                  <Text variant="caption" className="mb-xs">
                    Pendientes
                  </Text>
                  <Text variant="h4">
                    {reservasInforme.filter((r) => r.estado === 'pendiente').length}
                  </Text>
                </View>
                <View className="items-center">
                  <Text variant="caption" className="mb-xs">
                    Canceladas
                  </Text>
                  <Text variant="h4">
                    {reservasInforme.filter((r) => r.estado === 'cancelada').length}
                  </Text>
                </View>
              </View>
              <Button onPress={exportarPDF} disabled={loadingInforme}>
                <View className="flex-row items-center gap-xs">
                  <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  <Text variant="inverse">Exportar PDF</Text>
                </View>
              </Button>
            </Card>
          ) : (
            <Card className="mx-md items-center p-xl">
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text variant="caption" className="text-center mt-sm">
                No hay informe generado. Usa el filtro para generar uno.
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Modal de Filtros */}
      <RNModal
        {...rBackdrop}
        {...rModalAnimCenter}
        isVisible={showFiltros}
        onBackdropPress={() => setShowFiltros(false)}
        onBackButtonPress={() => setShowFiltros(false)}
        avoidKeyboard
        style={rCenter}
      >
        <DialogSheet maxHeight={modalMaxHeight}>
            <View className="flex-row justify-between items-center p-lg border-b border-border-subtle dark:border-border-subtle-dark">
              <Text variant="h3">Filtros de Informe</Text>
              <TouchableOpacity onPress={() => setShowFiltros(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: modalScrollAreaMaxHeight }}
              contentContainerClassName="p-lg"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Input
                label="Fecha Inicio"
                value={filtros.fechaInicio}
                onChangeText={(text) => setFiltros((prev) => ({ ...prev, fechaInicio: text }))}
                placeholder="YYYY-MM-DD"
                containerClassName="mb-lg"
              />

              <Input
                label="Fecha Fin"
                value={filtros.fechaFin}
                onChangeText={(text) => setFiltros((prev) => ({ ...prev, fechaFin: text }))}
                placeholder="YYYY-MM-DD"
                containerClassName="mb-lg"
              />

              <Input
                label="Hora Inicio"
                value={filtros.horaInicio}
                onChangeText={(text) => setFiltros((prev) => ({ ...prev, horaInicio: text }))}
                placeholder="HH:MM"
                containerClassName="mb-lg"
              />

              <Input
                label="Hora Fin"
                value={filtros.horaFin}
                onChangeText={(text) => setFiltros((prev) => ({ ...prev, horaFin: text }))}
                placeholder="HH:MM"
                containerClassName="mb-lg"
              />

              <View className="mb-lg">
                <Text variant="label" className="mb-sm">
                  Complejos
                </Text>
                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                  {complejos.map((complejo) => {
                    const selected = complejosSeleccionados.includes(complejo.id);
                    return (
                      <Pressable
                        key={complejo.id}
                        className={cn(
                          'flex-row justify-between items-center p-md rounded-lg border mb-xs',
                          selected ? 'bg-primary/20 border-primary' : 'border-border-subtle dark:border-border-subtle-dark'
                        )}
                        onPress={() => toggleComplejo(complejo.id)}
                      >
                        <Text className={cn('text-sm font-medium', selected ? 'text-primary' : '')}>
                          {complejo.nombre}
                        </Text>
                        {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View className="mb-lg">
                <Text variant="label" className="mb-sm">
                  Canchas
                </Text>
                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                  {canchas.map((cancha) => {
                    const selected = canchasSeleccionadas.includes(cancha.id);
                    return (
                      <Pressable
                        key={cancha.id}
                        className={cn(
                          'flex-row justify-between items-center p-md rounded-lg border mb-xs',
                          selected ? 'bg-primary/20 border-primary' : 'border-border-subtle dark:border-border-subtle-dark'
                        )}
                        onPress={() => toggleCancha(cancha.id)}
                      >
                        <Text className={cn('text-sm font-medium', selected ? 'text-primary' : '')}>
                          {cancha.nombre || `Cancha ${cancha.id.slice(0, 8)}`}
                        </Text>
                        {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Button onPress={generarInforme} disabled={loadingInforme} loading={loadingInforme}>
                <View className="flex-row items-center gap-xs">
                  <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                  <Text variant="inverse">Generar Informe</Text>
                </View>
              </Button>
            </ScrollView>
        </DialogSheet>
      </RNModal>
    </Screen>
  );
}
