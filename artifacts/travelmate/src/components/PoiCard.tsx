import { Clock, Euro, Star, Footprints, Car, Bus } from "lucide-react";
import type { Poi } from "@workspace/api-client-react";
import { formatCurrency, formatDuration } from "@/lib/utils";

interface PoiCardProps {
  poi: Poi;
  index: number;
  transportMode?: string;
}

const CAT_EMOJI: Record<string, string> = {
  museum:        "🏛️",
  viewpoint:     "🌅",
  history:       "⚔️",
  culture:       "🎭",
  nature:        "🌿",
  gastronomy:    "🍽️",
  nightlife:     "🌙",
  architecture:  "⛪",
  entertainment: "🎡",
  sports:        "⚽",
  relaxation:    "🧘",
  landmark:      "📍",
  photography:   "📸",
};

const CAT_LABEL: Record<string, string> = {
  museum:        "Museum",
  viewpoint:     "Viewpoint",
  history:       "Historic site",
  culture:       "Culture",
  nature:        "Nature",
  gastronomy:    "Food & Drink",
  nightlife:     "Nightlife",
  architecture:  "Architecture",
  entertainment: "Entertainment",
  sports:        "Sports",
  relaxation:    "Relaxation",
  landmark:      "Landmark",
  photography:   "Photography",
};

// Accent colour per category (used as accent stripe + badge)
const CAT_COLOUR: Record<string, { stripe: string; badge: string; dot: string }> = {
  museum:        { stripe: "bg-blue-600/40",    badge: "bg-blue-500/12 text-blue-300 border-blue-500/20",    dot: "bg-blue-400" },
  viewpoint:     { stripe: "bg-orange-500/40",  badge: "bg-orange-500/12 text-orange-300 border-orange-500/20", dot: "bg-orange-400" },
  history:       { stripe: "bg-amber-600/40",   badge: "bg-amber-500/12 text-amber-300 border-amber-500/20",  dot: "bg-amber-400" },
  culture:       { stripe: "bg-purple-600/40",  badge: "bg-purple-500/12 text-purple-300 border-purple-500/20", dot: "bg-purple-400" },
  nature:        { stripe: "bg-emerald-600/40", badge: "bg-emerald-500/12 text-emerald-300 border-emerald-500/20", dot: "bg-emerald-400" },
  gastronomy:    { stripe: "bg-red-600/40",     badge: "bg-red-500/12 text-red-300 border-red-500/20",      dot: "bg-red-400" },
  nightlife:     { stripe: "bg-indigo-600/40",  badge: "bg-indigo-500/12 text-indigo-300 border-indigo-500/20", dot: "bg-indigo-400" },
  architecture:  { stripe: "bg-violet-600/40",  badge: "bg-violet-500/12 text-violet-300 border-violet-500/20", dot: "bg-violet-400" },
  entertainment: { stripe: "bg-pink-600/40",    badge: "bg-pink-500/12 text-pink-300 border-pink-500/20",    dot: "bg-pink-400" },
  sports:        { stripe: "bg-lime-600/40",    badge: "bg-lime-500/12 text-lime-300 border-lime-500/20",    dot: "bg-lime-400" },
  relaxation:    { stripe: "bg-teal-600/40",    badge: "bg-teal-500/12 text-teal-300 border-teal-500/20",    dot: "bg-teal-400" },
  landmark:      { stripe: "bg-yellow-600/40",  badge: "bg-yellow-500/12 text-yellow-300 border-yellow-500/20", dot: "bg-yellow-400" },
  photography:   { stripe: "bg-rose-600/40",    badge: "bg-rose-500/12 text-rose-300 border-rose-500/20",    dot: "bg-rose-400" },
};

const DEFAULT_COLOUR = {
  stripe: "bg-primary/40",
  badge: "bg-primary/12 text-primary border-primary/20",
  dot: "bg-primary",
};

export function PoiCard({ poi, index, transportMode }: PoiCardProps) {
  const emoji = CAT_EMOJI[poi.category] ?? "📍";
  const catLabel = CAT_LABEL[poi.category] ?? poi.category;
  const colour = CAT_COLOUR[poi.category] ?? DEFAULT_COLOUR;

  return (
    <div className="group relative rounded-2xl border border-white/8 bg-card/35 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-primary/25 hover:bg-card/55 hover:shadow-xl hover:shadow-primary/8">
      {/* Left accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${colour.stripe} group-hover:opacity-80 transition-opacity`} />

      <div className="flex pl-3 pr-4 py-4 gap-3">

        {/* Step number + emoji */}
        <div className="shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
          <div className="w-7 h-7 rounded-full bg-primary/90 text-white text-xs font-bold flex items-center justify-center shadow-[0_0_8px_rgba(124,58,237,0.4)] border border-white/20">
            {index}
          </div>
          <span className="text-lg leading-none">{emoji}</span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">

          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-display font-bold text-[15px] leading-snug text-foreground line-clamp-2">
              {poi.name}
            </h4>
            {poi.isMustSee && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-accent/20 text-accent border border-accent/30 uppercase">
                <Star className="w-2.5 h-2.5 fill-current" /> Must See
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground/75 line-clamp-2 mb-2.5 leading-relaxed">
            {poi.description || "A notable attraction worth visiting on your journey."}
          </p>

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-1.5">

            {/* Category */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${colour.badge}`}>
              {catLabel}
            </span>

            {/* Duration */}
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md border border-white/8">
              <Clock className="w-3 h-3" />
              {formatDuration(poi.estimatedDuration)}
            </span>

            {/* Cost */}
            {poi.isFree ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <span className={`w-1.5 h-1.5 rounded-full ${colour.dot} inline-block`} />
                Free entry
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/80 bg-amber-500/8 px-2 py-0.5 rounded-md border border-amber-500/15">
                <Euro className="w-3 h-3" />
                {formatCurrency(poi.estimatedCost)} entry
              </span>
            )}
          </div>

          {/* Optional paid upgrade */}
          {poi.isFree && poi.optionalPaidExperience && poi.optionalPaidCost && (
            <div className="mt-2.5 flex items-start gap-2 text-[11px] rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
              <Star className="w-3 h-3 text-primary/60 shrink-0 mt-0.5" />
              <span className="text-muted-foreground leading-snug">
                <span className="font-semibold text-primary/80">Premium option:</span>{" "}
                {poi.optionalPaidExperience}{" "}
                <span className="text-accent font-semibold">+{formatCurrency(poi.optionalPaidCost)}</span>
              </span>
            </div>
          )}

          {/* Opening hours */}
          {poi.openingHours && (
            <p className="mt-2 text-[11px] text-muted-foreground/45 truncate">
              🕐 {poi.openingHours}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
