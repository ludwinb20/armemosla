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
import { getComplejos, ComplejoWithFotos } from '../../lib/complejos';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import { Screen, Text, Card, Button, Input, Chip, Divider } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

type ViewType = 'complejos' | 'canchas';

export default function InstalacionesScreen() {
  const router = useRouter();
  const { colors } = useGlassTheme();
  const [viewType, setViewType] = useState<ViewType>('complejos');

  const [complejos, setComplejos] = useState<ComplejoWithFotos[]>([]);
  const [loadingComplejos, setLoadingComplejos] = useState(true);

  const [canchas, setCanchas] = useState<CanchaWithRelations[]>([]);
  const [complejosList, setComplejosList] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loadingCanchas, setLoadingCanchas] = useState(true);
  const [filterComplejoId, setFilterComplejoId] = useState<string>('');
  const [searchNombre, setSearchNombre] = useState('');
  const [showInactivas, setShowInactivas] = useState(false);

  const { alertVisible, alertOptions, showError, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    React.useCallback(() => {
      if (viewType === 'complejos') {
        loadComplejos();
      } else {
        loadComplejosList();
        loadCanchas();
      }
    }, [viewType])
  );

  useEffect(() => {
    if (viewType === 'canchas') {
      loadCanchas();
    }
  }, [filterComplejoId, showInactivas]);

  const loadComplejos = async () => {
    try {
      setLoadingComplejos(true);
      const data = await getComplejos();
      setComplejos(data);
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
      showError('Error', 'No se pudieron cargar los complejos');
    } finally {
      setLoadingComplejos(false);
    }
  };

  const loadComplejosList = async () => {
    try {
      const data = await getComplejos();
      setComplejosList(data.map(c => ({ id: c.id, nombre: c.nombre })));
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
    }
  };

  const loadCanchas = async () => {
    try {
      setLoadingCanchas(true);
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
      setLoadingCanchas(false);
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

  const loading = viewType === 'complejos' ? loadingComplejos : loadingCanchas;
  const isEmpty = viewType === 'complejos' ? complejos.length === 0 : canchas.length === 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-md py-sm">
        <Text variant="h4">Instalaciones</Text>
        <Pressable
          onPress={() => router.push(viewType === 'complejos' ? '/complejo-form' : '/cancha-form')}
          className="p-xs"
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
      </View>
      <Divider className="my-0" />

      <View className="flex-row px-md py-sm gap-sm">
        <Pressable
          className="flex-1 flex-row items-center justify-center py-sm px-md rounded-lg gap-xs"
          style={viewType === 'complejos' ? { backgroundColor: colors.primary } : undefined}
          onPress={() => setViewType('complejos')}
        >
          <Ionicons
            name="business-outline"
            size={18}
            color={viewType === 'complejos' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text variant={viewType === 'complejos' ? 'inverse' : 'bodySecondary'} className="font-semibold">
            Complejos
          </Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center py-sm px-md rounded-lg gap-xs"
          style={viewType === 'canchas' ? { backgroundColor: colors.primary } : undefined}
          onPress={() => setViewType('canchas')}
        >
          <Ionicons
            name="football-outline"
            size={18}
            color={viewType === 'canchas' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text variant={viewType === 'canchas' ? 'inverse' : 'bodySecondary'} className="font-semibold">
            Canchas
          </Text>
        </Pressable>
      </View>
      <Divider className="my-0" />

      {viewType === 'canchas' && (
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
              {complejosList.map((complejo) => (
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
      )}
      {viewType === 'canchas' && <Divider className="my-0" />}

      {loading && isEmpty ? (
        <PlayerLoadingView />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-md"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={viewType === 'complejos' ? loadComplejos : loadCanchas}
              tintColor={colors.primary}
            />
          }
        >
          {viewType === 'complejos' ? (
            complejos.length === 0 ? (
              <View className="items-center justify-center py-xxl px-lg">
                <Ionicons name="business-outline" size={64} color={colors.textSecondary} />
                <Text variant="h4" className="mt-md mb-xs">
                  No tienes complejos
                </Text>
                <Text variant="caption" className="text-center mb-lg">
                  Crea tu primer complejo deportivo para comenzar
                </Text>
                <Button onPress={() => router.push('/complejo-form')}>Crear Complejo</Button>
              </View>
            ) : (
              complejos.map((complejo) => (
                <Card
                  key={complejo.id}
                  onPress={() => router.push(`/complejo-form?id=${complejo.id}`)}
                  className="mb-sm"
                  style={complejo.activo ? { borderColor: colors.borderSubtle, borderWidth: 2 } : undefined}
                >
                  <View className="flex-row items-center">
                    {complejo.logo_url ? (
                      <Image
                        source={{ uri: complejo.logo_url }}
                        className="w-[60px] h-[60px] rounded-lg mr-sm"
                      />
                    ) : (
                      <View
                        className="w-[60px] h-[60px] rounded-lg justify-center items-center mr-sm"
                        style={{ backgroundColor: colors.borderSubtle }}
                      >
                        <Ionicons name="business" size={32} color={colors.textSecondary} />
                      </View>
                    )}
                    <View className="flex-1">
                      <View className="flex-row items-center mb-xs gap-xs">
                        <Text variant="label" className="flex-1 font-semibold">
                          {complejo.nombre}
                        </Text>
                        <View
                          className="flex-row items-center px-xs py-0.5 rounded-sm gap-1 border"
                          style={
                            complejo.activo
                              ? { backgroundColor: colors.success + '20', borderColor: colors.success }
                              : { backgroundColor: colors.error + '20', borderColor: colors.error }
                          }
                        >
                          <Ionicons
                            name={complejo.activo ? 'checkmark-circle' : 'close-circle'}
                            size={12}
                            color={complejo.activo ? colors.success : colors.error}
                          />
                          <Text
                            variant="caption"
                            style={{ color: complejo.activo ? colors.success : colors.error }}
                          >
                            {complejo.activo ? 'Activo' : 'Inactivo'}
                          </Text>
                        </View>
                      </View>
                      {complejo.direccion_texto && (
                        <View className="flex-row items-center mb-xs">
                          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                          <Text variant="caption" className="ml-xs flex-1">
                            {complejo.direccion_texto}
                          </Text>
                        </View>
                      )}
                      {complejo.fotos && complejo.fotos.length > 0 && (
                        <View className="flex-row items-center">
                          <Ionicons name="images-outline" size={14} color={colors.textSecondary} />
                          <Text variant="caption" className="ml-xs">
                            {complejo.fotos.length} {complejo.fotos.length === 1 ? 'foto' : 'fotos'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              ))
            )
          ) : canchas.length === 0 ? (
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
      )}

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
