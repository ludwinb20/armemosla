import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../constants/theme';
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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <PlayerLoadingView style={styles.loadingContainer} />
      </SafeAreaView>
    );
  }

  // Vista de detalle (solo si hay complejoId)
  if (complejoId) {
    if (!complejoData) {
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <PlayerLoadingView style={styles.loadingContainer} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle del Complejo</Text>
          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            style={styles.menuButton}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Menú desplegable */}
        <RNModal
          {...rBackdrop}
          {...rModalAnimFade}
          isVisible={showMenu}
          onBackdropPress={() => setShowMenu(false)}
          onBackButtonPress={() => setShowMenu(false)}
          style={styles.menuRNModalRoot}
        >
          <View style={styles.menuAnchor} pointerEvents="box-none">
            <View style={styles.menuContainer}>
              {complejoData.activo ? (
                <TouchableOpacity
                  style={styles.menuItem}
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
                  <Ionicons name="eye-off-outline" size={20} color={Colors.error} />
                  <Text style={[styles.menuItemText, { color: Colors.error }]}>
                    Desactivar Complejo
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.menuItem}
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
                  <Ionicons name="eye-outline" size={20} color={Colors.success} />
                  <Text style={[styles.menuItemText, { color: Colors.success }]}>
                    Activar Complejo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </RNModal>

        {/* Banner de estado activo/inactivo */}
        {complejoData.activo === false && (
          <View style={styles.inactiveBanner}>
            <Ionicons name="eye-off" size={24} color={Colors.textInverse} />
            <Text style={styles.inactiveBannerText}>
              Este complejo está inactivo. Los usuarios no podrán visualizarlo ni encontrarlo.
            </Text>
          </View>
        )}
        {complejoData.oculto && (
          <View style={[styles.inactiveBanner, { backgroundColor: Colors.error }]}>
            <Ionicons name="alert-circle" size={24} color={Colors.textInverse} />
            <Text style={styles.inactiveBannerText}>
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
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
          {/* Logo Banner */}
          <View style={styles.detailLogoBannerContainer}>
            {complejoData.logo_url ? (
              <TouchableOpacity
                onPress={() => setSelectedImage(complejoData.logo_url!)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: complejoData.logo_url }}
                  style={styles.detailLogoBanner}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.detailLogoBannerPlaceholder}>
                <Ionicons name="business" size={64} color={Colors.textSecondary} />
              </View>
            )}
            <View style={styles.detailLogoBannerActions}>
              <TouchableOpacity
                style={styles.detailLogoBannerButton}
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
                <Ionicons name="camera-outline" size={20} color={Colors.textInverse} />
              </TouchableOpacity>
              {complejoData.logo_url && (
                <TouchableOpacity
                  style={[styles.detailLogoBannerButton, styles.detailLogoBannerButtonDanger]}
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
                  <Ionicons name="trash-outline" size={20} color={Colors.textInverse} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Nombre */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>Nombre</Text>
              {!isEditingNombre ? (
                <TouchableOpacity
                  onPress={() => {
                    setNombreTemp(complejoData.nombre);
                    setIsEditingNombre(true);
                  }}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
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
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingNombre(false);
                      setNombreTemp('');
                    }}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingNombre ? (
              <TextInput
                style={styles.detailInput}
                value={nombreTemp}
                onChangeText={setNombreTemp}
                placeholder="Nombre del complejo"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
              />
            ) : (
              <Text style={styles.detailValue}>{complejoData.nombre}</Text>
            )}
          </View>

          {/* Dirección */}
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>Dirección</Text>
              {!isEditingDireccion ? (
                <TouchableOpacity
                  onPress={() => {
                    setDireccionTemp(complejoData.direccion_texto || '');
                    setIsEditingDireccion(true);
                  }}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
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
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingDireccion(false);
                      setDireccionTemp('');
                    }}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {isEditingDireccion ? (
              <TextInput
                style={styles.detailInput}
                value={direccionTemp}
                onChangeText={setDireccionTemp}
                placeholder="Dirección del complejo (opcional)"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
                multiline
                numberOfLines={2}
              />
            ) : complejoData.direccion_texto ? (
              <View style={styles.detailAddressRow}>
                <Ionicons name="location-outline" size={20} color={Colors.primary} />
                <Text style={styles.detailAddressText}>{complejoData.direccion_texto}</Text>
              </View>
            ) : (
              <Text style={styles.detailValueSecondary}>Sin dirección</Text>
            )}
          </View>

          {/* Mapa */}
          {complejoData.direccion_lat && complejoData.direccion_lng && (
            <View style={styles.detailSection}>
              <View style={styles.detailLabelRow}>
                <Text style={styles.detailLabel}>Ubicación</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditingUbicacion(true);
                    setShowLocationPicker(true);
                  }}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.detailMapContainer}>
                {Platform.OS === 'android' ? (
                  <GoogleMaps.View
                    style={styles.detailMap}
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
                    style={styles.detailMap}
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
          <View style={styles.detailSection}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.detailLabel}>
                Fotos ({complejoData.fotos?.length || 0})
              </Text>
              {!isEditingFotos ? (
                <TouchableOpacity
                  onPress={() => setIsEditingFotos(true)}
                  style={styles.detailEditIconButton}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.detailEditActions}>
                  <TouchableOpacity
                    onPress={() => setIsEditingFotos(false)}
                    style={styles.detailSaveButton}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsEditingFotos(false)}
                    style={styles.detailCancelButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.detailFotosContainer}
            >
              {complejoData.fotos && complejoData.fotos.length > 0 ? (
                complejoData.fotos.map((foto, index) => (
                  <View key={foto.id || index} style={styles.detailFotoItem}>
                    <TouchableOpacity
                      onPress={() => setSelectedImage(foto.foto_url)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: foto.foto_url }}
                        style={styles.detailFoto}
                      />
                    </TouchableOpacity>
                    {isEditingFotos && (
                      <TouchableOpacity
                        style={styles.detailFotoRemoveButton}
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
                        <Ionicons name="close-circle" size={24} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.detailValueSecondary}>Sin fotos</Text>
              )}
              {isEditingFotos && (
                <TouchableOpacity
                  style={styles.detailFotoAddButton}
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
                  <Ionicons name="add" size={32} color={Colors.textSecondary} />
                  <Text style={styles.detailFotoAddText}>Agregar</Text>
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
          style={styles.imageRNModalRoot}
        >
          <View style={styles.imageModalContainer}>
            <TouchableOpacity
              style={styles.imageModalCloseButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={32} color={Colors.textInverse} />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.imageModalImage}
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
      </SafeAreaView>
    );
  }

  // Vista de creación (solo cuando no hay complejoId)
  if (!complejoId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuevo Complejo</Text>
        <TouchableOpacity
          onPress={handleSavePress}
          disabled={loading}
          style={styles.saveButton}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveButtonText}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Banner de estado activo/inactivo (solo en edición) */}
      {complejoId && complejoData && !complejoData.activo && (
        <View style={styles.inactiveBanner}>
          <Ionicons name="eye-off" size={24} color={Colors.textInverse} />
          <Text style={styles.inactiveBannerText}>
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
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="automatic"
        >
        {/* Estado activo/inactivo */}
        {complejoId && complejoData && (
          <View style={styles.section}>
            <Text style={styles.label}>Estado</Text>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusBadge,
                  complejoData.activo ? styles.statusBadgeActive : styles.statusBadgeInactive,
                ]}
              >
                <Ionicons
                  name={complejoData.activo ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={complejoData.activo ? Colors.success : Colors.error}
                />
                <Text
                  style={[
                    styles.statusText,
                    complejoData.activo ? styles.statusTextActive : styles.statusTextInactive,
                  ]}
                >
                  {complejoData.activo ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Nombre */}
        <View style={styles.section}>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del complejo"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {/* Logo */}
        <View style={styles.section}>
          <Text style={styles.label}>Logo (opcional)</Text>
          <View style={styles.logoContainer}>
            {(logoUri || logoUrl) ? (
              <View style={styles.logoPreview}>
                <Image
                  source={{ uri: logoUri || logoUrl || '' }}
                  style={styles.logoImage}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={removeLogo}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.logoPlaceholder}
                onPress={() => pickImage('logo')}
              >
                <Ionicons name="image-outline" size={32} color={Colors.textSecondary} />
                <Text style={styles.logoPlaceholderText}>Agregar logo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Ubicación (coordenadas obligatorias) */}
        <View style={styles.section}>
          <Text style={styles.label}>Ubicación *</Text>
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => setShowLocationPicker(true)}
          >
            <Ionicons name="map" size={24} color={Colors.primary} />
            <View style={styles.mapButtonTextContainer}>
              <Text style={styles.mapButtonText}>
                {direccionLat && direccionLng
                  ? 'Ubicación seleccionada'
                  : 'Seleccionar ubicación en el mapa'}
              </Text>
              <Text style={styles.mapButtonSubtext}>
                Toca para abrir Google Maps
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Dirección de texto (opcional) */}
        <View style={styles.section}>
          <Text style={styles.label}>Dirección (opcional)</Text>
          <TextInput
            style={styles.input}
            value={direccionTexto}
            onChangeText={setDireccionTexto}
            placeholder="Ej: Av. Principal 123, Santiago"
            placeholderTextColor={Colors.textTertiary}
            multiline
          />
        </View>

        {/* Fotos */}
        <View style={styles.section}>
          <Text style={styles.label}>Fotos (opcional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosContainer}>
            {fotos.map((foto, index) => (
              <View key={index} style={styles.fotoItem}>
                <TouchableOpacity
                  onPress={() => setSelectedImage(foto.uri || foto.url || '')}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: foto.uri || foto.url || '' }} style={styles.fotoImage} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fotoRemoveButton}
                  onPress={() => removeFoto(index)}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.fotoAddButton}
              onPress={() => pickImage('foto')}
            >
              <Ionicons name="add" size={32} color={Colors.textSecondary} />
              <Text style={styles.fotoAddText}>Agregar</Text>
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
        style={styles.terminosModalRoot}
      >
        <View style={styles.terminosModalCard}>
          <Text style={styles.terminosModalTitle}>{TERMINOS_PAGOS_COMPLEJO_TITULO}</Text>
          <ScrollView style={styles.terminosScroll} showsVerticalScrollIndicator>
            <Text style={styles.terminosTexto}>{TERMINOS_PAGOS_COMPLEJO_TEXTO}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.terminosCheckRow}
            onPress={() => setAceptoTerminos((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={aceptoTerminos ? 'checkbox' : 'square-outline'}
              size={24}
              color={aceptoTerminos ? Colors.primary : Colors.textSecondary}
            />
            <Text style={styles.terminosCheckLabel}>Acepto los términos y condiciones</Text>
          </TouchableOpacity>
          <View style={styles.terminosActions}>
            <TouchableOpacity
              style={[styles.terminosButton, styles.terminosButtonSecondary]}
              onPress={() => setShowTerminosModal(false)}
            >
              <Text style={styles.terminosButtonSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.terminosButton, styles.terminosButtonPrimary, !aceptoTerminos && styles.terminosButtonDisabled]}
              onPress={handleAcceptTerminos}
              disabled={!aceptoTerminos || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <Text style={styles.terminosButtonPrimaryText}>Continuar</Text>
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
        style={styles.imageRNModalRoot}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color={Colors.textInverse} />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.imageModalImage}
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
    </SafeAreaView>
    );
  }

  // Si llegamos aquí, no debería pasar (solo para casos edge)
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  saveButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  saveButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },
  editButton: {
    padding: Spacing.xs,
  },
  menuButton: {
    padding: Spacing.xs,
  },
  menuRNModalRoot: {
    flex: 1,
    margin: 0,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: Spacing.md,
  },
  menuAnchor: {
    alignItems: 'flex-end',
  },
  menuContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    minWidth: 200,
    ...Shadows.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuItemText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  detailSection: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.md
  },
  detailLogoBannerContainer: {
    position: 'relative',
    width: '100%',
  },
  detailLogoBanner: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.borderLight,
  },
  detailLogoBannerPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLogoBannerActions: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  detailLogoBannerButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLogoBannerButtonDanger: {
    backgroundColor: 'rgba(220, 38, 38, 0.8)',
  },
  detailLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  detailLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  detailEditIconButton: {
    padding: Spacing.xs,
  },
  detailEditActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  detailSaveButton: {
    padding: Spacing.xs,
  },
  detailCancelButton: {
    padding: Spacing.xs,
  },
  detailInput: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  detailValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
  },
  detailValueSecondary: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  detailAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  detailAddressText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  detailFotosContainer: {
    marginTop: Spacing.sm,
  },
  detailFotoItem: {
    position: 'relative',
    marginRight: Spacing.sm,
  },
  detailFoto: {
    width: 150,
    height: 150,
    borderRadius: BorderRadius.md,
  },
  detailFotoRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    zIndex: 1,
  },
  detailFotoAddButton: {
    width: 150,
    height: 150,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  detailFotoAddText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  detailActionsContainer: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  detailEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  detailEditButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
    marginLeft: Spacing.xs,
  },
  detailDeactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.error,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  detailDeactivateButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.error,
    marginLeft: Spacing.xs,
  },
  detailActivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  detailActivateButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
    marginLeft: Spacing.xs,
  },
  inactiveBanner: {
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  inactiveBannerText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
  terminosModalRoot: {
    justifyContent: 'center',
    marginHorizontal: Spacing.md,
  },
  terminosModalCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  terminosModalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  terminosScroll: {
    maxHeight: 320,
    marginBottom: Spacing.md,
  },
  terminosTexto: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  terminosCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  terminosCheckLabel: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
    fontWeight: Typography.fontWeight.medium,
  },
  terminosActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  terminosButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  terminosButtonSecondary: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  terminosButtonSecondaryText: {
    color: Colors.text,
    fontWeight: Typography.fontWeight.medium,
  },
  terminosButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  terminosButtonDisabled: {
    opacity: 0.5,
  },
  terminosButtonPrimaryText: {
    color: Colors.textInverse,
    fontWeight: Typography.fontWeight.semibold,
  },
  statusContainer: {
    marginTop: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  statusBadgeActive: {
    backgroundColor: Colors.success + '20',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  statusBadgeInactive: {
    backgroundColor: Colors.error + '20',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  statusText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  statusTextActive: {
    color: Colors.success,
  },
  statusTextInactive: {
    color: Colors.error,
  },
  detailMapContainer: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  detailMap: {
    width: '100%',
    height: 200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.md,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoPreview: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  logoPlaceholderText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  direccionModeSelector: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeButtonText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  modeButtonTextActive: {
    color: Colors.textInverse,
  },
  coordenadasContainer: {
    gap: Spacing.sm,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  mapButtonTextContainer: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  mapButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text,
    fontWeight: Typography.fontWeight.medium,
  },
  mapButtonSubtext: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clearCoordinatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  clearCoordinatesText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
    marginLeft: Spacing.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  fotosContainer: {
    marginTop: Spacing.sm,
  },
  fotoItem: {
    position: 'relative',
    marginRight: Spacing.sm,
  },
  fotoImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  fotoRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  fotoAddButton: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  fotoAddText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  imageRNModalRoot: {
    flex: 1,
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

