"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import { CITY_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "./constants";

export interface LatLng {
  lat: number;
  lng: number;
}

const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M18 0C8 0 0 8 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8 28 0 18 0z" fill="#ce1226"/>
    <circle cx="18" cy="18" r="7" fill="#fff"/></svg>`,
  iconSize: [36, 48],
  iconAnchor: [18, 48],
});

function ClickToPlace({ onChange }: { onChange: (value: LatLng) => void }) {
  const t = useTranslations("reportForm.location");
  const map = useMapEvents({
    click: (event) => onChange({ lat: event.latlng.lat, lng: event.latlng.lng }),
    // Without a mouse or location access, pan with the arrow keys and press Enter to pin the center.
    keydown: (event) => {
      if (event.originalEvent.key !== "Enter") return;
      event.originalEvent.preventDefault();
      const { lat, lng } = map.getCenter();
      onChange({ lat, lng });
    },
  });
  useEffect(() => {
    map.getContainer().setAttribute("aria-label", t("keyboard"));
  }, [map, t]);
  return null;
}

function FollowValue({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 17));
  }, [map, value]);
  return null;
}

export default function LocationPickerInner({
  value,
  onChange,
  className,
}: {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  className?: string;
}) {
  const [boundary, setBoundary] = useState<GeoJsonObject | null>(null);

  useEffect(() => {
    fetch("/cabanatuan-city.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then(setBoundary)
      .catch(() => setBoundary(null));
  }, []);

  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : [CITY_CENTER.lat, CITY_CENTER.lng]}
      zoom={value ? 17 : DEFAULT_ZOOM}
      className={className}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      {boundary && (
        <GeoJSON
          data={boundary}
          interactive={false}
          style={{ color: "#005df5", weight: 2, fillOpacity: 0.03, dashArray: "6 4" }}
        />
      )}
      <ClickToPlace onChange={onChange} />
      <FollowValue value={value} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              onChange({ lat, lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
