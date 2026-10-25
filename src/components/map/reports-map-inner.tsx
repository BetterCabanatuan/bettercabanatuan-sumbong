"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { ChevronDown, CircleAlert, MapPinOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { CATEGORY_ICONS, CategoryIcon } from "@/components/category-icon";
import { StatusBadge } from "@/components/status-badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MARKER_OPACITY, MARKER_SHAPE, MARKER_SIZE, markerSvg } from "@/lib/map-marker";
import { STATUS_MARKER, STATUS_ORDER } from "@/lib/status";
import type { ReportStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CITY_CENTER, DEFAULT_ZOOM, FIT_MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "./constants";
import { setSelectedReport, useHighlightedReport } from "./map-focus";
import { MarkerClusterGroup } from "./marker-cluster-group";

export interface MapReport {
  id: string;
  code: string;
  lat: number;
  lng: number;
  status: ReportStatus;
  title: string;
  /** Key into `CATEGORY_ICONS`. */
  categoryIcon: string;
  categoryName?: string;
  barangay?: string | null;
  meToo?: number | null;
}

/** Lucide's inner SVG markup for a Category icon, so it can sit inside a marker. */
const glyphCache = new Map<string, string>();
function glyphMarkup(icon: string): string {
  let markup = glyphCache.get(icon);
  if (markup === undefined) {
    const Icon = CATEGORY_ICONS[icon] ?? CircleAlert;
    markup = renderToStaticMarkup(<Icon />)
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");
    glyphCache.set(icon, markup);
  }
  return markup;
}

const iconCache = new Map<string, L.DivIcon>();
function pinIcon(status: ReportStatus, categoryIcon: string, active: boolean): L.DivIcon {
  const key = `${status}|${categoryIcon}|${active}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const svg = markerSvg({ shape: MARKER_SHAPE[status], color: STATUS_MARKER[status], glyph: glyphMarkup(categoryIcon) });
    icon = L.divIcon({
      className: cn("cbn-pin", active && "cbn-pin--active"),
      html: `<div class="cbn-pin-body" style="opacity:${MARKER_OPACITY[status]}">${svg}</div>`,
      iconSize: [MARKER_SIZE, MARKER_SIZE],
      iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
      popupAnchor: [0, -MARKER_SIZE / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function ReportMarker({ report }: { report: MapReport }) {
  const t = useTranslations("board");
  const tStatus = useTranslations("status");
  const active = useHighlightedReport() === report.id;
  const label = t("map.markerLabel", { title: report.title, status: tStatus(report.status) });
  return (
    <Marker
      position={[report.lat, report.lng]}
      icon={pinIcon(report.status, report.categoryIcon, active)}
      keyboard
      title={label}
      zIndexOffset={active ? 1000 : report.status === "resolved" ? -100 : 0}
      eventHandlers={{
        add: (event) => event.target.getElement()?.setAttribute("aria-label", label),
        click: () => setSelectedReport(report.id),
      }}
    >
      <Popup minWidth={200} maxWidth={280}>
        <div className="flex max-w-full flex-col items-start gap-1.5 text-sm [overflow-wrap:anywhere]">
          <StatusBadge status={report.status} />
          <p className="text-base leading-snug font-semibold text-balance">{report.title}</p>
          {report.categoryName && (
            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <CategoryIcon icon={report.categoryIcon} className="size-3.5 shrink-0" />
              {report.categoryName}
            </p>
          )}
          {report.barangay && <p className="text-muted-foreground">{t("barangay", { name: report.barangay })}</p>}
          {typeof report.meToo === "number" && (
            <p className="text-muted-foreground">{t("meTooLabel", { count: report.meToo })}</p>
          )}
          <Link
            href={`/r/${report.code}`}
            aria-label={t("map.reportLink", { code: report.code })}
            className="font-mono font-medium text-primary underline"
          >
            {report.code}
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}

/** Fits the view to the markers (at most `maxZoom`) whenever the set of Reports changes. */
function FitToReports({ reports, maxZoom }: { reports: MapReport[]; maxZoom: number }) {
  const map = useMap();
  const signature = useMemo(() => reports.map((r) => r.id).join(","), [reports]);
  useEffect(() => {
    if (!signature) {
      map.setView([CITY_CENTER.lat, CITY_CENTER.lng], DEFAULT_ZOOM, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(reports.map((r) => [r.lat, r.lng] as [number, number]));
    map.fitBounds(bounds, { maxZoom, padding: [48, 48], animate: false });
    // `signature` stands for `reports`: refit only when the set changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature, maxZoom]);
  return null;
}

function Legend({ statuses }: { statuses: ReportStatus[] }) {
  const t = useTranslations("board");
  const tStatus = useTranslations("status");
  const [open, setOpen] = useState(false);
  const id = "map-legend";
  return (
    <div className="absolute bottom-6 left-2 z-[1000] max-w-[calc(100%-1rem)] rounded-lg border bg-card/95 text-card-foreground shadow-sm backdrop-blur">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-9 w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("map.legend")}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul id={id} className="flex flex-col gap-1.5 border-t px-3 py-2 text-sm">
          {statuses.map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-5 shrink-0 [&>div]:size-full [&_svg]:size-full"
                style={{ opacity: MARKER_OPACITY[status] }}
                dangerouslySetInnerHTML={{
                  __html: markerSvg({ shape: MARKER_SHAPE[status], color: STATUS_MARKER[status], glyph: "" }),
                }}
              />
              {tStatus(status)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReportsMapInner({
  reports,
  className,
  legend = true,
  maxZoom = FIT_MAX_ZOOM,
}: {
  reports: MapReport[];
  className?: string;
  /** The key of statuses; off for a map that shows one Report. */
  legend?: boolean;
  maxZoom?: number;
}) {
  const t = useTranslations("board");
  const present = useMemo(() => {
    const seen = new Set(reports.map((r) => r.status));
    return STATUS_ORDER.filter((s) => seen.has(s));
  }, [reports]);
  // The cluster plugin animates in JS, so honour the setting there too.
  const [animate] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  return (
    <div role="region" aria-label={t("map.label")} className={cn("relative", className)}>
      <MapContainer
        center={[CITY_CENTER.lat, CITY_CENTER.lng]}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        keyboard
        className="size-full"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <MarkerClusterGroup chunkedLoading animate={animate} animateAddingMarkers={false}>
          {reports.map((report) => (
            <ReportMarker key={report.id} report={report} />
          ))}
        </MarkerClusterGroup>
        <FitToReports reports={reports} maxZoom={maxZoom} />
      </MapContainer>
      {legend && present.length > 0 && <Legend statuses={present} />}
      {reports.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[1000] grid place-items-center p-4">
          <Empty className="max-w-xs flex-none border bg-card/95 p-6 shadow-sm backdrop-blur">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPinOff />
              </EmptyMedia>
              <EmptyTitle>{t("map.empty")}</EmptyTitle>
              <EmptyDescription>{t("map.emptyHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );
}
