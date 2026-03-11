import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import type { Poi } from "@workspace/api-client-react";

interface MapProps {
  pois: Poi[];
  routePolyline?: string | null;
}

// Utility to fit bounds when POIs change
function MapUpdater({ pois }: { pois: Poi[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (pois.length > 0) {
      const bounds = L.latLngBounds(pois.map(p => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [pois, map]);
  
  return null;
}

export function ItineraryMap({ pois, routePolyline }: MapProps) {
  const createNumberedIcon = (number: number) => {
    return L.divIcon({
      className: 'bg-transparent border-none',
      html: `<div class="custom-marker">${number}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  // Decode polyline (simplified version or use an external library in real app if complex)
  // For this, we'll draw straight lines between POIs if routePolyline isn't parsed
  const positions: [number, number][] = pois.map(p => [p.lat, p.lon]);

  if (pois.length === 0) return null;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 relative z-0">
      <MapContainer 
        center={[pois[0].lat, pois[0].lon]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapUpdater pois={pois} />

        {pois.map((poi, index) => (
          <Marker 
            key={poi.id} 
            position={[poi.lat, poi.lon]}
            icon={createNumberedIcon(index + 1)}
          >
            <Popup className="premium-popup">
              <div className="p-1 min-w-[200px]">
                <h4 className="font-display font-bold text-lg mb-1">{poi.name}</h4>
                <p className="text-sm text-muted-foreground capitalize mb-2">{poi.category}</p>
                {poi.imageUrl && (
                  <img src={poi.imageUrl} alt={poi.name} className="w-full h-24 object-cover rounded-md mb-2" />
                )}
                <p className="text-xs line-clamp-3">{poi.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {positions.length > 1 && (
          <Polyline 
            positions={positions} 
            color="url(#line-gradient)" // CSS gradient not directly supported in Leaflet standard SVG, using solid primary
            pathOptions={{ color: '#7c3aed', weight: 4, dashArray: '8, 8', opacity: 0.8 }} 
          />
        )}
      </MapContainer>
    </div>
  );
}
