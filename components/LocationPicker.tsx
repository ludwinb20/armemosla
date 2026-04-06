import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleMaps, AppleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../constants/theme';
import {
  getRModalBackdropProps,
  getRModalBottomSheetStyle,
  rModalAnimSheet,
} from '../lib/rnModalPresets';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onCancel: () => void;
}

export default function LocationPicker({
  initialLat,
  initialLng,
  onLocationSelect,
  onCancel,
}: LocationPickerProps) {
  const rBackdrop = getRModalBackdropProps();
  const rBottom = getRModalBottomSheetStyle();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState({
    latitude: initialLat || -33.4489,
    longitude: initialLng || -70.6693,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    loadLocation();
  }, []);

  const loadLocation = async () => {
    try {
      setLoading(true);

      // Si hay coordenadas iniciales (estamos editando), usarlas primero
      if (initialLat && initialLng) {
        setLocation({ lat: initialLat, lng: initialLng });
        setMapRegion({
          latitude: initialLat,
          longitude: initialLng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setLoading(false);
        return;
      }

      // Si no hay coordenadas iniciales (estamos creando), usar ubicación actual del usuario
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const lat = currentLocation.coords.latitude;
          const lng = currentLocation.coords.longitude;

          setLocation({ lat, lng });
          setMapRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          setLoading(false);
          return;
        } catch (error: any) {
          console.error('Error al obtener ubicación actual:', error);
        }
      }

      // Si no se pudo obtener la ubicación actual y no hay coordenadas iniciales
      Alert.alert(
        'Permisos de ubicación',
        'Se necesitan permisos de ubicación para usar esta función. Puedes seleccionar una ubicación manualmente en el mapa.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Error al obtener ubicación:', error);
      // Si hay coordenadas iniciales, usarlas como fallback
      if (initialLat && initialLng) {
        setLocation({ lat: initialLat, lng: initialLng });
        setMapRegion({
          latitude: initialLat,
          longitude: initialLng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = (event: { coordinates: { latitude?: number; longitude?: number } }) => {
    if (event.coordinates.latitude && event.coordinates.longitude) {
      setLocation({ lat: event.coordinates.latitude, lng: event.coordinates.longitude });
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos', 'Se necesitan permisos de ubicación');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = currentLocation.coords.latitude;
      const lng = currentLocation.coords.longitude;

      setLocation({ lat, lng });
      setMapRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo obtener tu ubicación actual');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (location) {
      onLocationSelect(location.lat, location.lng);
    } else {
      Alert.alert('Error', 'Por favor selecciona una ubicación en el mapa');
    }
  };

  return (
    <RNModal
      {...rBackdrop}
      {...rModalAnimSheet}
      isVisible
      onBackdropPress={onCancel}
      onBackButtonPress={onCancel}
      style={rBottom}
    >
      <SafeAreaView style={styles.modalBottomWidth} edges={['bottom']}>
        <View style={styles.sheetInner}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Cargando mapa...</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seleccionar Ubicación</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.mapContainer}>
        {Platform.OS === 'android' ? (
          <GoogleMaps.View
            style={styles.map}
            cameraPosition={{
              coordinates: {
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
              },
              zoom: 15,
            }}
            onMapClick={handleMapPress}
            properties={{
              mapType: GoogleMaps.MapType.NORMAL,
              isMyLocationEnabled: true,
            }}
            markers={
              location
                ? [
                    {
                      id: 'selected-location',
                      coordinates: {
                        latitude: location.lat,
                        longitude: location.lng,
                      },
                      draggable: true,
                    },
                  ]
                : []
            }
            onMarkerClick={(marker) => {
              if (marker.coordinates) {
                setLocation({ lat: marker.coordinates.latitude!, lng: marker.coordinates.longitude! });
              }
            }}
          />
        ) : (
          <AppleMaps.View
            style={styles.map}
            cameraPosition={{
              coordinates: {
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
              },
              zoom: 15,
            }}
            onMapClick={handleMapPress}
            properties={{
              mapType: AppleMaps.MapType.STANDARD,
            }}
            markers={
              location
                ? [
                    {
                      id: 'selected-location',
                      coordinates: {
                        latitude: location.lat,
                        longitude: location.lng,
                      },
                    },
                  ]
                : []
            }
            onMarkerClick={(marker) => {
              if (marker.coordinates) {
                setLocation({ lat: marker.coordinates.latitude!, lng: marker.coordinates.longitude! });
              }
            }}
          />
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleUseCurrentLocation}
        >
          <Ionicons name="locate" size={20} color={Colors.primary} />
          <Text style={styles.locationButtonText}>Mi ubicación</Text>
        </TouchableOpacity>

        {location && (
          <View style={styles.coordinatesContainer}>
            <Text style={styles.coordinatesLabel}>Coordenadas seleccionadas:</Text>
            <Text style={styles.coordinatesText}>
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.confirmButton, !location && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!location}
        >
          <Text style={styles.confirmButtonText}>Confirmar ubicación</Text>
        </TouchableOpacity>
      </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  modalBottomWidth: {
    width: '100%',
  },
  sheetInner: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
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
  cancelButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  placeholder: {
    width: 40,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controls: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  locationButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: Spacing.xs,
  },
  coordinatesContainer: {
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  coordinatesLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  coordinatesText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
});

