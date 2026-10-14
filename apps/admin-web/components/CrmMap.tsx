'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader } from '@/components/Loader';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ESTADO_COMERCIAL_COLORS,
  SPS_MAP_CENTER,
  SPS_MAP_DEFAULT_ZOOM,
  type EstadoComercial,
  type ProspectoVenue,
} from '@armemosla/shared';

function markerIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function ClickToCreate({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function CrmMap({
  prospectos,
  selectedId,
  onSelect,
  createMode,
  onMapClick,
}: {
  prospectos: ProspectoVenue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  createMode: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const icons = useMemo(() => {
    const map = {} as Record<EstadoComercial, L.DivIcon>;
    (Object.keys(ESTADO_COMERCIAL_COLORS) as EstadoComercial[]).forEach((k) => {
      map[k] = markerIcon(ESTADO_COMERCIAL_COLORS[k]);
    });
    return map;
  }, []);

  if (!ready) {
    return (
      <div className="map-pane" style={{ display: 'grid', placeItems: 'center' }}>
        <Loader label="Cargando mapa…" />
      </div>
    );
  }

  return (
    <div className="map-pane" style={{ height: '100%', minHeight: 420 }}>
      <MapContainer
        center={[SPS_MAP_CENTER.lat, SPS_MAP_CENTER.lng]}
        zoom={SPS_MAP_DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToCreate enabled={createMode} onPick={onMapClick} />
        {prospectos.map((p) => (
          <Marker
            key={p.id}
            position={[p.direccion_lat, p.direccion_lng]}
            icon={icons[p.estado_comercial]}
            eventHandlers={{
              click: () => onSelect(p.id),
            }}
            opacity={selectedId && selectedId !== p.id ? 0.55 : 1}
          />
        ))}
      </MapContainer>
    </div>
  );
}
