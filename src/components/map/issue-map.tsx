"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeafletMapProps } from "@/components/map/leaflet-map";

// Leaflet touches `window` at import time, so it must never render on the
// server. We load the real map client-side only and show a skeleton meanwhile.
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.3) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}

export type IssueMapProps = LeafletMapProps;

export function IssueMap(props: IssueMapProps) {
  return <LeafletMap {...props} />;
}

