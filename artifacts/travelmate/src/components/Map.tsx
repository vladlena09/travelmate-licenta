import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import type { Poi } from "@workspace/api-client-react";

// Fix Leaflet default icon paths in bundled environments
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapProps {
  pois: Poi[];
  routePolyline?: string | null;
}

// Fit bounds whenever the day's POIs change
function MapUpdater({ pois }: { pois: Poi[] }) {
  const map = useMap();
  useEffect(() => {
    if (pois.length === 0) return;
    if (pois.length === 1) {
      map.setView([pois[0].lat, pois[0].lon], 15, { animate: true, duration: 0.8 });
      return;
    }
    const bounds = L.latLngBounds(pois.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true, duration: 0.8 });
  }, [pois, map]);
  return null;
}

// Numbered circle marker
function createNumberedIcon(number: number, isMustSee: boolean) {
  const bg = isMustSee ? "#7c3aed" : "#6d28d9";
  const glow = isMustSee
    ? "0 0 0 3px rgba(124,58,237,0.3), 0 0 16px rgba(124,58,237,0.5)"
    : "0 0 0 2px rgba(109,40,217,0.2), 0 2px 6px rgba(0,0,0,0.4)";
  const size = isMustSee ? 36 : 30;
  const offset = size / 2;
  return L.divIcon({
    className: "!bg-transparent !border-none",
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${bg};
      box-shadow:${glow};
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${isMustSee ? 14 : 12}px;
      font-family:Inter,sans-serif;
      border:2px solid rgba(255,255,255,0.25);
    ">${number}</div>`,
    iconSize: [size, size],
    iconAnchor: [offset, offset],
    popupAnchor: [0, -(offset + 4)],
  });
}

// User location dot
function UserLocationMarker() {
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  if (!pos) return null;

  const userIcon = L.divIcon({
    className: "!bg-transparent !border-none",
    html: `<div style="
      width:16px;height:16px;
      border-radius:50%;
      background:#f59e0b;
      border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(245,158,11,0.3),0 0 12px rgba(245,158,11,0.6);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return (
    <>
      <Circle
        center={pos}
        radius={80}
        pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.1, weight: 1 }}
      />
      <Marker position={pos} icon={userIcon}>
        <Popup>
          <div style={{ padding: "4px 8px", fontFamily: "Inter, sans-serif" }}>
            <strong>Your location</strong>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

export function ItineraryMap({ pois, routePolyline: _routePolyline }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const positions: [number, number][] = pois.map((p) => [p.lat, p.lon]);

  if (pois.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <p className="text-muted-foreground text-sm">Select a day to see the map</p>
      </div>
    );
  }

  const center: [number, number] = [pois[0].lat, pois[0].lon];

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%", background: "#0d0a1a" }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* Dark CartoDB tiles */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        <MapUpdater pois={pois} />
        <UserLocationMarker />

        {/* Route polyline with gradient effect (two layers: shadow + line) */}
        {positions.length > 1 && (
          <>
            <Polyline
              positions={positions}
              pathOptions={{
                color: "rgba(124,58,237,0.25)",
                weight: 10,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: "#7c3aed",
                weight: 3,
                dashArray: "10, 8",
                lineCap: "round",
                lineJoin: "round",
                opacity: 0.9,
              }}
            />
          </>
        )}

        {/* POI markers */}
        {pois.map((poi, idx) => (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lon]}
            icon={createNumberedIcon(idx + 1, poi.isMustSee)}
          >
            <Popup minWidth={220} maxWidth={260}>
              <div style={{ padding: "6px", fontFamily: "Inter, sans-serif", color: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{
                    background: "#7c3aed", color: "#fff", borderRadius: "50%",
                    width: 22, height: 22, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{idx + 1}</span>
                  <strong style={{ fontSize: 14, lineHeight: 1.2 }}>{poi.name}</strong>
                </div>

                <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, lineClamp: 2 }}>
                  {poi.description
                    ? poi.description.slice(0, 100) + (poi.description.length > 100 ? "…" : "")
                    : ""}
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd", borderRadius: 99, padding: "2px 8px", fontSize: 11, textTransform: "capitalize" }}>
                    {poi.category}
                  </span>
                  <span style={{ background: "rgba(255,255,255,0.07)", color: "#94a3b8", borderRadius: 99, padding: "2px 8px", fontSize: 11 }}>
                    ⏱ {poi.estimatedDuration} min
                  </span>
                  <span style={{ background: "rgba(255,255,255,0.07)", color: "#94a3b8", borderRadius: 99, padding: "2px 8px", fontSize: 11 }}>
                    {poi.isFree ? "✓ Free" : `€${poi.estimatedCost}`}
                  </span>
                  {poi.isMustSee && (
                    <span style={{ background: "rgba(219,39,119,0.2)", color: "#f472b6", borderRadius: 99, padding: "2px 8px", fontSize: 11 }}>
                      ★ Must See
                    </span>
                  )}
                </div>

                {poi.openingHours && (
                  <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>🕐 {poi.openingHours}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Day legend overlay */}
      <div style={{
        position: "absolute", bottom: 16, left: 16, zIndex: 1000,
        background: "rgba(13,10,26,0.85)", backdropFilter: "blur(12px)",
        border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12,
        padding: "8px 12px", maxWidth: 180,
      }}>
        <p style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 600, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>
          ROUTE — {pois.length} stops
        </p>
        {pois.map((poi, idx) => (
          <div key={poi.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{
              background: "#7c3aed", color: "#fff", borderRadius: "50%",
              width: 16, height: 16, fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, fontFamily: "Inter, sans-serif",
            }}>{idx + 1}</span>
            <span style={{
              color: "#e2e8f0", fontSize: 11, fontFamily: "Inter, sans-serif",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130,
            }}>{poi.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
