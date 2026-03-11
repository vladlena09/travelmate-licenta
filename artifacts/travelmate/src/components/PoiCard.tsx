import { Clock, Euro, MapPin, Star, Landmark } from "lucide-react";
import type { Poi } from "@workspace/api-client-react";
import { formatCurrency, formatDuration } from "@/lib/utils";

interface PoiCardProps {
  poi: Poi;
  index: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  museum: "🏛️",
  viewpoint: "🌅",
  history: "⚔️",
  culture: "🎭",
  nature: "🌿",
  gastronomy: "🍽️",
  nightlife: "🌙",
  architecture: "🏛️",
  entertainment: "🎡",
  sports: "⚽",
  relaxation: "🧘",
  landmark: "📍",
  photography: "📸",
};

const CATEGORY_COLORS: Record<string, string> = {
  museum: "from-blue-600/20 to-blue-900/10",
  viewpoint: "from-orange-600/20 to-orange-900/10",
  history: "from-amber-600/20 to-amber-900/10",
  culture: "from-purple-600/20 to-purple-900/10",
  nature: "from-green-600/20 to-green-900/10",
  gastronomy: "from-red-600/20 to-red-900/10",
  nightlife: "from-indigo-600/20 to-indigo-900/10",
  architecture: "from-violet-600/20 to-violet-900/10",
  entertainment: "from-pink-600/20 to-pink-900/10",
  sports: "from-lime-600/20 to-lime-900/10",
  relaxation: "from-teal-600/20 to-teal-900/10",
  landmark: "from-yellow-600/20 to-yellow-900/10",
  photography: "from-rose-600/20 to-rose-900/10",
};

export function PoiCard({ poi, index }: PoiCardProps) {
  const icon = CATEGORY_ICONS[poi.category] ?? "📍";
  const gradient = CATEGORY_COLORS[poi.category] ?? "from-primary/20 to-primary/5";

  return (
    <div className="group rounded-2xl border border-white/8 bg-card/40 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-primary/30 hover:bg-card/60 hover:shadow-lg hover:shadow-primary/10">
      <div className="flex gap-0">
        {/* Left colour strip with number */}
        <div className={`w-14 shrink-0 flex flex-col items-center justify-start pt-4 gap-2 bg-gradient-to-b ${gradient}`}>
          <div className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.5)] border border-white/20">
            {index}
          </div>
          <span className="text-xl leading-none">{icon}</span>
          {/* Connecting line to next card */}
          <div className="flex-1 w-0.5 mt-2 bg-gradient-to-b from-primary/30 to-transparent min-h-[20px]" />
        </div>

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-display font-bold text-base leading-tight text-foreground line-clamp-2">
              {poi.name}
            </h4>
            {poi.isMustSee && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/30">
                <Star className="w-3 h-3 fill-current" /> Must See
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {poi.description || "A wonderful place to visit on your journey."}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs bg-white/5 text-muted-foreground px-2 py-1 rounded-md border border-white/8">
              <Clock className="w-3 h-3" />
              {formatDuration(poi.estimatedDuration)}
            </span>

            {poi.isFree ? (
              <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-md border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Free
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-white/5 text-muted-foreground px-2 py-1 rounded-md border border-white/8">
                <Euro className="w-3 h-3" />
                {formatCurrency(poi.estimatedCost)}
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary/80 px-2 py-1 rounded-md border border-primary/20 capitalize">
              <MapPin className="w-3 h-3" />
              {poi.category.replace(/_/g, " ")}
            </span>
          </div>

          {/* Optional paid upgrade */}
          {poi.isFree && poi.optionalPaidExperience && poi.optionalPaidCost && (
            <div className="mt-3 text-xs bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-muted-foreground">
              <span className="text-primary/70 font-medium">Optional: </span>
              {poi.optionalPaidExperience}{" "}
              <span className="text-accent/80">+€{poi.optionalPaidCost}</span>
            </div>
          )}

          {/* Opening hours */}
          {poi.openingHours && (
            <p className="mt-2 text-xs text-muted-foreground/60 truncate">
              🕐 {poi.openingHours}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
