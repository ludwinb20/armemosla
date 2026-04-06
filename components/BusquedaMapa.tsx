import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { GoogleMaps, AppleMaps } from 'expo-maps';
import { ComplejoBusqueda } from '../lib/busqueda';
import { Colors } from '../constants/theme';

interface BusquedaMapaProps {
  complejos: ComplejoBusqueda[];
  ubicacionActual?: { lat: number; lng: number } | null;
  onMarkerPress: (complejo: ComplejoBusqueda) => void;
}

export default function BusquedaMapa({ complejos, ubicacionActual, onMarkerPress }: BusquedaMapaProps) {
  // Calcular región del mapa para centrar en los complejos o ubicación actual
  const getMapRegion = () => {
    if (complejos.length > 0 && complejos[0].direccion_lat && complejos[0].direccion_lng) {
      return {
        latitude: complejos[0].direccion_lat,
        longitude: complejos[0].direccion_lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    if (ubicacionActual) {
      return {
        latitude: ubicacionActual.lat,
        longitude: ubicacionActual.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 14.0723, // Tegucigalpa por defecto
      longitude: -87.1921,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  };

  const mapRegion = getMapRegion();

  // Crear marcadores únicos por complejo (eliminar duplicados de ubicación)
  const markers = complejos
    .filter((c) => c.direccion_lat && c.direccion_lng)
    .map((complejo) => ({
      id: complejo.id,
      coordinates: {
        latitude: complejo.direccion_lat!,
        longitude: complejo.direccion_lng!,
      },
      color: complejo.tieneDisponibilidad ? '#00C56E' : '#EF4444',
    }));

  return (
    <View style={styles.mapContainer}>
      {Platform.OS === 'android' ? (
        <GoogleMaps.View
          style={styles.map}
          cameraPosition={{
            coordinates: {
              latitude: mapRegion.latitude,
              longitude: mapRegion.longitude,
            },
            zoom: 13,
          }}
          properties={{
            mapType: GoogleMaps.MapType.NORMAL,
            isMyLocationEnabled: true,
          }}
          markers={markers}
          onMarkerClick={(marker) => {
            const complejo = complejos.find((c) => c.id === marker.id);
            if (complejo) {
              onMarkerPress(complejo);
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
            zoom: 13,
          }}
          properties={{
            mapType: AppleMaps.MapType.STANDARD,
          }}
          markers={markers}
          onMarkerClick={(marker) => {
            const complejo = complejos.find((c) => c.id === marker.id);
            if (complejo) {
              onMarkerPress(complejo);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
