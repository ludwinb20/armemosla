import React, { useState } from 'react';
import { View, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getComplejos, ComplejoWithFotos } from '../../lib/complejos';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../../components/CustomAlert';
import PlayerLoadingView from '../../components/lottie/PlayerLoadingView';
import { Screen, Text, Card, Button, Divider } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';

export default function ComplejosScreen() {
  const router = useRouter();
  const { colors } = useGlassTheme();
  const [complejos, setComplejos] = useState<ComplejoWithFotos[]>([]);
  const [loading, setLoading] = useState(true);
  const { alertVisible, alertOptions, showError, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useFocusEffect(
    React.useCallback(() => {
      loadComplejos();
    }, [])
  );

  const loadComplejos = async () => {
    try {
      setLoading(true);
      const data = await getComplejos();
      setComplejos(data);
    } catch (error: any) {
      console.error('Error al cargar complejos:', error);
      showError('Error', 'No se pudieron cargar los complejos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <PlayerLoadingView />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-md py-sm">
        <Pressable onPress={() => router.back()} className="p-xs">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h4">Mis Complejos</Text>
        <Pressable onPress={() => router.push('/complejo-form')} className="p-xs">
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
      </View>
      <Divider className="my-0" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-md"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadComplejos}
            tintColor={colors.primary}
          />
        }
      >
        {complejos.length === 0 ? (
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
