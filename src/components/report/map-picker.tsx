"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { GeoPoint } from "@/lib/types";

const LeafletPicker = dynamic(() => import("@/components/report/leaflet-picker"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});

export function MapPicker({
  value,
  onChange,
  center,
  zoom,
}: {
  value: GeoPoint;
  onChange: (p: GeoPoint) => void;
  center: [number, number];
  zoom?: number;
}) {
  return <LeafletPicker value={value} onChange={onChange} center={center} zoom={zoom} />;
}
