'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader } from '@/components/Loader';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SPS_MAP_CENTER, SPS_MAP_DEFAULT_ZOOM } from '@armemosla/shared';

const LOCATION_ICON = L.divIcon({
  className: '',
  html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:#00a85c;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

function MapClickPicker({
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

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
}

export function LocationMapPicker({ lat, lng, onChange, disabled = false }: Props) {
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(lat == null || lng == null);

  useEffect(() => {
    setReady(true);
  }, []);

  const hasLocation = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const center = useMemo(
    () => (hasLocation ? { lat: lat!, lng: lng! } : SPS_MAP_CENTER),
    [hasLocation, lat, lng]
  );
  const zoom = hasLocation ? 16 : SPS_MAP_DEFAULT_ZOOM;
  const canEdit = editing && !disabled;

  if (!ready) {
    return (
      <div className="location-map location-map--loading">
        <Loader label="Cargando mapa…" />
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: '0.5rem' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="field-label">Ubicación *</span>
        {!disabled ? (
          editing ? (
            <button
              type="button"
              className="btn"
              style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => setEditing(false)}
              disabled={!hasLocation}
            >
              Listo
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => setEditing(true)}
            >
              Cambiar ubicación
            </button>
          )
        ) : null}
      </div>

      <div className={`location-map${canEdit ? ' location-map--editing' : ''}`}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          dragging
          doubleClickZoom
          touchZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickPicker enabled={canEdit} onPick={onChange} />
          {hasLocation ? (
            <>
              <MapRecenter lat={lat!} lng={lng!} />
              <Marker
                position={[lat!, lng!]}
                icon={LOCATION_ICON}
                draggable={canEdit}
                eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    onChange(pos.lat, pos.lng);
                  },
                }}
              />
            </>
          ) : null}
        </MapContainer>

        {canEdit ? (
          <div className="location-map-hint">
            {hasLocation ? 'Arrastrá el pin o hacé clic en el mapa' : 'Hacé clic en el mapa para marcar la ubicación'}
          </div>
        ) : null}
      </div>

      {hasLocation ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          {lat!.toFixed(6)}, {lng!.toFixed(6)}
        </p>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          Marcá la ubicación del complejo en el mapa
        </p>
      )}
    </div>
  );
}
