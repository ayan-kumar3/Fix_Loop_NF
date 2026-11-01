"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { formatDateTime, cn } from "@/lib/utils";
import type { IssueStatus } from "@/lib/types";
import { PRIORITY_META, STATUS_META } from "@/lib/types";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { markerColor } from "@/lib/map-issue";
import type { MapIssue } from "@/lib/map-issue";

// Pure mapping helpers live in lib/map-issue (server-safe, no "use client").
// The MapIssue type is re-exported for components that already import it here.
export type { MapIssue };

function makeIcon(color: string, selected: boolean, ring = true) {
  return L.divIcon({
    className: "",
    html: `<div class="fixloop-marker ${selected ? "selected" : ""}" style="background:${color}">
      <span style="width:8px;height:8px;border-radius:9999px;background:rgba(255,255,255,0.95);display:block;${
        ring ? "" : "display:none"
      }"></span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);
  return null;
}

export interface LeafletMapProps {
  issues: MapIssue[];
  center: [number, number];
  zoom: number;
  theme?: "light" | "dark";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  interactive?: boolean;
  showPopup?: boolean;
}

const TILES = {
  light: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
};

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export default function LeafletMap({
  issues,
  center,
  zoom,
  theme = "light",
  selectedId,
  onSelect,
  className,
  interactive = true,
  showPopup = true,
}: LeafletMapProps) {
  const dark = theme === "dark";
  return (
    <div className={cn("relative h-full w-full", className)}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        zoomControl={interactive}
        attributionControl
        className={cn("leaflet-container", dark && "dark-map")}
      >
        <TileLayer url={TILES[theme]} attribution={ATTRIBUTION} maxZoom={19} />
        <Recenter center={center} zoom={zoom} />
        {issues.map((issue) => (
          <Marker
            key={issue.id}
            position={[issue.coordinates.lat, issue.coordinates.lng]}
            icon={makeIcon(markerColor(issue), issue.id === selectedId)}
            eventHandlers={{ click: () => onSelect?.(issue.id) }}
            zIndexOffset={issue.id === selectedId ? 1000 : 0}
          >
            {showPopup && (
              <Popup closeButton={false} className="fixloop-popup">
                <MapPopup issue={issue} dark={dark} />
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function MapPopup({ issue, dark }: { issue: MapIssue; dark: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-xl", dark ? "bg-navy-900 text-white" : "bg-white text-slate-900")}>
      {issue.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={issue.thumbnailUrl} alt="" className="h-24 w-full object-cover" />
      )}
      <div className="p-2.5">
        <div className="flex items-center gap-1.5">
          <Badge variant={toneToVariant(PRIORITY_META[issue.priority].tone)}>{issue.priority}</Badge>
          <Badge variant={toneToVariant(STATUS_META[issue.status].tone)}>{STATUS_META[issue.status].label}</Badge>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs font-semibold">{issue.title}</p>
        <p className={cn("mt-0.5 text-[11px]", dark ? "text-slate-400" : "text-slate-500")}>
          {issue.publicId} · {issue.address}
        </p>
        <p className={cn("text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>{formatDateTime(issue.createdAt)}</p>
        <Link
          href={`/issues/${issue.id}`}
          className="mt-2 block rounded-md bg-brand-700 px-2.5 py-1.5 text-center text-xs font-semibold text-white hover:bg-brand-800"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
