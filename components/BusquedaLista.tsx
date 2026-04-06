import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { CanchaBusqueda } from '../lib/busqueda';
import { useThemeColors } from '../hooks/useThemeColors';

interface BusquedaListaProps {
  canchas: CanchaBusqueda[];
  onCanchaPress: (cancha: CanchaBusqueda) => void;
  onVerMapa?: (cancha: CanchaBusqueda) => void;
}

export default function BusquedaLista({ canchas, onCanchaPress, onVerMapa }: BusquedaListaProps) {
  const colors = useThemeColors();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (canchas.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No se encontraron canchas</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Intenta ajustar los filtros o selecciona otra fecha/hora
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.listaContainer} contentContainerStyle={styles.listaContent}>
      {canchas.map((cancha) => (
        <TouchableOpacity
          key={cancha.id}
          style={[
            styles.canchaCard,
            {
              backgroundColor: colors.surface,
              borderColor: cancha.disponible ? Colors.success + '40' : colors.border,
              borderLeftWidth: cancha.disponible ? 4 : 1,
            },
            !cancha.disponible && { opacity: 0.6 },
          ]}
          onPress={() => onCanchaPress(cancha)}
        >
          {/* Foto de la cancha */}
          {cancha.fotos && cancha.fotos.length > 0 && (
            <Image
              source={{ uri: cancha.fotos[0].foto_url }}
              style={styles.canchaFoto}
              resizeMode="cover"
            />
          )}
          
          <View style={styles.canchaCardHeader}>
            <View style={styles.canchaCardInfo}>
              <Text style={[styles.canchaNombre, { color: colors.text }]}>{cancha.nombre}</Text>
              <Text style={[styles.canchaComplejo, { color: colors.textSecondary }]}>
                {cancha.complejo.nombre}
              </Text>
            </View>
            <View
              style={[
                styles.estadoBadge,
                {
                  backgroundColor: cancha.disponible ? Colors.success + '20' : Colors.error + '20',
                },
              ]}
            >
              <Text
                style={[
                  styles.estadoBadgeText,
                  {
                    color: cancha.disponible ? Colors.success : Colors.error,
                  },
                ]}
              >
                {cancha.disponible ? 'Disponible' : 'No disponible'}
              </Text>
            </View>
          </View>
          <View style={styles.canchaCardBody}>
            <View style={styles.canchaRow}>
              <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.canchaLabel, { color: colors.textSecondary }]}>Precio:</Text>
              <Text style={[styles.canchaValue, { color: Colors.success }]}>
                {formatCurrency(cancha.precio_por_hora)}
              </Text>
            </View>
            {cancha.distancia !== undefined && (
              <View style={styles.canchaRow}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.canchaLabel, { color: colors.textSecondary }]}>Distancia:</Text>
                <Text style={[styles.canchaValue, { color: colors.text }]}>
                  {cancha.distancia.toFixed(1)} km
                </Text>
              </View>
            )}
            <View style={styles.canchaRow}>
              <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.canchaLabel, { color: colors.textSecondary }]}>Jugadores:</Text>
              <Text style={[styles.canchaValue, { color: colors.text }]}>
                {cancha.jugadores_por_equipo} por equipo
              </Text>
            </View>
          </View>
          
          {/* Botón para ver en mapa */}
          {onVerMapa && cancha.complejo.direccion_lat && cancha.complejo.direccion_lng && (
            <TouchableOpacity
              style={[styles.verMapaButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => onVerMapa(cancha)}
            >
              <Ionicons name="map-outline" size={18} color={Colors.primary} />
              <Text style={[styles.verMapaText, { color: Colors.primary }]}>Ver en mapa</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listaContainer: {
    flex: 1,
  },
  listaContent: {
    padding: Spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
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
  canchaCard: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  canchaFoto: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.border,
  },
  canchaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  canchaCardInfo: {
    flex: 1,
  },
  canchaNombre: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 2,
  },
  canchaComplejo: {
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
  canchaCardBody: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  verMapaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  verMapaText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  canchaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  canchaLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  canchaValue: {
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },
});
