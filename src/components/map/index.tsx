"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function MapPlaceholder() {
  return <Skeleton className="size-full rounded-none" />;
}

/** Leaflet touches `window`, so the maps only render in the browser. */
export const ReportsMap = dynamic(() => import("./reports-map-inner"), { ssr: false, loading: MapPlaceholder });
export const LocationPicker = dynamic(() => import("./location-picker-inner"), {
  ssr: false,
  loading: MapPlaceholder,
});

export type { MapReport } from "./reports-map-inner";
export type { LatLng } from "./location-picker-inner";
