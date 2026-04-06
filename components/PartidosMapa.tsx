import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { GoogleMaps, AppleMaps } from 'expo-maps';
import { PartidoAbiertoWithRelations } from '../lib/partidos';
import { Colors } from '../constants/theme';

export interface PartidoMapMarker {
  partidoId: string;
  lat: number;
  lng: number;
}

interface PartidosMapaProps {
  markers: PartidoMapMarker[];
  ubicacionActual?: { lat: number; lng: number } | null;
  onMarkerPress: (partidoId: string) => void;
}

export default function PartidosMapa({ markers, ubicacionActual, onMarkerPress }: PartidosMapaProps) {
  const getMapRegion = () => {
    if (markers.length > 0) {
      return {
        latitude: markers[0].lat,
        longitude: markers[0].lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    if (ubicacionActual) {
      return {
        latitude: ubicacionActual.lat,
        longitude: ubicacionActual.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    return {
      latitude: 14.0723,
      longitude: -87.1921,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  };

  const mapRegion = getMapRegion();

  const mapMarkers = markers.map((m) => ({
    id: m.partidoId,
    coordinates: {
      latitude: m.lat,
      longitude: m.lng,
    },
    color: Colors.primary,
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
            zoom: 12,
          }}
          properties={{
            mapType: GoogleMaps.MapType.NORMAL,
            isMyLocationEnabled: true,
          }}
          markers={mapMarkers}
          onMarkerClick={(marker) => {
            if (marker.id) onMarkerPress(marker.id as string);
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
            zoom: 12,
          }}
          properties={{
            mapType: AppleMaps.MapType.STANDARD,
          }}
          markers={mapMarkers}
          onMarkerClick={(marker) => {
            if (marker.id) onMarkerPress(marker.id as string);
          }}
        />
      )}
    </View>
  );
}

/** Construye marcadores desde partidos con coordenadas de complejo */
export function partidosToMapMarkers(partidos: PartidoAbiertoWithRelations[]): PartidoMapMarker[] {
  return partidos
    .map((p) => {
      const complejo = (p.reserva as any)?.cancha?.complejo;
      const lat = complejo?.direccion_lat;
      const lng = complejo?.direccion_lng;
      if (lat == null || lng == null) return null;
      return { partidoId: p.id, lat: Number(lat), lng: Number(lng) };
    })
    .filter((m): m is PartidoMapMarker => m !== null);
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    minHeight: 280,
  },
  map: {
    flex: 1,
  },
});
