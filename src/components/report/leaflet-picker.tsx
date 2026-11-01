"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/types";

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:9999px 9999px 9999px 2px;transform:rotate(45deg);background:#66785d;border:2px solid #fff;box-shadow:0 2px 8px rgba(39,53,34,.45)"><span style="display:block;width:8px;height:8px;border-radius:9999px;background:#fff;margin:7px"></span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

function ClickHandler({ onPick }: { onPick: (p: GeoPoint) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function CenterUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const lat = center[0];
  const lng = center[1];

  React.useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.7 });
  }, [lat, lng, map, zoom]);

  return null;
}

export default function LeafletPicker({
  value,
  onChange,
  center,
  zoom = 16,
}: {
  value: GeoPoint;
  onChange: (p: GeoPoint) => void;
  center: [number, number];
  zoom?: number;
}) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className="leaflet-container h-full w-full rounded-lg">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        maxZoom={19}
      />
      <CenterUpdater center={center} zoom={zoom} />
      <ClickHandler onPick={onChange} />
      <Marker position={[value.lat, value.lng]} icon={pinIcon()} draggable={true} eventHandlers={{ dragend: (e) => {
        const m = e.target as L.Marker;
        const ll = m.getLatLng();
        onChange({ lat: ll.lat, lng: ll.lng });
      }}} />
    </MapContainer>
  );
}
