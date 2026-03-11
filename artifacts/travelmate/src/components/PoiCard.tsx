import { Clock, Euro, MapPin, Star, ImageOff } from "lucide-react";
import type { Poi } from "@workspace/api-client-react";
import { Badge } from "./ui/badge";
import { formatCurrency, formatDuration } from "@/lib/utils";

interface PoiCardProps {
  poi: Poi;
  index: number;
}

export function PoiCard({ poi, index }: PoiCardProps) {
  return (
    <div className="glass-card rounded-2xl p-4 flex gap-4 relative overflow-hidden group">
      <div className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-sm font-bold text-white border border-white/20">
        {index}
      </div>
      
      <div className="w-32 h-32 shrink-0 rounded-xl overflow-hidden bg-muted relative">
        {poi.imageUrl ? (
          <img 
            src={poi.imageUrl} 
            alt={poi.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/poi-placeholder.png`;
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <ImageOff className="w-8 h-8 mb-2 opacity-50" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-display font-bold text-lg leading-tight truncate">
            {poi.name}
          </h4>
          {poi.isMustSee && <Badge variant="accent" className="shrink-0">Must See</Badge>}
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {poi.description || "A wonderful place to visit on your journey."}
        </p>
        
        <div className="flex flex-wrap gap-2 text-xs font-medium mt-auto">
          <div className="flex items-center text-primary-foreground bg-white/5 px-2 py-1 rounded-md border border-white/5">
            <Clock className="w-3 h-3 mr-1" />
            {formatDuration(poi.estimatedDuration)}
          </div>
          <div className="flex items-center text-primary-foreground bg-white/5 px-2 py-1 rounded-md border border-white/5">
            <Euro className="w-3 h-3 mr-1" />
            {poi.isFree ? "Free" : formatCurrency(poi.estimatedCost)}
          </div>
          <div className="flex items-center text-primary-foreground bg-white/5 px-2 py-1 rounded-md border border-white/5 capitalize">
            <MapPin className="w-3 h-3 mr-1" />
            {poi.category.replace('_', ' ')}
          </div>
        </div>
      </div>
    </div>
  );
}
