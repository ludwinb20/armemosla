import React from 'react';
import { View, Platform } from 'react-native';
import { GoogleMaps, AppleMaps } from 'expo-maps';
import { PartidoAbiertoWithRelations } from '../lib/partidos';
import { useGlassTheme } from '@/hooks/useGlassTheme';

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
  const { colors } = useGlassTheme();

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
    color: colors.primary,
  }));

  return (
    <View className="flex-1" style={{ minHeight: 280 }}>
      {Platform.OS === 'android' ? (
        <GoogleMaps.View
          style={{ flex: 1 }}
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
          style={{ flex: 1 }}
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
