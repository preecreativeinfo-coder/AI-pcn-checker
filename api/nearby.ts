import type { VercelRequest, VercelResponse } from "@vercel/node";

// GET /api/nearby?kind=charging|parking&lat=..&lon=..&radius=..
// Proxies the public Overpass (OpenStreetMap) API and caches the result on
// Vercel's CDN so repeated dashboard loads don't hammer the upstream endpoint.

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const MAX_RADIUS = 10000; // metres
const RESULT_LIMIT = 20;

interface NearbyPlace {
  id: number;
  name: string;
  operator: string | null;
  lat: number;
  lon: number;
  distance: number;
}

/** Haversine distance in metres. */
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

function buildQuery(amenity: string, lat: number, lon: number, radius: number): string {
  return `[out:json][timeout:25];
(
  node["amenity"="${amenity}"](around:${radius},${lat},${lon});
  way["amenity"="${amenity}"](around:${radius},${lat},${lon});
);
out center 60;`;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const kind = req.query.kind;
  if (kind !== "charging" && kind !== "parking") {
    res.status(400).json({ error: "kind must be 'charging' or 'parking'" });
    return;
  }

  const lat = num(req.query.lat);
  const lon = num(req.query.lon);
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({ error: "valid lat and lon are required" });
    return;
  }

  const radius = Math.min(Math.max(num(req.query.radius) ?? 3000, 100), MAX_RADIUS);
  const amenity = kind === "charging" ? "charging_station" : "parking";
  const fallbackName = kind === "charging" ? "EV Charging Station" : "Parking";

  try {
    const upstream = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(buildQuery(amenity, lat, lon, radius)),
    });

    if (!upstream.ok) {
      console.error("Overpass error", upstream.status);
      res.status(502).json({ error: `Overpass API error (HTTP ${upstream.status})` });
      return;
    }

    const json = (await upstream.json()) as {
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
        return {
          id: el.id,
          name: tags.name || tags.operator || fallbackName,
          operator: tags.operator ?? tags.network ?? null,
          lat: pLat,
          lon: pLon,
          distance: haversine(lat, lon, pLat, pLon),
        } as NearbyPlace;
      })
      .filter((p): p is NearbyPlace => p !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, RESULT_LIMIT);

    // Cache on the CDN for a day; serve stale for a week while revalidating.
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).json(places);
  } catch (err) {
    console.error("Nearby lookup failed", err);
    res.status(500).json({ error: "Failed to contact Overpass API" });
  }
}
