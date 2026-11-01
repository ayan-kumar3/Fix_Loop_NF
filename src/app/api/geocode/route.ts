import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

interface GeocodedLocation {
  point: { lat: number; lng: number };
  address: string;
  area: string;
}

const cache = new Map<string, { expiresAt: number; value: GeocodedLocation | null }>();
let nextRequestAt = 0;

export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const limit = rateLimit(clientKey(req, ":geocode"), 20);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many location lookups. Please wait a moment and retry." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const params = new URL(req.url).searchParams;
  const query = params.get("q")?.trim();
  const latParam = params.get("lat");
  const lngParam = params.get("lon");
  const lat = latParam === null ? Number.NaN : Number(latParam);
  const lng = lngParam === null ? Number.NaN : Number(lngParam);

  if (query !== undefined && query !== null) {
    if (query.length < 3 || query.length > 200) {
      return NextResponse.json({ error: "Enter a location between 3 and 200 characters." }, { status: 400 });
    }
  } else if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Provide a valid address or map coordinate." }, { status: 400 });
  }

  const cacheKey = query
    ? `search:${query.toLocaleLowerCase()}`
    : `reverse:${lat.toFixed(4)}:${lng.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ location: cached.value });
  }

  try {
    await waitForGeocoderSlot();
    const url = new URL(
      query
        ? "https://nominatim.openstreetmap.org/search"
        : "https://nominatim.openstreetmap.org/reverse"
    );
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    if (query) {
      url.searchParams.set("limit", "1");
      url.searchParams.set("q", query);
    } else {
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("zoom", "18");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "FixLoop civic issue reporting app (local development)",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json({ error: "The address service is temporarily unavailable. Please retry." }, { status: 502 });
    }

    const payload: unknown = await response.json();
    const result = Array.isArray(payload) ? payload[0] as NominatimResult | undefined : payload as NominatimResult;
    const location = result ? toLocation(result) : null;
    cache.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, value: location });
    if (cache.size > 200) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    return NextResponse.json({ location });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The address lookup timed out. Please retry."
      : "The address service is temporarily unavailable. Please retry.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function toLocation(result: NominatimResult): GeocodedLocation | null {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !result.display_name) return null;

  const addressParts = result.address ?? {};
  const street = [
    addressParts.house_number,
    addressParts.road ?? addressParts.pedestrian ?? addressParts.footway ?? addressParts.path,
  ].filter(Boolean);
  const landmark = addressParts.amenity ?? addressParts.historic ?? addressParts.tourism ?? addressParts.building;
  const address = street.length
    ? `${landmark ? `${landmark}, ` : ""}${street.join(" ")}`
    : landmark ?? result.display_name.split(",").slice(0, 2).join(",").trim();
  const area = [
    addressParts.neighbourhood,
    addressParts.suburb,
    addressParts.city_district,
    addressParts.borough,
    addressParts.city,
    addressParts.town,
    addressParts.village,
    addressParts.county,
    addressParts.state_district,
  ].find(Boolean) ?? "";

  return { point: { lat, lng }, address, area };
}

async function waitForGeocoderSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = now + wait + 1_000;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}
