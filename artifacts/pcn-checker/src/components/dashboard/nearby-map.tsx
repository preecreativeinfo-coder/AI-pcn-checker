import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, Zap, ParkingCircle, Loader2 } from "lucide-react";
import {
  useNearbyPlaces,
  DEFAULT_CENTER,
  type PlaceKind,
  type NearbyPlace,
} from "@/hooks/use-nearby-places";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}

/** Cross-platform maps directions link (opens the maps app on mobile). */
function directionsUrl(p: NearbyPlace): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
}

/** Coloured pin built as a divIcon so we don't depend on Leaflet's image assets. */
function pinIcon(kind: PlaceKind): L.DivIcon {
  const colour = kind === "charging" ? "#16a34a" : "#2563eb";
  const glyph =
    kind === "charging"
      ? `<path d="M13 2 3 14h7l-1 8 10-12h-7z" fill="#fff"/>`
      : `<text x="12" y="16" font-size="13" font-weight="700" text-anchor="middle" fill="#fff" font-family="system-ui">P</text>`;
  return L.divIcon({
    className: "",
    html: `<div style="background:${colour};width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff"><svg width="18" height="18" viewBox="0 0 24 24">${glyph}</svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function NearbyMap() {
  const { toast } = useToast();
  const [kind, setKind] = useState<PlaceKind>("charging");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [locating, setLocating] = useState(false);

  const charging = useNearbyPlaces("charging", center);
  const parking = useNearbyPlaces("parking", center);
  const active = kind === "charging" ? charging : parking;

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);

  // Initialise the map once.
  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current, {
      center: [center.lat, center.lon],
      zoom: 13,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);
    markerLayer.current = L.layerGroup().addTo(map);
    mapObj.current = map;
    // Leaflet needs a size recalculation once the container has laid out.
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapObj.current = null;
    };
  }, []);

  // Recentre when the search centre changes.
  useEffect(() => {
    mapObj.current?.setView([center.lat, center.lon], 13);
  }, [center]);

  // Redraw markers when the active list changes.
  useEffect(() => {
    const layer = markerLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const safe = (s: string) =>
      s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const places = active.data ?? [];
    for (const p of places) {
      L.marker([p.lat, p.lon], { icon: pinIcon(kind) })
        .bindPopup(
          `<strong>${safe(p.name)}</strong>${p.operator ? `<br/>${safe(p.operator)}` : ""}` +
            `<br/><a href="${directionsUrl(p)}" target="_blank" rel="noreferrer">Directions ›</a>`,
        )
        .addTo(layer);
    }
  }, [active.data, kind]);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast({ title: "Location unavailable", description: "Your browser does not support geolocation.", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast({ title: "Couldn't get your location", description: "Permission denied or unavailable. Showing London.", variant: "destructive" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function focusPlace(p: NearbyPlace) {
    mapObj.current?.setView([p.lat, p.lon], 16);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <div className="text-base font-semibold leading-none">EV Charging &amp; Parking</div>
            <div className="text-xs text-muted-foreground mt-1">Nearest spots near you</div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          {locating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Navigation className="h-4 w-4 mr-1.5" />}
          Use my location
        </Button>
      </CardHeader>

      {/* Tabs */}
      <div className="grid grid-cols-2 border-y">
        {(["charging", "parking"] as const).map((k) => {
          const isActive = kind === k;
          const count = (k === "charging" ? charging.data : parking.data)?.length ?? 0;
          const Icon = k === "charging" ? Zap : ParkingCircle;
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? k === "charging"
                    ? "border-green-600 text-green-700"
                    : "border-blue-600 text-blue-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {k === "charging" ? "EV Charging" : "Parking"}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div ref={mapRef} className="h-64 w-full bg-muted z-0" />

      {/* List */}
      <div className="max-h-60 overflow-auto divide-y">
        {active.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding nearby spots…
          </div>
        ) : active.isError ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Couldn't load places right now. Please try again later.
          </div>
        ) : (active.data?.length ?? 0) === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No spots found nearby.</div>
        ) : (
          active.data!.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-4 py-3 hover:bg-muted/50">
              <button
                onClick={() => focusPlace(p)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                title="Show on map"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    kind === "charging" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {kind === "charging" ? <Zap className="h-4 w-4" /> : <ParkingCircle className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  {p.operator && <div className="truncate text-xs text-muted-foreground">{p.operator}</div>}
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-muted-foreground">{formatDistance(p.distance)}</span>
                <a
                  href={directionsUrl(p)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                  title={`Directions to ${p.name}`}
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Directions</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
