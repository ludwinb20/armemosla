import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import PlayerLoadingView from '../components/lottie/PlayerLoadingView';
import {
  getComplejoById,
  createComplejo,
  updateComplejo,
  addComplejoFoto,
  deleteComplejoFoto,
  toggleComplejoActivo,
  ComplejoWithFotos,
} from '../lib/complejos';
import { uploadImage, deleteImage, extractPathFromUrl } from '../lib/storage';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { Screen, Text, Button, Card, Input, Chip, Divider } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { cn } from '@/lib/cn';
import CustomAlert from '../components/CustomAlert';
import LocationPicker from '../components/LocationPicker';
import { GoogleMaps, AppleMaps } from 'expo-maps';
import { Platform } from 'react-native';
import RNModal from 'react-native-modal';
import { getRModalBackdropProps, rModalAnimFade } from '../lib/rnModalPresets';
import {
  TERMINOS_PAGOS_COMPLEJO_TITULO,
  TERMINOS_PAGOS_COMPLEJO_TEXTO,
} from '../constants/terminosPagosComplejo';

export default function ComplejoFormScreen() {
  const { colors } = useGlassTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const complejoId = params.id as string | undefined;
  const rBackdrop = getRModalBackdropProps();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!complejoId);
  const [nombre, setNombre] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [direccionTexto, setDireccionTexto] = useState('');
  const [direccionLat, setDireccionLat] = useState('');
  const [direccionLng, setDireccionLng] = useState('');
  const [fotos, setFotos] = useState<Array<{ uri: string; url?: string; id?: string }>>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(!complejoId); // Si no hay ID, es creación (modo edición)
  const [complejoData, setComplejoData] = useState<ComplejoWithFotos | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEditingNombre, setIsEditingNombre] = useState(false);
  const [nombreTemp, setNombreTemp] = useState('');
  const [isEditingDireccion, setIsEditingDireccion] = useState(false);
  const [direccionTemp, setDireccionTemp] = useState('');
  const [isEditingUbicacion, setIsEditingUbicacion] = useState(false);
  const [isEditingFotos, setIsEditingFotos] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTerminosModal, setShowTerminosModal] = useState(false);
  const [aceptoTerminos, setAceptoTerminos] = useState(false);

  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm, handleCancel } = useCustomAlert();

  useEffect(() => {
    if (complejoId) {
      loadComplejo();
    }
  }, [complejoId]);

  const loadComplejo = async () => {
    try {
      setLoadingData(true);
      const complejo = await getComplejoById(complejoId!);
      if (complejo) {
        setComplejoData(complejo);
        setNombre(complejo.nombre);
        setLogoUrl(complejo.logo_url || null);
        setDireccionTexto(complejo.direccion_texto || '');
        if (complejo.direccion_lat && complejo.direccion_lng) {
          setDireccionLat(complejo.direccion_lat.toString());
          setDireccionLng(complejo.direccion_lng.toString());
        }
        if (complejo.fotos) {
          setFotos(complejo.fotos.map(f => ({ uri: f.foto_url, url: f.foto_url, id: f.id })));
        }
      }
    } catch (error: any) {
      showError('Error', 'No se pudo cargar el complejo');
    } finally {
      setLoadingData(false);
    }
  };

  const pickImage = async (type: 'logo' | 'foto') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Permisos', 'Se necesitan permisos para acceder a las imágenes');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: type === 'logo',
      aspect: type === 'logo' ? [1, 1] : undefined,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      if (type === 'logo') {
        setLogoUri(result.assets[0].uri);
      } else {
        setFotos([...fotos, { uri: result.assets[0].uri }]);
      }
    }
  };

  const removeLogo = () => {
    setLogoUri(null);
    if (logoUrl) {
      // Marcar para eliminar al guardar
      setLogoUrl(null);
    }
  };

  const removeFoto = (index: number) => {
    const foto = fotos[index];
    if (foto.id && foto.url) {
      // Marcar para eliminar al guardar
      Alert.alert(
        'Eliminar foto',
        '¿Estás seguro de que deseas eliminar esta foto?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                if (foto.id) {
                  await deleteComplejoFoto(foto.id);
                }
                const newFotos = fotos.filter((_, i) => i !== index);
                setFotos(newFotos);
              } catch (error: any) {
                showError('Error', 'No se pudo eliminar la foto');
              }
            },
          },
        ]
      );
    } else {
      const newFotos = fotos.filter((_, i) => i !== index);
      setFotos(newFotos);
    }
  };

  const handleSavePress = () => {
    if (!nombre.trim()) {
      showError('Error', 'El nombre es requerido');
      return;
    }

    const lat = parseFloat(direccionLat);
    const lng = parseFloat(direccionLng);
    if (isNaN(lat) || isNaN(lng)) {
      showError('Error', 'Debes seleccionar una ubicación en el mapa');
      return;
    }

    if (!complejoId) {
      setAceptoTerminos(false);
      setShowTerminosModal(true);
      return;
    }

    void handleSave();
  };

  const handleAcceptTerminos = () => {
    if (!aceptoTerminos) {
      showError('Términos requeridos', 'Debés aceptar los términos y condiciones para continuar');
      return;
    }
    setShowTerminosModal(false);
    void handleSave();
  };

  const handleSave = async () => {
    // Validaciones
    if (!nombre.trim()) {
      showError('Error', 'El nombre es requerido');
      return;
    }

    // Las coordenadas son obligatorias
    const lat = parseFloat(direccionLat);
    const lng = parseFloat(direccionLng);
    if (isNaN(lat) || isNaN(lng)) {
      showError('Error', 'Debes seleccionar una ubicación en el mapa');
      return;
    }

    try {
      setLoading(true);

      let finalLogoUrl = logoUrl;

      // Subir logo si hay uno nuevo
      if (logoUri) {
        const timestamp = Date.now();
        const logoPath = `complejos/${complejoId || 'new'}/logo-${timestamp}.jpg`;
        finalLogoUrl = await uploadImage(logoUri, 'complejos', logoPath);
      }

      // Preparar datos del complejo
      // Las coordenadas son obligatorias, el texto es opcional
      const complejoData: any = {
        nombre: nombre.trim(),
        logo_url: finalLogoUrl,
        direccion_lat: parseFloat(direccionLat),
        direccion_lng: parseFloat(direccionLng),
        direccion_texto: direccionTexto.trim() || null, // Opcional
      };

      let savedComplejo;
      if (complejoId) {
        // Actualizar
        savedComplejo = await updateComplejo(complejoId, complejoData);
      } else {
        // Crear
        savedComplejo = await createComplejo(complejoData);
      }

      // Subir fotos nuevas
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        if (!foto.url && foto.uri) {
          const timestamp = Date.now();
          const fotoPath = `complejos/${savedComplejo.id}/fotos/${timestamp}-${i}.jpg`;
          const fotoUrl = await uploadImage(foto.uri, 'complejos', fotoPath);
          await addComplejoFoto(savedComplejo.id, fotoUrl, i);
        }
      }

      if (complejoId) {
        // Si estamos editando, volver al modo visualización
        setIsEditing(false);
        await loadComplejo(); // Recargar datos
        showSuccess('Éxito', 'Complejo actualizado correctamente');
      } else {
        // Si es nuevo, volver atrás
        showSuccess('Éxito', 'Complejo creado correctamente', () => router.back());
      }
    } catch (error: any) {
      console.error('Error al guardar complejo:', error);
      showError('Error', error.message || 'No se pudo guardar el complejo');
    } finally {
      setLoading(false);
    }
  };

  
  if (loadingData) {
    return (
      <Screen className="flex-1" edges={['top', 'bottom']}>
        <PlayerLoadingView />
      </Screen>
    );
  }

  // Vista de detalle (solo si hay complejoId)
  if (complejoId) {
    if (!complejoData) {
      return (
        <Screen className="flex-1" edges={['top', 'bottom']}>
          <PlayerLoadingView />
        </Screen>
      );
    }
    return (
      <Screen className="flex-1" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-md py-sm border-b">
          <TouchableOpacity onPress={() => router.back()} className="p-xs">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-lg font-bold flex-1 text-center">Detalle del Complejo</Text>
          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            className="p-xs"
          >
            <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Menú desplegable */}
        <RNModal
          {...rBackdrop}
          {...rModalAnimFade}
          isVisible={showMenu}
          onBackdropPress={() => setShowMenu(false)}
          onBackButtonPress={() => setShowMenu(false)}
          className="m-0 justify-end"
        >
          <View className="relative" pointerEvents="box-none">
            <View className="absolute top-12 right-md rounded-md border overflow-hidden z-50 min-w-[180px]">
              {complejoData.activo ? (
                <TouchableOpacity
                  className="flex-row items-center px-md py-md gap-sm border-b"
                  onPress={() => {
                    setShowMenu(false);
                    showError(
                      'Desactivar complejo',
                      `¿Estás seguro de que deseas desactivar el complejo "${complejoData.nombre}"? Los usuarios no podrán visualizar el complejo deportivo ni sus canchas, ni encontrarlo.`,
                      async () => {
                        try {
                          await toggleComplejoActivo(complejoData.id, false);
                          showSuccess('Éxito', 'Complejo desactivado correctamente');
                          await loadComplejo();
                        } catch (error: any) {
                          showError('Error', 'No se pudo desactivar el complejo');
                        }
                      },
                      () => {},
                      'Desactivar',
                      'Cancelar'
                    );
                  }}
                >
                  <Ionicons name="eye-off-outline" size={20} color={colors.error} />
                  <Text className={cn("text-md")} style={{ color: colors.error }}>
                    Desactivar Complejo
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="flex-row items-center px-md py-md gap-sm border-b"
                  onPress={() => {
                    setShowMenu(false);
                    showError(
                      'Activar complejo',
                      `¿Estás seguro de que deseas activar el complejo "${complejoData.nombre}"?`,
                      async () => {
                        try {
                          await toggleComplejoActivo(complejoData.id, true);
                          showSuccess('Éxito', 'Complejo activado correctamente');
                          await loadComplejo();
                        } catch (error: any) {
                          showError('Error', 'No se pudo activar el complejo');
                        }
                      },
                      () => {},
                      'Activar',
                      'Cancelar'
                    );
                  }}
                >
                  <Ionicons name="eye-outline" size={20} color={colors.success} />
                  <Text className={cn("text-md")} style={{ color: colors.success }}>
                    Activar Complejo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </RNModal>

        {/* Banner de estado activo/inactivo */}
        {complejoData.activo === false && (
          <View className="flex-row items-center p-md gap-sm">
            <Ionicons name="eye-off" size={24} color={colors.textInverse} />
            <Text className="text-md font-medium flex-1 text-text-inverse">
              Este complejo está inactivo. Los usuarios no podrán visualizarlo ni encontrarlo.
            </Text>
          </View>
        )}
        {complejoData.oculto && (
          <View className={cn("flex-row items-center p-md gap-sm")} style={{ backgroundColor: colors.error }}>
            <Ionicons name="alert-circle" size={24} color={colors.textInverse} />
            <Text className="text-md font-medium flex-1 text-text-inverse">
              Oculto por falta de pago de facturación. Regularizá tu pago en la pestaña Pagos para volver a aparecer en la app.
            </Text>
          </View>
        )}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-md"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
          {/* Logo Banner */}
          <View className="items-center mb-lg">
            {complejoData.logo_url ? (
              <TouchableOpacity
                onPress={() => setSelectedImage(complejoData.logo_url!)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: complejoData.logo_url }}
                  className="w-full h-[200px] rounded-lg"
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View className="w-full h-[200px] rounded-lg border-2 border-dashed justify-center items-center">
                <Ionicons name="business" size={64} color={colors.textSecondary} />
              </View>
            )}
            <View className="flex-row gap-sm mt-sm">
              <TouchableOpacity
                className="flex-row items-center px-md py-sm rounded-md border gap-xs"
                onPress={async () => {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    showError('Permisos', 'Se necesitan permisos para acceder a las imágenes');
                    return;
                  }

                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                  });

                  if (!result.canceled && result.assets[0]?.uri && complejoId) {
                    try {
                      setLoading(true);
                      const timestamp = Date.now();
                      const logoPath = `complejos/${complejoId}/logo-${timestamp}.jpg`;
                      const newLogoUrl = await uploadImage(result.assets[0].uri, 'complejos', logoPath);
                      await updateComplejo(complejoId, { logo_url: newLogoUrl });
                      await loadComplejo();
                      showSuccess('Éxito', 'Logo actualizado correctamente');
                    } catch (error: any) {
                      showError('Error', 'No se pudo actualizar el logo');
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
              >
                <Ionicons name="camera-outline" size={20} color={colors.textInverse} />
              </TouchableOpacity>
              {complejoData.logo_url && (
                <TouchableOpacity
                  className={cn("flex-row items-center px-md py-sm rounded-md border gap-xs", "border-error")}
                  onPress={() => {
                    showError(
                      'Eliminar logo',
                      '¿Estás seguro de que deseas eliminar el logo del complejo?',
                      async () => {
                        try {
                          setLogoUri(null);
                          setLogoUrl(null);
                          // Actualizar el complejo sin logo
                          await updateComplejo(complejoId!, { logo_url: undefined });
                          await loadComplejo();
                          showSuccess('Éxito', 'Logo eliminado correctamente');
                        } catch (error: any) {
                          showError('Error', 'No se pudo eliminar el logo');
                        }
                      },
                      () => {},
                      'Eliminar',
                      'Cancelar'
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.textInverse} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Nombre */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">Nombre</Text>
              {!isEditingNombre ? (
                <TouchableOpacity
                  onPress={() => {
                    setNombreTemp(complejoData.nombre);
                    setIsEditingNombre(true);
                  }}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={async () => {
                      if (!nombreTemp.trim()) {
                        showError('Error', 'El nombre no puede estar vacío');
                        return;
                      }
                      try {
                        setLoading(true);
                        await updateComplejo(complejoId!, { nombre: nombreTemp.trim() });
                        await loadComplejo();
                        setIsEditingNombre(false);
                        showSuccess('Éxito', 'Nombre actualizado correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo actualizar el nombre');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingNombre(false);
                      setNombreTemp('');
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingNombre ? (
              <TextInput
                className="text-lg font-semibold border rounded-md p-md"
                value={nombreTemp}
                onChangeText={setNombreTemp}
                placeholder="Nombre del complejo"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            ) : (
              <Text className="text-lg font-semibold">{complejoData.nombre}</Text>
            )}
          </View>

          {/* Dirección */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">Dirección</Text>
              {!isEditingDireccion ? (
                <TouchableOpacity
                  onPress={() => {
                    setDireccionTemp(complejoData.direccion_texto || '');
                    setIsEditingDireccion(true);
                  }}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        setLoading(true);
                        await updateComplejo(complejoId!, { 
                          direccion_texto: direccionTemp.trim() || undefined 
                        });
                        await loadComplejo();
                        setIsEditingDireccion(false);
                        showSuccess('Éxito', 'Dirección actualizada correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo actualizar la dirección');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingDireccion(false);
                      setDireccionTemp('');
                    }}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingDireccion ? (
              <TextInput
                className="text-lg font-semibold border rounded-md p-md"
                value={direccionTemp}
                onChangeText={setDireccionTemp}
                placeholder="Dirección del complejo (opcional)"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                multiline
                numberOfLines={2}
              />
            ) : complejoData.direccion_texto ? (
              <View className="flex-row items-start gap-sm">
                <Ionicons name="location-outline" size={20} color={colors.primary} />
                <Text className="flex-1 text-md">{complejoData.direccion_texto}</Text>
              </View>
            ) : (
              <Text className="text-md italic mt-xs">Sin dirección</Text>
            )}
          </View>

          {/* Mapa */}
          {complejoData.direccion_lat && complejoData.direccion_lng && (
            <View className="mb-lg">
              <View className="flex-row justify-between items-center mb-xs">
                <Text className="text-xs uppercase tracking-wide mb-xs">Ubicación</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditingUbicacion(true);
                    setShowLocationPicker(true);
                  }}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View className="h-[200px] rounded-md overflow-hidden mb-sm">
                {Platform.OS === 'android' ? (
                  <GoogleMaps.View
                    style={{ width: "100%", height: "100%" }}
                    cameraPosition={{
                      coordinates: {
                        latitude: complejoData.direccion_lat,
                        longitude: complejoData.direccion_lng,
                      },
                      zoom: 15,
                    }}
                    properties={{
                      mapType: GoogleMaps.MapType.NORMAL,
                    }}
                    markers={[
                      {
                        id: 'complejo-location',
                        coordinates: {
                          latitude: complejoData.direccion_lat,
                          longitude: complejoData.direccion_lng,
                        },
                      },
                    ]}
                  />
                ) : (
                  <AppleMaps.View
                    style={{ width: "100%", height: "100%" }}
                    cameraPosition={{
                      coordinates: {
                        latitude: complejoData.direccion_lat,
                        longitude: complejoData.direccion_lng,
                      },
                      zoom: 15,
                    }}
                    properties={{
                      mapType: AppleMaps.MapType.STANDARD,
                    }}
                    markers={[
                      {
                        id: 'complejo-location',
                        coordinates: {
                          latitude: complejoData.direccion_lat,
                          longitude: complejoData.direccion_lng,
                        },
                      },
                    ]}
                  />
                )}
              </View>
            </View>
          )}

          {/* Fotos */}
          <View className="mb-lg">
            <View className="flex-row justify-between items-center mb-xs">
              <Text className="text-xs uppercase tracking-wide mb-xs">
                Fotos ({complejoData.fotos?.length || 0})
              </Text>
              {!isEditingFotos ? (
                <TouchableOpacity
                  onPress={() => setIsEditingFotos(true)}
                  className="p-xs"
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-xs">
                  <TouchableOpacity
                    onPress={() => setIsEditingFotos(false)}
                    className="p-xs"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsEditingFotos(false)}
                    className="p-xs"
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-sm"
            >
              {complejoData.fotos && complejoData.fotos.length > 0 ? (
                complejoData.fotos.map((foto, index) => (
                  <View key={foto.id || index} className="relative mr-sm">
                    <TouchableOpacity
                      onPress={() => setSelectedImage(foto.foto_url)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: foto.foto_url }}
                        className="w-[150px] h-[150px] rounded-md"
                      />
                    </TouchableOpacity>
                    {isEditingFotos && (
                      <TouchableOpacity
                        className="absolute -top-2 -right-2 rounded-full z-10"
                        onPress={async () => {
                            showError(
                              'Eliminar foto',
                              '¿Estás seguro de que deseas eliminar esta foto?',
                              async () => {
                                try {
                                  setLoading(true);
                                  if (foto.id) {
                                    await deleteComplejoFoto(foto.id);
                                    await loadComplejo();
                                    showSuccess('Éxito', 'Foto eliminada correctamente');
                                  }
                                } catch (error: any) {
                                  showError('Error', 'No se pudo eliminar la foto');
                                } finally {
                                  setLoading(false);
                                }
                              },
                              () => {},
                              'Eliminar',
                              'Cancelar'
                            );
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text className="text-md italic mt-xs">Sin fotos</Text>
              )}
              {isEditingFotos && (
                <TouchableOpacity
                  className="w-[150px] h-[150px] rounded-md border-2 border-dashed justify-center items-center"
                  onPress={async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                      showError('Permisos', 'Se necesitan permisos para acceder a las imágenes');
                      return;
                    }

                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ['images'],
                      allowsEditing: true,
                      aspect: [4, 3],
                      quality: 0.8,
                    });

                    if (!result.canceled && result.assets[0]?.uri && complejoId) {
                      try {
                        setLoading(true);
                        const timestamp = Date.now();
                        const fotoPath = `complejos/${complejoId}/fotos/${timestamp}.jpg`;
                        const fotoUrl = await uploadImage(result.assets[0].uri, 'complejos', fotoPath);
                        const orden = complejoData.fotos?.length || 0;
                        await addComplejoFoto(complejoId, fotoUrl, orden);
                        await loadComplejo();
                        showSuccess('Éxito', 'Foto agregada correctamente');
                      } catch (error: any) {
                        showError('Error', 'No se pudo agregar la foto');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                >
                  <Ionicons name="add" size={32} color={colors.textSecondary} />
                  <Text className="text-xs mt-xs">Agregar</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal de vista de imagen */}
        <RNModal
          {...rBackdrop}
          backdropOpacity={0.92}
          {...rModalAnimFade}
          isVisible={selectedImage !== null}
          onBackdropPress={() => setSelectedImage(null)}
          onBackButtonPress={() => setSelectedImage(null)}
          className="m-0 justify-center items-center"
        >
          <View className="flex-1 justify-center items-center">
            <TouchableOpacity
              className="absolute top-[50px] right-5 z-10 rounded-full w-10 h-10 justify-center items-center"
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={32} color={colors.textInverse} />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            )}
          </View>
        </RNModal>

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

        {showLocationPicker && (
          <LocationPicker
            initialLat={
              isEditingUbicacion && complejoData?.direccion_lat
                ? complejoData.direccion_lat
                : undefined
            }
            initialLng={
              isEditingUbicacion && complejoData?.direccion_lng
                ? complejoData.direccion_lng
                : undefined
            }
            onLocationSelect={async (lat, lng) => {
              if (isEditingUbicacion && complejoId) {
                // Si estamos editando desde la vista de detalle, actualizar directamente
                try {
                  setLoading(true);
                  await updateComplejo(complejoId, {
                    direccion_lat: lat,
                    direccion_lng: lng,
                  });
                  await loadComplejo();
                  setIsEditingUbicacion(false);
                  setShowLocationPicker(false);
                  showSuccess('Éxito', 'Ubicación actualizada correctamente');
                } catch (error: any) {
                  showError('Error', 'No se pudo actualizar la ubicación');
                } finally {
                  setLoading(false);
                }
              }
            }}
            onCancel={() => {
              setIsEditingUbicacion(false);
              setShowLocationPicker(false);
            }}
          />
        )}
      </Screen>
    );
  }

  // Vista de creación (solo cuando no hay complejoId)
  if (!complejoId) {
    return (
      <Screen className="flex-1" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-md py-sm border-b">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-xs"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-lg font-bold flex-1 text-center">Nuevo Complejo</Text>
        <TouchableOpacity
          onPress={handleSavePress}
          disabled={loading}
          className="px-md py-sm rounded-md"
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text className="text-md font-semibold text-text-inverse">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Banner de estado activo/inactivo (solo en edición) */}
      {complejoId && complejoData && !complejoData.activo && (
        <View className="flex-row items-center p-md gap-sm">
          <Ionicons name="eye-off" size={24} color={colors.textInverse} />
          <Text className="text-md font-medium flex-1 text-text-inverse">
            Este complejo está inactivo. Los usuarios no podrán visualizarlo ni encontrarlo.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="automatic"
        >
        {/* Estado activo/inactivo */}
        {complejoId && complejoData && (
          <View className="mb-lg">
            <Text className="text-sm font-medium mb-xs">Estado</Text>
            <View className="flex-row items-center mb-md">
              <View
                className={cn("px-sm py-xs rounded-sm", complejoData.activo ? "bg-success/20" : "bg-error/20")}
              >
                <Ionicons
                  name={complejoData.activo ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={complejoData.activo ? colors.success : colors.error}
                />
                <Text
                  className={cn("text-xs font-semibold", complejoData.activo ? "text-success" : "text-error")}
                >
                  {complejoData.activo ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Nombre */}
        <View className="mb-lg">
          <Text className="text-sm font-medium mb-xs">Nombre *</Text>
          <TextInput
            className="border rounded-md px-sm py-sm text-md"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del complejo"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        {/* Logo */}
        <View className="mb-lg">
          <Text className="text-sm font-medium mb-xs">Logo (opcional)</Text>
          <View className="items-center">
            {(logoUri || logoUrl) ? (
              <View className="relative w-[120px] h-[120px] rounded-md overflow-hidden">
                <Image
                  source={{ uri: logoUri || logoUrl || '' }}
                  style={{ width: "100%", height: "100%" }}
                />
                <TouchableOpacity
                  className="absolute top-xs right-xs rounded-full"
                  onPress={removeLogo}
                >
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                className="w-[120px] h-[120px] rounded-md border-2 border-dashed justify-center items-center"
                onPress={() => pickImage('logo')}
              >
                <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                <Text className="text-xs mt-xs">Agregar logo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Ubicación (coordenadas obligatorias) */}
        <View className="mb-lg">
          <Text className="text-sm font-medium mb-xs">Ubicación *</Text>
          <TouchableOpacity
            className="flex-row items-center p-md rounded-md border"
            onPress={() => setShowLocationPicker(true)}
          >
            <Ionicons name="map" size={24} color={colors.primary} />
            <View className="flex-1 ml-sm">
              <Text className="text-md font-medium">
                {direccionLat && direccionLng
                  ? 'Ubicación seleccionada'
                  : 'Seleccionar ubicación en el mapa'}
              </Text>
              <Text className="text-xs mt-0.5">
                Toca para abrir Google Maps
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Dirección de texto (opcional) */}
        <View className="mb-lg">
          <Text className="text-sm font-medium mb-xs">Dirección (opcional)</Text>
          <TextInput
            className="border rounded-md px-sm py-sm text-md"
            value={direccionTexto}
            onChangeText={setDireccionTexto}
            placeholder="Ej: Av. Principal 123, Santiago"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </View>

        {/* Fotos */}
        <View className="mb-lg">
          <Text className="text-sm font-medium mb-xs">Fotos (opcional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-sm">
            {fotos.map((foto, index) => (
              <View key={index} className="relative mr-sm">
                <TouchableOpacity
                  onPress={() => setSelectedImage(foto.uri || foto.url || '')}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: foto.uri || foto.url || '' }} className="w-[100px] h-[100px] rounded-md" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="absolute -top-2 -right-2 rounded-full"
                  onPress={() => removeFoto(index)}
                >
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              className="w-[100px] h-[100px] rounded-md border-2 border-dashed justify-center items-center"
              onPress={() => pickImage('foto')}
            >
              <Ionicons name="add" size={32} color={colors.textSecondary} />
              <Text className="text-xs mt-xs">Agregar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>
        </KeyboardAvoidingView>

      <RNModal
        {...rBackdrop}
        {...rModalAnimFade}
        isVisible={showTerminosModal}
        onBackdropPress={() => setShowTerminosModal(false)}
        onBackButtonPress={() => setShowTerminosModal(false)}
        className="m-0 justify-center px-md"
      >
        <View className="rounded-lg overflow-hidden max-h-[85%]">
          <Text className="text-lg font-bold p-md border-b">{TERMINOS_PAGOS_COMPLEJO_TITULO}</Text>
          <ScrollView className="max-h-[300px] p-md" showsVerticalScrollIndicator>
            <Text className="text-sm leading-5">{TERMINOS_PAGOS_COMPLEJO_TEXTO}</Text>
          </ScrollView>
          <TouchableOpacity
            className="flex-row items-center p-md gap-sm border-t"
            onPress={() => setAceptoTerminos((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={aceptoTerminos ? 'checkbox' : 'square-outline'}
              size={24}
              color={aceptoTerminos ? colors.primary : colors.textSecondary}
            />
            <Text className="flex-1 text-sm">Acepto los términos y condiciones</Text>
          </TouchableOpacity>
          <View className="flex-row p-md gap-sm border-t">
            <TouchableOpacity
              className={cn("flex-1 p-md rounded-md items-center", "border")}
              onPress={() => setShowTerminosModal(false)}
            >
              <Text className="text-md font-semibold">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={cn("flex-1 p-md rounded-md items-center", "bg-primary", "!aceptoTerminos && 'opacity-50'")}
              onPress={handleAcceptTerminos}
              disabled={!aceptoTerminos || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text className="text-md font-semibold text-text-inverse">Continuar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>

      {/* Modal de vista de imagen */}
      <RNModal
        {...rBackdrop}
        backdropOpacity={0.92}
        {...rModalAnimFade}
        isVisible={selectedImage !== null}
        onBackdropPress={() => setSelectedImage(null)}
        onBackButtonPress={() => setSelectedImage(null)}
        className="m-0 justify-center items-center"
      >
        <View className="flex-1 justify-center items-center">
          <TouchableOpacity
            className="absolute top-[50px] right-5 z-10 rounded-full w-10 h-10 justify-center items-center"
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color={colors.textInverse} />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          )}
        </View>
      </RNModal>

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

      {showLocationPicker && (
        <LocationPicker
          initialLat={
            isEditingUbicacion && complejoData?.direccion_lat
              ? complejoData.direccion_lat
              : direccionLat
              ? parseFloat(direccionLat)
              : undefined
          }
          initialLng={
            isEditingUbicacion && complejoData?.direccion_lng
              ? complejoData.direccion_lng
              : direccionLng
              ? parseFloat(direccionLng)
              : undefined
          }
          onLocationSelect={async (lat, lng) => {
            if (isEditingUbicacion && complejoId) {
              // Si estamos editando desde la vista de detalle, actualizar directamente
              try {
                setLoading(true);
                await updateComplejo(complejoId, {
                  direccion_lat: lat,
                  direccion_lng: lng,
                });
                await loadComplejo();
                setIsEditingUbicacion(false);
                setShowLocationPicker(false);
                showSuccess('Éxito', 'Ubicación actualizada correctamente');
              } catch (error: any) {
                showError('Error', 'No se pudo actualizar la ubicación');
              } finally {
                setLoading(false);
              }
            } else {
              // Si estamos en modo de edición completo, solo actualizar los estados
              setDireccionLat(lat.toString());
              setDireccionLng(lng.toString());
              setShowLocationPicker(false);
            }
          }}
          onCancel={() => {
            setIsEditingUbicacion(false);
            setShowLocationPicker(false);
          }}
        />
      )}
    </Screen>
    );
  }

  // Si llegamos aquí, no debería pasar (solo para casos edge)
  return null;
}

