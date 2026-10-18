"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { CITY_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "./constants";

export interface MapReport {
  id: string;
  code: string;
  lat: number;
  lng: number;
  color: string;
  title: string;
  statusLabel: string;
}

export default function ReportsMapInner({ reports, className }: { reports: MapReport[]; className?: string }) {
  return (
    <MapContainer
      center={[CITY_CENTER.lat, CITY_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={false}
      className={className}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      {reports.map((report) => (
        <CircleMarker
          key={report.id}
          center={[report.lat, report.lng]}
          radius={9}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: report.color, fillOpacity: 0.9 }}
        >
          <Popup>
            <div className="flex flex-col gap-1">
              <p className="font-semibold">{report.title}</p>
              <p>{report.statusLabel}</p>
              <Link href={`/r/${report.code}`} className="font-mono font-medium text-primary underline">
                {report.code}
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
