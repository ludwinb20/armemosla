import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleMaps, AppleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Surface } from '@/components/ui';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import PlayerLoadingView from './lottie/PlayerLoadingView';
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
  const { colors } = useGlassTheme();
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
      <SafeAreaView className="w-full" edges={['bottom']}>
        <Surface
          variant="solid"
          className="w-full overflow-hidden rounded-t-xl"
          style={{ height: SCREEN_HEIGHT * 0.7 }}
        >
          {loading ? (
            <PlayerLoadingView message="Cargando mapa..." compact style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />
          ) : (
            <>
              <View className="flex-row items-center justify-between px-md py-sm border-b border-border-subtle dark:border-border-subtle-dark">
                <TouchableOpacity onPress={onCancel} className="p-xs">
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text variant="h4">Seleccionar Ubicación</Text>
                <View className="w-10" />
              </View>

              <View className="flex-1">
                {Platform.OS === 'android' ? (
                  <GoogleMaps.View
                    style={{ flex: 1 }}
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
                    style={{ flex: 1 }}
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

              <View className="p-md border-t border-border-subtle dark:border-border-subtle-dark">
                <Button variant="outline" size="sm" onPress={handleUseCurrentLocation} className="mb-md">
                  <View className="flex-row items-center gap-xs">
                    <Ionicons name="locate" size={20} color={colors.primary} />
                    <Text className="text-md font-medium text-primary">Mi ubicación</Text>
                  </View>
                </Button>

                {location && (
                  <Surface variant="solid" className="p-sm mb-md">
                    <Text variant="caption">Coordenadas seleccionadas:</Text>
                    <Text variant="caption" className="font-mono">
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </Text>
                  </Surface>
                )}

                <Button onPress={handleConfirm} disabled={!location}>
                  Confirmar ubicación
                </Button>
              </View>
            </>
          )}
        </Surface>
      </SafeAreaView>
    </RNModal>
  );
}
