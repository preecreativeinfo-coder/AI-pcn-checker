import { useQuery } from "@tanstack/react-query";

export type PlaceKind = "charging" | "parking";

export interface NearbyPlace {
  id: number;
  name: string;
  operator: string | null;
  lat: number;
  lon: number;
  /** Distance from the search centre, in metres. */
  distance: number;
}

/** Default map centre — central London (matches the "Nearest spots in London" copy). */
export const DEFAULT_CENTER = { lat: 51.5074, lon: -0.1278 };

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

/** Haversine distance in metres between two coordinates. */
function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function buildQuery(kind: PlaceKind, lat: number, lon: number, radius: number): string {
  const amenity = kind === "charging" ? "charging_station" : "parking";
  // node + way + relation so we catch both point POIs and mapped areas.
  return `[out:json][timeout:25];
(
  node["amenity"="${amenity}"](around:${radius},${lat},${lon});
  way["amenity"="${amenity}"](around:${radius},${lat},${lon});
);
out center 60;`;
}

async function fetchPlaces(
  kind: PlaceKind,
  lat: number,
  lon: number,
  radius: number,
): Promise<NearbyPlace[]> {
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    body: "data=" + encodeURIComponent(buildQuery(kind, lat, lon, radius)),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  const json = (await res.json()) as {
    elements: Array<{
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  const places: NearbyPlace[] = json.elements
    .map((el) => {
      const pLat = el.lat ?? el.center?.lat;
      const pLon = el.lon ?? el.center?.lon;
      if (pLat === undefined || pLon === undefined) return null;
      const tags = el.tags ?? {};
      const fallback = kind === "charging" ? "EV Charging Station" : "Parking";
      return {
        id: el.id,
        name: tags.name || tags.operator || fallback,
        operator: tags.operator ?? tags.network ?? null,
        lat: pLat,
        lon: pLon,
        distance: haversine(lat, lon, pLat, pLon),
      } as NearbyPlace;
    })
    .filter((p): p is NearbyPlace => p !== null)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20);

  return places;
}

export function useNearbyPlaces(
  kind: PlaceKind,
  center: { lat: number; lon: number },
  radius = 3000,
) {
  return useQuery({
    queryKey: ["nearby", kind, center.lat.toFixed(4), center.lon.toFixed(4), radius],
    queryFn: () => fetchPlaces(kind, center.lat, center.lon, radius),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export { haversine };
