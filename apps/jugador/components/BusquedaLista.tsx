import React, { useMemo, useCallback } from 'react';
import { View, FlatList, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CanchaBusqueda } from '../lib/busqueda';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { Text, Card, Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import PlayerEmptyState from './lottie/PlayerEmptyState';

interface BusquedaListaProps {
  canchas: CanchaBusqueda[];
  onCanchaPress: (cancha: CanchaBusqueda) => void;
  onVerMapa?: (cancha: CanchaBusqueda) => void;
  ordenarPor?: 'precio' | 'distancia' | 'nombre';
}

export default function BusquedaLista({
  canchas,
  onCanchaPress,
  onVerMapa,
  ordenarPor = 'distancia',
}: BusquedaListaProps) {
  const { colors } = useGlassTheme();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-HN', {
      style: 'currency',
      currency: 'HNL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const canchasOrdenadas = useMemo(() => {
    const lista = [...canchas];
    lista.sort((a, b) => {
      if (a.disponible && !b.disponible) return -1;
      if (!a.disponible && b.disponible) return 1;

      if (ordenarPor === 'precio') {
        return a.precio_por_hora - b.precio_por_hora;
      }
      if (ordenarPor === 'nombre') {
        return a.nombre.localeCompare(b.nombre, 'es');
      }
      if (a.distancia !== undefined && b.distancia !== undefined) {
        return a.distancia - b.distancia;
      }
      return a.precio_por_hora - b.precio_por_hora;
    });
    return lista;
  }, [canchas, ordenarPor]);

  const renderItem = useCallback(
    ({ item: cancha }: { item: CanchaBusqueda }) => (
      <Card
        onPress={() => onCanchaPress(cancha)}
        className={cn(
          'mb-md p-0 overflow-hidden',
          cancha.disponible ? 'border-l-4 border-l-success' : '',
          !cancha.disponible && 'opacity-60'
        )}
      >
        {cancha.fotos && cancha.fotos.length > 0 && (
          <Image
            source={{ uri: cancha.fotos[0].foto_url }}
            style={{ width: '100%', height: 200 }}
            resizeMode="cover"
          />
        )}

        <View className="flex-row justify-between items-start p-md pb-sm">
          <View className="flex-1">
            <Text variant="h4">{cancha.nombre}</Text>
            <Text variant="caption">{cancha.complejo.nombre}</Text>
          </View>
          <View
            className={cn(
              'px-sm py-xs rounded-sm',
              cancha.disponible ? 'bg-success/20' : 'bg-error/20'
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                cancha.disponible ? 'text-success' : 'text-error'
              )}
            >
              {cancha.disponible ? 'Disponible' : 'No disponible'}
            </Text>
          </View>
        </View>

        <View className="gap-xs px-md pb-md">
          <View className="flex-row items-center gap-xs">
            <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
            <Text variant="caption">Precio:</Text>
            <Text className="text-sm text-success flex-1">{formatCurrency(cancha.precio_por_hora)}</Text>
          </View>
          {cancha.distancia !== undefined && (
            <View className="flex-row items-center gap-xs">
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <Text variant="caption">Distancia:</Text>
              <Text variant="caption" className="flex-1">
                {cancha.distancia.toFixed(1)} km
              </Text>
            </View>
          )}
          <View className="flex-row items-center gap-xs">
            <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
            <Text variant="caption">Jugadores:</Text>
            <Text variant="caption" className="flex-1">
              {cancha.jugadores_por_equipo} por equipo
            </Text>
          </View>
        </View>

        {onVerMapa && cancha.complejo.direccion_lat && cancha.complejo.direccion_lng && (
          <Button
            variant="outline"
            size="sm"
            className="mx-md mb-md"
            onPress={() => onVerMapa(cancha)}
          >
            <View className="flex-row items-center gap-xs">
              <Ionicons name="map-outline" size={18} color={colors.primary} />
              <Text className="text-sm font-medium text-primary">Ver en mapa</Text>
            </View>
          </Button>
        )}
      </Card>
    ),
    [colors, onCanchaPress, onVerMapa]
  );

  if (canchas.length === 0) {
    return (
      <PlayerEmptyState
        variant="emptyField"
        title="No se encontraron canchas"
        text="Intenta ajustar los filtros o selecciona otra fecha/hora"
        compact
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}
      />
    );
  }

  return (
    <FlatList
      data={canchasOrdenadas}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      className="flex-1"
      contentContainerClassName="p-md"
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
}
