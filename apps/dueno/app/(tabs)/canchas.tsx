import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  Switch,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCanchas, CanchaWithRelations } from '../../lib/canchas';
import { getComplejos } from '../../lib/complejos';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import { Screen, Text, Card, Button, Input, Chip, Divider } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

export default function CanchasScreen() {
  const router = useRouter();
  const { colors } = useGlassTheme();
  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [complejos, setComplejos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filterComplejoId, setFilterComplejoId] = useState<string>('');
  const [searchNombre, setSearchNombre] = useState('');
  const [showInactivas, setShowInactivas] = useState(false);
  const { alertVisible, alertOptions, showError, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    React.useCallback(() => {
      loadComplejos();
      loadCanchas();
    }, [])
  );

  useEffect(() => {
    loadCanchas();
  }, [filterComplejoId, showInactivas]);

  const loadComplejos = async () => {
    try {
      const data = await getComplejos();
      setComplejos(data.map(c => ({ id: c.id, nombre: c.nombre })));
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
    }
  };

  const loadCanchas = async () => {
    try {
      setLoading(true);
      const activo = showInactivas ? undefined : true;
      const data = await getCanchas(filterComplejoId || undefined, activo);

      let filteredData = data;
      if (searchNombre.trim()) {
        filteredData = data.filter(cancha =>
          cancha.nombre?.toLowerCase().includes(searchNombre.toLowerCase().trim())
        );
      }

      setCanchas(filteredData);
    } catch (error: any) {
      console.error('Error al cargar canchas:', error);
      showError('Error', 'No se pudieron cargar las canchas');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchNombre(text);
    if (text.trim()) {
      const filtered = canchas.filter(cancha =>
        cancha.nombre?.toLowerCase().includes(text.toLowerCase().trim())
      );
      setCanchas(filtered);
    } else {
      loadCanchas();
    }
  };

  if (loading && canchas.length === 0) {
    return (
      <Screen edges={['top', 'bottom']}>
        <PlayerLoadingView />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-md py-sm">
        <Text variant="h4">Canchas</Text>
        <Pressable onPress={() => router.push('/cancha-form')} className="p-xs">
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
      </View>
      <Divider className="my-0" />

      <View className="p-md">
        <View className="mb-sm">
          <Text variant="label" className="mb-xs">
            Complejo:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip
              label="Todos"
              active={!filterComplejoId}
              onPress={() => setFilterComplejoId('')}
              className="mr-xs"
            />
            {complejos.map((complejo) => (
              <Chip
                key={complejo.id}
                label={complejo.nombre}
                active={filterComplejoId === complejo.id}
                onPress={() => setFilterComplejoId(complejo.id)}
                className="mr-xs"
              />
            ))}
          </ScrollView>
        </View>

        <Input
          leftIcon="search-outline"
          rightIcon={searchNombre.length > 0 ? 'close-circle' : undefined}
          onRightIconPress={() => {
            setSearchNombre('');
            loadCanchas();
          }}
          placeholder="Buscar por nombre..."
          value={searchNombre}
          onChangeText={handleSearchChange}
          containerClassName="mb-sm"
        />

        <View className="flex-row items-center justify-between">
          <Text variant="label">Mostrar inactivas</Text>
          <Switch
            value={showInactivas}
            onValueChange={setShowInactivas}
            trackColor={{ false: colors.borderSubtle, true: colors.primary + '40' }}
            thumbColor={showInactivas ? colors.primary : colors.textSecondary}
          />
        </View>
      </View>
      <Divider className="my-0" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-md"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadCanchas}
            tintColor={colors.primary}
          />
        }
      >
        {canchas.length === 0 ? (
          <View className="items-center justify-center py-xxl px-lg">
            <Ionicons name="football-outline" size={64} color={colors.textSecondary} />
            <Text variant="h4" className="mt-md mb-xs">
              No hay canchas
            </Text>
            <Text variant="caption" className="text-center mb-lg">
              {searchNombre || filterComplejoId
                ? 'No se encontraron canchas con los filtros aplicados'
                : 'Crea tu primera cancha para comenzar'}
            </Text>
            {!searchNombre && !filterComplejoId && (
              <Button onPress={() => router.push('/cancha-form')}>Crear Cancha</Button>
            )}
          </View>
        ) : (
          canchas.map((cancha) => (
            <Card
              key={cancha.id}
              onPress={() => router.push(`/cancha-form?id=${cancha.id}`)}
              className="mb-sm"
              style={cancha.activo ? { borderColor: colors.borderSubtle, borderWidth: 2 } : undefined}
            >
              <View className="flex-row items-start gap-md">
                {cancha.fotos && cancha.fotos.length > 0 && (
                  <Image
                    source={{ uri: cancha.fotos[0].foto_url }}
                    className="w-[100px] h-[100px] rounded-lg"
                    resizeMode="cover"
                  />
                )}
                <View className="flex-1">
                  <View className="flex-row items-center mb-xs gap-xs">
                    <Text variant="label" className="flex-1 font-semibold">
                      {cancha.nombre || `Cancha ${cancha.id.slice(0, 8)}`}
                    </Text>
                    <View
                      className="flex-row items-center px-xs py-0.5 rounded-sm gap-1 border"
                      style={
                        cancha.activo
                          ? { backgroundColor: colors.success + '20', borderColor: colors.success }
                          : { backgroundColor: colors.error + '20', borderColor: colors.error }
                      }
                    >
                      <Ionicons
                        name={cancha.activo ? 'checkmark-circle' : 'close-circle'}
                        size={12}
                        color={cancha.activo ? colors.success : colors.error}
                      />
                      <Text
                        variant="caption"
                        style={{ color: cancha.activo ? colors.success : colors.error }}
                      >
                        {cancha.activo ? 'Activa' : 'Inactiva'}
                      </Text>
                    </View>
                  </View>
                  {cancha.complejo && (
                    <View className="flex-row items-center mb-xs">
                      <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                      <Text variant="caption" className="ml-xs">
                        {cancha.complejo.nombre}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row flex-wrap gap-md mb-xs">
                    <View className="flex-row items-center gap-xs">
                      <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                      <Text variant="caption">
                        {cancha.jugadores_por_equipo} vs {cancha.jugadores_por_equipo}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-xs">
                      <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                      <Text variant="caption">
                        L {cancha.precio_por_hora.toLocaleString()}/hora
                      </Text>
                    </View>
                    {cancha.largo && cancha.ancho && (
                      <View className="flex-row items-center gap-xs">
                        <Ionicons name="resize-outline" size={14} color={colors.textSecondary} />
                        <Text variant="caption">
                          {cancha.largo}m x {cancha.ancho}m
                        </Text>
                      </View>
                    )}
                  </View>
                  {cancha.fotos && cancha.fotos.length > 0 && (
                    <View className="flex-row items-center">
                      <Ionicons name="images-outline" size={14} color={colors.textSecondary} />
                      <Text variant="caption" className="ml-xs">
                        {cancha.fotos.length} {cancha.fotos.length === 1 ? 'foto' : 'fotos'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          ))
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
        onCancel={handleCancel || hideAlert}
      />
    </Screen>
  );
}
