import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import type { Poi, TransportSegment } from "@workspace/api-client-react";

// Fix Leaflet default icon paths in bundled environments
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapProps {
  pois: Poi[];
  segments?: TransportSegment[];
  transportMode?: string;
}

// ── Fit bounds whenever POIs change ──────────────────────────
function MapUpdater({ pois }: { pois: Poi[] }) {
  const map = useMap();
  useEffect(() => {
    if (pois.length === 0) return;
    if (pois.length === 1) {
      map.setView([pois[0].lat, pois[0].lon], 15, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(pois.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
  }, [pois, map]);
  return null;
}

// ── Numbered circle marker ────────────────────────────────────
function createNumberedIcon(number: number, isMustSee: boolean, mode: string) {
  const modeColor =
    mode === "car"
      ? "#ea580c"
      : mode === "public_transport"
      ? "#2563eb"
      : "#7c3aed";

  const size = isMustSee ? 36 : 30;
  const offset = size / 2;
  const glow = isMustSee
    ? `0 0 0 3px ${modeColor}44, 0 0 16px ${modeColor}55`
    : `0 0 0 2px ${modeColor}22, 0 2px 6px #00000066`;

  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${modeColor};
      box-shadow:${glow};
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${isMustSee ? 14 : 12}px;
      font-family:Inter,sans-serif;
      border:2px solid rgba(255,255,255,0.3);
      cursor:pointer;
    ">${number}</div>`,
    iconSize: [size, size],
    iconAnchor: [offset, offset],
    popupAnchor: [0, -(offset + 6)],
  });
}

// ── User location dot ─────────────────────────────────────────
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
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#f59e0b;
      border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(245,158,11,0.35),0 0 14px rgba(245,158,11,0.6);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  return (
    <>
      <Circle
        center={pos}
        radius={80}
        pathOptions={{
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: 0.08,
          weight: 1,
        }}
      />
      <Marker position={pos} icon={userIcon}>
        <Popup>
          <span style={{ fontFamily: "Inter,sans-serif", fontSize: 13 }}>
            📍 Your location
          </span>
        </Popup>
      </Marker>
    </>
  );
}

// ── Route line config per transport mode ──────────────────────
function routeConfig(mode: string) {
  switch (mode) {
    case "walking":
      return {
        color: "#7c3aed",
        glowColor: "rgba(124,58,237,0.25)",
        dashArray: "10, 8",
        weight: 3,
        glowWeight: 10,
      };
    case "car":
      return {
        color: "#ea580c",
        glowColor: "rgba(234,88,12,0.2)",
        dashArray: undefined,
        weight: 4,
        glowWeight: 12,
      };
    case "public_transport":
      return {
        color: "#2563eb",
        glowColor: "rgba(37,99,235,0.2)",
        dashArray: "6, 10",
        weight: 3,
        glowWeight: 10,
      };
    default:
      return {
        color: "#7c3aed",
        glowColor: "rgba(124,58,237,0.2)",
        dashArray: "8, 8",
        weight: 3,
        glowWeight: 10,
      };
  }
}

// ── Transport legend label ────────────────────────────────────
function transportLabel(mode: string) {
  switch (mode) {
    case "walking":          return "🚶 Walking route";
    case "car":              return "🚗 Driving route";
    case "public_transport": return "🚌 Transit route";
    default:                 return "Route";
  }
}

// ── Legend text colour ────────────────────────────────────────
function legendColor(mode: string) {
  switch (mode) {
    case "car":              return "#f97316";
    case "public_transport": return "#60a5fa";
    default:                 return "#c4b5fd";
  }
}

// ── Main export ───────────────────────────────────────────────
export function ItineraryMap({ pois, segments = [], transportMode = "walking" }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const positions: [number, number][] = pois.map((p) => [p.lat, p.lon]);
  const rc = routeConfig(transportMode);

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

        {/* Route: glow shadow layer + styled line */}
        {positions.length > 1 && (
          <>
            <Polyline
              positions={positions}
              pathOptions={{
                color: rc.glowColor,
                weight: rc.glowWeight,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: rc.color,
                weight: rc.weight,
                dashArray: rc.dashArray,
                lineCap: "round",
                lineJoin: "round",
                opacity: 0.92,
              }}
            />
          </>
        )}

        {/* POI markers */}
        {pois.map((poi, idx) => {
          const seg = idx > 0 ? segments[idx - 1] : null;
          return (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lon]}
              icon={createNumberedIcon(idx + 1, poi.isMustSee, transportMode)}
            >
              <Popup minWidth={230} maxWidth={280}>
                <div
                  style={{
                    padding: "8px 4px",
                    fontFamily: "Inter, sans-serif",
                    color: "#f1f5f9",
                    background: "transparent",
                  }}
                >
                  {/* Number + name */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        background: rc.color,
                        color: "#fff",
                        borderRadius: "50%",
                        width: 24,
                        height: 24,
                        minWidth: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <strong style={{ fontSize: 14, lineHeight: 1.3 }}>{poi.name}</strong>
                  </div>

                  {/* Description */}
                  {poi.description && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        marginBottom: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      {poi.description.slice(0, 110)}
                      {poi.description.length > 110 ? "…" : ""}
                    </p>
                  )}

                  {/* Tags */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    <span
                      style={{
                        background: `${rc.color}22`,
                        color: rc.color,
                        borderRadius: 99,
                        padding: "2px 8px",
                        fontSize: 11,
                        textTransform: "capitalize",
                        border: `1px solid ${rc.color}44`,
                      }}
                    >
                      {poi.category}
                    </span>
                    <span
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "#94a3b8",
                        borderRadius: 99,
                        padding: "2px 8px",
                        fontSize: 11,
                      }}
                    >
                      ⏱ {poi.estimatedDuration} min
                    </span>
                    <span
                      style={{
                        background: poi.isFree
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(255,255,255,0.06)",
                        color: poi.isFree ? "#4ade80" : "#94a3b8",
                        borderRadius: 99,
                        padding: "2px 8px",
                        fontSize: 11,
                        border: poi.isFree ? "1px solid rgba(34,197,94,0.25)" : "none",
                      }}
                    >
                      {poi.isFree ? "✓ Free" : `€${poi.estimatedCost}`}
                    </span>
                    {poi.isMustSee && (
                      <span
                        style={{
                          background: "rgba(219,39,119,0.15)",
                          color: "#f472b6",
                          borderRadius: 99,
                          padding: "2px 8px",
                          fontSize: 11,
                          border: "1px solid rgba(219,39,119,0.25)",
                        }}
                      >
                        ★ Must See
                      </span>
                    )}
                  </div>

                  {/* Transport segment to this stop */}
                  {seg && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        paddingTop: 6,
                        marginTop: 4,
                      }}
                    >
                      {seg.instruction}
                    </p>
                  )}

                  {/* Opening hours */}
                  {poi.openingHours && (
                    <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                      🕐 {poi.openingHours}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Day legend overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          zIndex: 1000,
          background: "rgba(13,10,26,0.88)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: "10px 14px",
          maxWidth: 200,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <p
          style={{
            color: legendColor(transportMode),
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 6,
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {transportLabel(transportMode)}
        </p>
        {pois.map((poi, idx) => (
          <div
            key={poi.id}
            style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}
          >
            <span
              style={{
                background: rc.color,
                color: "#fff",
                borderRadius: "50%",
                width: 17,
                height: 17,
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {idx + 1}
            </span>
            <span
              style={{
                color: "#e2e8f0",
                fontSize: 11,
                fontFamily: "Inter, sans-serif",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 145,
              }}
            >
              {poi.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
