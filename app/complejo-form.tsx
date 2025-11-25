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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../constants/theme';
import {
  getComplejoById,
  createComplejo,
  updateComplejo,
  addComplejoFoto,
  deleteComplejoFoto,
  ComplejoWithFotos,
} from '../lib/complejos';
import { uploadImage, deleteImage, extractPathFromUrl } from '../lib/storage';
import { useCustomAlert } from '../hooks/useCustomAlert';
import CustomAlert from '../components/CustomAlert';
import LocationPicker from '../components/LocationPicker';

type DireccionMode = 'texto' | 'coordenadas';

export default function ComplejoFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const complejoId = params.id as string | undefined;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!complejoId);
  const [nombre, setNombre] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [direccionMode, setDireccionMode] = useState<DireccionMode>('texto');
  const [direccionTexto, setDireccionTexto] = useState('');
  const [direccionLat, setDireccionLat] = useState('');
  const [direccionLng, setDireccionLng] = useState('');
  const [fotos, setFotos] = useState<Array<{ uri: string; url?: string; id?: string }>>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const { alertVisible, alertOptions, showError, showSuccess, hideAlert, handleConfirm } = useCustomAlert();

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
        setNombre(complejo.nombre);
        setLogoUrl(complejo.logo_url || null);
        if (complejo.direccion_texto) {
          setDireccionMode('texto');
          setDireccionTexto(complejo.direccion_texto);
        } else if (complejo.direccion_lat && complejo.direccion_lng) {
          setDireccionMode('coordenadas');
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

  const handleSave = async () => {
    // Validaciones
    if (!nombre.trim()) {
      showError('Error', 'El nombre es requerido');
      return;
    }

    if (direccionMode === 'texto' && !direccionTexto.trim()) {
      showError('Error', 'La dirección en texto es requerida');
      return;
    }

    if (direccionMode === 'coordenadas') {
      const lat = parseFloat(direccionLat);
      const lng = parseFloat(direccionLng);
      if (isNaN(lat) || isNaN(lng)) {
        showError('Error', 'Las coordenadas deben ser números válidos');
        return;
      }
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
      const complejoData: any = {
        nombre: nombre.trim(),
        logo_url: finalLogoUrl,
      };

      if (direccionMode === 'texto') {
        complejoData.direccion_texto = direccionTexto.trim();
        complejoData.direccion_lat = null;
        complejoData.direccion_lng = null;
      } else {
        complejoData.direccion_texto = null;
        complejoData.direccion_lat = parseFloat(direccionLat);
        complejoData.direccion_lng = parseFloat(direccionLng);
      }

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

      showSuccess(
        'Éxito',
        complejoId ? 'Complejo actualizado correctamente' : 'Complejo creado correctamente',
        () => router.back()
      );
    } catch (error: any) {
      console.error('Error al guardar complejo:', error);
      showError('Error', error.message || 'No se pudo guardar el complejo');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {complejoId ? 'Editar Complejo' : 'Nuevo Complejo'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Dirección */}
        <View style={styles.section}>
          <Text style={styles.label}>Dirección *</Text>
          <View style={styles.direccionModeSelector}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                direccionMode === 'texto' && styles.modeButtonActive,
              ]}
              onPress={() => setDireccionMode('texto')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  direccionMode === 'texto' && styles.modeButtonTextActive,
                ]}
              >
                Texto
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                direccionMode === 'coordenadas' && styles.modeButtonActive,
              ]}
              onPress={() => setDireccionMode('coordenadas')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  direccionMode === 'coordenadas' && styles.modeButtonTextActive,
                ]}
              >
                Coordenadas
              </Text>
            </TouchableOpacity>
          </View>

          {direccionMode === 'texto' ? (
            <TextInput
              style={styles.input}
              value={direccionTexto}
              onChangeText={setDireccionTexto}
              placeholder="Ej: Av. Principal 123, Santiago"
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
          ) : (
            <View style={styles.coordenadasContainer}>
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => setShowLocationPicker(true)}
              >
                <Ionicons name="map" size={24} color={Colors.primary} />
                <View style={styles.mapButtonTextContainer}>
                  <Text style={styles.mapButtonText}>
                    {direccionLat && direccionLng
                      ? `Coordenadas: ${direccionLat}, ${direccionLng}`
                      : 'Seleccionar ubicación en el mapa'}
                  </Text>
                  <Text style={styles.mapButtonSubtext}>
                    Toca para abrir Google Maps
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              {direccionLat && direccionLng && (
                <TouchableOpacity
                  style={styles.clearCoordinatesButton}
                  onPress={() => {
                    setDireccionLat('');
                    setDireccionLng('');
                  }}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.error} />
                  <Text style={styles.clearCoordinatesText}>Limpiar coordenadas</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Fotos */}
        <View style={styles.section}>
          <Text style={styles.label}>Fotos (opcional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosContainer}>
            {fotos.map((foto, index) => (
              <View key={index} style={styles.fotoItem}>
                <Image source={{ uri: foto.uri || foto.url || '' }} style={styles.fotoImage} />
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

      <CustomAlert
        visible={alertVisible}
        title={alertOptions.title}
        message={alertOptions.message}
        type={alertOptions.type}
        confirmText={alertOptions.confirmText}
        onConfirm={handleConfirm}
      />

      {showLocationPicker && (
        <LocationPicker
          initialLat={direccionLat ? parseFloat(direccionLat) : undefined}
          initialLng={direccionLng ? parseFloat(direccionLng) : undefined}
          onLocationSelect={(lat, lng) => {
            setDireccionLat(lat.toString());
            setDireccionLng(lng.toString());
            setShowLocationPicker(false);
          }}
          onCancel={() => setShowLocationPicker(false)}
        />
      )}
    </SafeAreaView>
  );
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
});

