import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useGenerateItinerary } from "@workspace/api-client-react";
import type { ItineraryRequest, ItineraryResponse } from "@workspace/api-client-react";
import { useTripStore } from "@/store/use-trip-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/utils";
import { ItineraryMap } from "@/components/Map";
import { PoiCard } from "@/components/PoiCard";
import {
  Calendar, Footprints, Users, Car, Heart,
  MapPin, ChevronRight, ArrowLeft, Sparkles, Bus,
  Clock, Euro, TrendingUp, Wallet, RefreshCw,
  Star, Gem, Sun, Sunrise, Coffee,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────
const BUDGET_PRESETS = [50, 100, 200, 500, 1000];

const RHYTHMS = [
  { id: "relaxed", label: "Relaxed", emoji: "😌", desc: "2–4 stops/day — unhurried, with room to linger" },
  { id: "balanced", label: "Balanced", emoji: "⚖️", desc: "4–6 stops/day — comfortable mix of sights and rest" },
  { id: "dynamic", label: "Dynamic", emoji: "⚡", desc: "6–8 stops/day — pack in as much as possible" },
];

const PROFILES = [
  { id: "solo", label: "Solo", emoji: "🧍", desc: "Independent, cultural, flexible" },
  { id: "couple", label: "Couple", emoji: "💑", desc: "Romantic, scenic, gastronomic" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧‍👦", desc: "Kid-friendly, safe, fun" },
  { id: "group", label: "Group", emoji: "👥", desc: "Social, food, entertainment" },
];

const TRANSPORTS = [
  { id: "walking", label: "Walking", icon: Footprints, desc: "Compact routes • attractions within 2 km • natural walking order" },
  { id: "public_transport", label: "Public Transit", icon: Bus, desc: "Metro + bus legs • boarding & exit shown • short walks between stops" },
  { id: "car", label: "Car", icon: Car, desc: "Wider range • farther attractions • parking notes included" },
];

const START_TIMES = [
  { id: "early", label: "Early Bird", emoji: "🌅", desc: "Start at 8:00 AM — beat the crowds" },
  { id: "normal", label: "Morning Start", emoji: "☀️", desc: "Start at 9:30 AM — relaxed morning" },
  { id: "late", label: "Late Riser", emoji: "☕", desc: "Start at 11:00 AM — leisurely pace" },
];

const PRIORITY_MODES = [
  { id: "iconic", label: "Iconic Landmarks", emoji: "🏛️", desc: "Famous sights, must-sees, world-class attractions first" },
  { id: "mixed", label: "Mix + Hidden Gems", emoji: "💎", desc: "Blend iconic spots with local secrets and lesser-known places" },
];

const INTERESTS = [
  { id: "history", emoji: "⚔️", label: "History" },
  { id: "gastronomy", emoji: "🍽️", label: "Food" },
  { id: "culture", emoji: "🎭", label: "Culture" },
  { id: "nature", emoji: "🌿", label: "Nature" },
  { id: "architecture", emoji: "🏛️", label: "Architecture" },
  { id: "nightlife", emoji: "🌙", label: "Nightlife" },
  { id: "sports", emoji: "⚽", label: "Sports" },
  { id: "relaxation", emoji: "🧘", label: "Relaxation" },
  { id: "photography", emoji: "📸", label: "Photography" },
];

// ── Transport helpers ─────────────────────────────────────────
function transportBadgeClass(mode: string) {
  switch (mode) {
    case "walking":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
    case "car":
      return "text-orange-400 bg-orange-500/10 border-orange-500/25";
    case "public_transport":
      return "text-sky-400 bg-sky-500/10 border-sky-500/25";
    default:
      return "text-muted-foreground";
  }
}

function transportIcon(mode: string, size = "w-3 h-3") {
  switch (mode) {
    case "walking":
      return <Footprints className={size} />;
    case "car":
      return <Car className={size} />;
    case "public_transport":
      return <Bus className={size} />;
    default:
      return null;
  }
}

function transportLabel(mode: string) {
  switch (mode) {
    case "walking":
      return "Walking";
    case "car":
      return "Car";
    case "public_transport":
      return "Transit";
    default:
      return mode;
  }
}

// ── Profile helpers ───────────────────────────────────────────
function profileEmoji(profile: string) {
  return PROFILES.find((p) => p.id === profile)?.emoji ?? "🧳";
}

function rhythmEmoji(rhythm: string) {
  return RHYTHMS.find((r) => r.id === rhythm)?.emoji ?? "⚖️";
}

// ── Response normalization ────────────────────────────────────
function requestFallbackCity(raw: any) {
  return raw?.meta?.city ?? raw?.destinationCity ?? raw?.request?.city ?? "Unknown";
}

function normalizeItineraryResponse(raw: any): ItineraryResponse {
  const rawDays = raw?.days ?? raw?.daysPlan ?? [];

  return {
    ...raw,
    city: raw?.city ?? raw?.meta?.city ?? requestFallbackCity(raw),
    country: raw?.country ?? raw?.meta?.country ?? "",
    transportMode: raw?.transportMode ?? "walking",
    totalEstimatedCost: raw?.totalEstimatedCost ?? 0,
    budgetRemaining: raw?.budgetRemaining ?? 0,
    budgetAmount: raw?.budgetAmount ?? 0,
    days: rawDays.map((day: any, index: number) => ({
      ...day,
      dayNumber: day?.dayNumber ?? index + 1,
      pois: day?.pois ?? day?.items ?? [],
      suggestions: day?.suggestions ?? [],
      segments: day?.segments ?? [],
      totalCost: day?.totalCost ?? 0,
      totalDuration: day?.totalDuration ?? 0,
      theme: day?.theme ?? `Day ${day?.dayNumber ?? index + 1}`,
    })),
  } as ItineraryResponse;
}

// ── Main component ────────────────────────────────────────────
export function Planner() {
  const {
    step,
    nextStep,
    prevStep,
    request,
    updateRequest,
    result,
    setResult,
    selectedDay,
    setSelectedDay,
    reset,
  } = useTripStore();

  const [budgetInput, setBudgetInput] = useState(String(request.budgetAmount ?? 200));
  const generateMutation = useGenerateItinerary();

  useEffect(() => {
    if (request.budgetAmount !== undefined && request.budgetAmount !== null) {
      setBudgetInput(String(request.budgetAmount));
    }
  }, [request.budgetAmount]);

  const handleGenerate = async () => {
    if (!request.city?.trim()) return;

    try {
      const response = await generateMutation.mutateAsync({
        data: request as ItineraryRequest,
      });

      console.log("Generate response:", response);

      const normalized = normalizeItineraryResponse(response);

      if (!normalized.days || normalized.days.length === 0) {
        console.error("Response has no days:", response);
        return;
      }

      setResult(normalized);
      setSelectedDay(normalized.days[0].dayNumber);
    } catch (err) {
      console.error("Failed to generate itinerary:", err);
    }
  };

  const handleRegenerateDay = async (dayNumber: number) => {
    if (!result) return;

    try {
      const response = await generateMutation.mutateAsync({
        data: {
          ...(request as ItineraryRequest),
          regenerateDayNumber: dayNumber,
        } as unknown as ItineraryRequest,
      });

      console.log("Regenerate response:", response);

      const normalized = normalizeItineraryResponse(response);
      const regeneratedDay = (normalized.days ?? []).find((d) => d.dayNumber === dayNumber);

      if (regeneratedDay) {
        const merged: ItineraryResponse = {
          ...result,
          days: (result.days ?? []).map((d) =>
            d.dayNumber === dayNumber ? regeneratedDay : d
          ),
          totalEstimatedCost: normalized.totalEstimatedCost,
          budgetRemaining: normalized.budgetRemaining,
          budgetAmount: normalized.budgetAmount ?? result.budgetAmount,
        };

        setResult(merged);
      }
    } catch (err) {
      console.error("Failed to regenerate day:", err);
    }
  };

  const isGenerating = generateMutation.isPending;

  // ── RESULT VIEW ─────────────────────────────────────────────
  if (result) {
    const safeDays = result.days ?? [];
    const dayData = safeDays.find((d) => d.dayNumber === selectedDay) ?? safeDays[0];

    if (!dayData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
          Unable to display itinerary. No days were returned by the API.
        </div>
      );
    }

    const budgetDefined = (result.budgetAmount ?? 0) > 0;
    const budgetPct = budgetDefined
      ? Math.min(100, (result.totalEstimatedCost / (result.budgetAmount ?? 1)) * 100)
      : 0;

    const dayFreePois =
      (dayData as any).freePoisCount ?? dayData.pois.filter((p: any) => p.isFree).length;
    const dayPaidPois =
      (dayData as any).paidPoisCount ?? dayData.pois.filter((p: any) => !p.isFree).length;
    const dayStartLabel = (dayData as any).startTimeLabel ?? "Starting 9:30 AM";

    return (
      <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-background">
        <div className="w-full md:w-[460px] lg:w-[500px] flex flex-col h-full border-r border-border bg-card/20 backdrop-blur-xl z-10 shadow-2xl">
          <div className="p-5 border-b border-border/60 bg-card/60 shrink-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-display font-bold leading-tight truncate">
                  {result.city}
                  {result.country && result.country !== result.city && (
                    <span className="text-muted-foreground font-normal text-base">
                      , {result.country}
                    </span>
                  )}
                </h2>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                    <Calendar className="w-3 h-3" />
                    {safeDays.length} {safeDays.length === 1 ? "day" : "days"}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${transportBadgeClass(
                      result.transportMode
                    )}`}
                  >
                    {transportIcon(result.transportMode)}
                    {transportLabel(result.transportMode)}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                    {profileEmoji(request.travelProfile ?? "couple")}{" "}
                    {request.travelProfile ?? "couple"}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                    {rhythmEmoji(request.travelRhythm ?? "balanced")}{" "}
                    {request.travelRhythm ?? "balanced"}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                  Total Cost
                </p>
                <p className="text-2xl font-bold text-accent">
                  {formatCurrency(result.totalEstimatedCost)}
                </p>
                {budgetDefined && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    of {formatCurrency(result.budgetAmount ?? 0)}
                    {(result.budgetRemaining ?? 0) > 0 && (
                      <span className="text-emerald-400 font-medium ml-1">
                        ({formatCurrency(result.budgetRemaining ?? 0)} left)
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {budgetDefined && (
              <div className="mb-3">
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      budgetPct > 90
                        ? "bg-red-500"
                        : budgetPct > 70
                        ? "bg-amber-500"
                        : "bg-gradient-to-r from-primary to-accent"
                    }`}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {safeDays.map((day) => (
                <button
                  key={day.dayNumber}
                  onClick={() => setSelectedDay(day.dayNumber)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    selectedDay === day.dayNumber
                      ? "bg-primary text-white shadow-lg shadow-primary/30"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}
                >
                  Day {day.dayNumber}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDay}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="p-5 space-y-3"
              >
                <div className="rounded-2xl border border-white/8 bg-white/3 p-4 mb-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold leading-tight">
                        {(dayData as any).theme}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">{dayStartLabel}</p>
                    </div>

                    <button
                      onClick={() => handleRegenerateDay(selectedDay)}
                      disabled={isGenerating}
                      title="Regenerate this day with different attractions"
                      className="shrink-0 p-2 rounded-xl bg-white/5 hover:bg-primary/20 border border-white/8 hover:border-primary/30 text-muted-foreground hover:text-primary transition-all duration-200 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {dayData.pois.length} stops
                    </span>

                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.round((((dayData as any).totalDuration ?? 0) as number) / 60)}h visit
                      {((dayData as any).travelDuration ?? 0) > 0 && (
                        <> + {(dayData as any).travelDuration}min travel</>
                      )}
                    </span>

                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Euro className="w-3 h-3" />
                      {formatCurrency((dayData as any).totalCost ?? 0)}
                    </span>

                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      {dayFreePois} free
                    </span>

                    {dayPaidPois > 0 && (
                      <span className="text-xs text-amber-400 flex items-center gap-1">
                        <Euro className="w-3 h-3" />
                        {dayPaidPois} paid
                      </span>
                    )}
                  </div>

                  <div
                    className={`mt-2.5 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${transportBadgeClass(
                      result.transportMode
                    )}`}
                  >
                    {transportIcon(result.transportMode)}
                    {(dayData as any).transportSummary ?? ""}
                  </div>
                </div>

                {dayData.pois.map((poi: any, idx: number) => (
                  <div key={poi.id}>
                    <PoiCard poi={poi} index={idx + 1} transportMode={result.transportMode} />

                    {idx < dayData.pois.length - 1 && (dayData as any).segments?.[idx] && (
                      <div className="flex items-center gap-2 py-0.5 pl-4 pr-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-px h-2 bg-primary/20" />
                          <div
                            className={`p-1 rounded-full border ${transportBadgeClass(
                              result.transportMode
                            )}`}
                          >
                            {transportIcon(result.transportMode, "w-2.5 h-2.5")}
                          </div>
                          <div className="w-px h-2 bg-primary/20" />
                        </div>

                        <span className="text-xs text-muted-foreground/55 truncate leading-tight">
                          {(dayData as any).segments[idx].instruction}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-4 pb-6">
                  <Button
                    variant="outline"
                    className="w-full text-muted-foreground"
                    onClick={reset}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Plan Another Trip
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 h-[50vh] md:h-full relative">
          <ItineraryMap
            key={selectedDay}
            pois={dayData.pois}
            segments={(dayData as any).segments ?? []}
            transportMode={result.transportMode}
          />
        </div>
      </div>
    );
  }

  // ── LOADING ──────────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="glass-panel p-12 rounded-3xl max-w-sm w-full text-center relative z-10 flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-2 border-2 border-accent/20 border-b-accent rounded-full"
            />
            <MapPin className="absolute inset-0 m-auto w-7 h-7 text-primary" />
          </div>

          <div>
            <h2 className="text-2xl font-display font-bold mb-2">Crafting Your Journey</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Finding the best of <strong className="text-foreground">{request.city}</strong>
              {request.country ? `, ${request.country}` : ""}…
            </p>
            <p className="text-muted-foreground/60 text-xs mt-2">
              Scoring attractions · clustering routes · fitting your budget
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── WIZARD ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="absolute inset-0 bg-background z-0" />
      <div className="absolute top-0 inset-x-0 h-[60vh] bg-gradient-to-b from-primary/8 to-transparent z-0 pointer-events-none" />

      <header className="relative z-10 p-6 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 text-xl font-display font-bold cursor-pointer hover:text-primary transition-colors">
            <MapPin className="w-6 h-6 text-primary" /> TravelMate
          </div>
        </Link>

        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-500 ${
                i === step
                  ? "w-8 bg-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                  : i < step
                  ? "w-4 bg-primary/50"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center pt-4 pb-8 px-4 md:px-6 relative z-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.28 }}
              className="glass-panel p-8 md:p-10 rounded-3xl"
            >
              {step === 1 && (
                <div className="space-y-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                      Step 1 of 4
                    </p>
                    <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">
                      Where to?
                    </h2>
                    <p className="text-muted-foreground">
                      Enter your destination and we'll find the best it has to offer.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        City *
                      </label>
                      <Input
                        placeholder="e.g., Paris, Rome, Tokyo, Kyoto…"
                        value={request.city || ""}
                        onChange={(e) => updateRequest({ city: e.target.value })}
                        autoFocus
                        className="text-base"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Country{" "}
                        <span className="text-muted-foreground/40 font-normal">
                          (optional — helps with smaller cities)
                        </span>
                      </label>
                      <Input
                        placeholder="e.g., France, Moldova, Japan…"
                        value={request.country || ""}
                        onChange={(e) => updateRequest({ country: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                      Step 2 of 4
                    </p>
                    <h2 className="text-3xl font-display font-bold mb-2">Time & Budget</h2>
                    <p className="text-muted-foreground">
                      How long are you visiting, and what's your total spend?
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <label className="text-sm font-medium text-muted-foreground">Duration</label>
                      <span className="text-2xl font-bold text-primary">
                        {request.days} {request.days === 1 ? "Day" : "Days"}
                      </span>
                    </div>

                    <Slider
                      min={1}
                      max={14}
                      step={1}
                      value={[request.days || 3]}
                      onValueChange={([val]) => updateRequest({ days: val })}
                    />

                    <div className="flex justify-between text-xs text-muted-foreground/40 mt-2">
                      <span>1 day</span>
                      <span>14 days</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4" /> Total Trip Budget (EUR)
                    </label>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {BUDGET_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => {
                            setBudgetInput(String(preset));
                            updateRequest({ budgetAmount: preset });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                            request.budgetAmount === preset
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-white/8 bg-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/20 hover:text-foreground"
                          }`}
                        >
                          €{preset}
                        </button>
                      ))}

                      <button
                        onClick={() => {
                          setBudgetInput("0");
                          updateRequest({ budgetAmount: 0 });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                          request.budgetAmount === 0
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-white/8 bg-white/5 text-muted-foreground hover:bg-white/10"
                        }`}
                      >
                        ∞ No limit
                      </button>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg pointer-events-none">
                        €
                      </span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Or enter any amount…"
                        className="pl-9 text-lg font-bold"
                        value={budgetInput}
                        onChange={(e) => {
                          setBudgetInput(e.target.value);
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) updateRequest({ budgetAmount: val });
                        }}
                      />
                    </div>

                    {(request.budgetAmount ?? 0) > 0 && (
                      <div className="mt-2 p-3 rounded-xl bg-white/3 border border-white/8 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {formatCurrency(
                            Math.round((request.budgetAmount ?? 0) / (request.days ?? 1))
                          )}{" "}
                          / day
                        </span>
                        {(request.budgetAmount ?? 0) < 60 &&
                          " — free attractions prioritised, minimal paid entry"}
                        {(request.budgetAmount ?? 0) >= 60 &&
                          (request.budgetAmount ?? 0) < 160 &&
                          " — mix of free and affordable paid attractions"}
                        {(request.budgetAmount ?? 0) >= 160 &&
                          " — full access to premium and paid experiences"}
                      </div>
                    )}

                    {(request.budgetAmount ?? 0) === 0 && (
                      <p className="mt-2 text-xs text-muted-foreground/60">
                        No limit — best attractions selected regardless of entry price.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                      Step 3 of 4
                    </p>
                    <h2 className="text-3xl font-display font-bold mb-2">Your Style</h2>
                    <p className="text-muted-foreground">Who's travelling and at what pace?</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-3 block">
                      Travelling as
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {PROFILES.map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            updateRequest({
                              travelProfile: p.id as ItineraryRequest["travelProfile"],
                            })
                          }
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            request.travelProfile === p.id
                              ? "border-primary bg-primary/10"
                              : "border-white/6 bg-white/4 hover:bg-white/8 hover:border-white/15"
                          }`}
                        >
                          <div className="text-2xl mb-1.5">{p.emoji}</div>
                          <div
                            className={`font-bold text-sm ${
                              request.travelProfile === p.id ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {p.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" /> Travel Rhythm
                    </label>
                    <div className="space-y-2.5">
                      {RHYTHMS.map((r) => (
                        <button
                          key={r.id}
                          onClick={() =>
                            updateRequest({
                              travelRhythm: r.id as ItineraryRequest["travelRhythm"],
                            })
                          }
                          className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
                            request.travelRhythm === r.id
                              ? "border-primary bg-primary/10"
                              : "border-white/6 bg-white/4 hover:bg-white/8"
                          }`}
                        >
                          <span className="text-xl shrink-0">{r.emoji}</span>
                          <div className="flex-1">
                            <div
                              className={`font-bold text-sm ${
                                request.travelRhythm === r.id ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {r.label}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                          </div>
                          {request.travelRhythm === r.id && (
                            <Sparkles className="w-4 h-4 text-accent shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                      Step 4 of 4
                    </p>
                    <h2 className="text-3xl font-display font-bold mb-2">Final Touches</h2>
                    <p className="text-muted-foreground">
                      Set your transport, preferred start time, attraction style, and interests.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-3 block">
                      Transport Mode
                    </label>
                    <div className="space-y-2.5">
                      {TRANSPORTS.map((t) => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.id}
                            onClick={() =>
                              updateRequest({
                                transportMode: t.id as ItineraryRequest["transportMode"],
                              })
                            }
                            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
                              request.transportMode === t.id
                                ? "border-primary bg-primary/10"
                                : "border-white/6 bg-white/4 hover:bg-white/8"
                            }`}
                          >
                            <Icon
                              className={`w-6 h-6 shrink-0 ${
                                request.transportMode === t.id
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div
                                className={`font-bold text-sm ${
                                  request.transportMode === t.id
                                    ? "text-primary"
                                    : "text-foreground"
                                }`}
                              >
                                {t.label}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {t.desc}
                              </div>
                            </div>
                            {request.transportMode === t.id && (
                              <Sparkles className="w-4 h-4 text-accent shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-3 block">
                      Preferred Start Time
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {START_TIMES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() =>
                            updateRequest({ startTime: s.id as ItineraryRequest["startTime"] })
                          }
                          className={`p-3.5 rounded-2xl border-2 transition-all text-center ${
                            request.startTime === s.id
                              ? "border-primary bg-primary/10"
                              : "border-white/6 bg-white/4 hover:bg-white/8"
                          }`}
                        >
                          <div className="text-xl mb-1">{s.emoji}</div>
                          <div
                            className={`font-bold text-xs ${
                              request.startTime === s.id ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {s.label}
                          </div>
                          <div className="text-xs text-muted-foreground/70 mt-0.5 leading-tight">
                            {s.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-3 block">
                      Attraction Style
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {PRIORITY_MODES.map((m) => (
                        <button
                          key={m.id}
                          onClick={() =>
                            updateRequest({
                              priorityMode: m.id as ItineraryRequest["priorityMode"],
                            })
                          }
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            request.priorityMode === m.id
                              ? "border-primary bg-primary/10"
                              : "border-white/6 bg-white/4 hover:bg-white/8"
                          }`}
                        >
                          <div className="text-2xl mb-1.5">{m.emoji}</div>
                          <div
                            className={`font-bold text-sm leading-tight ${
                              request.priorityMode === m.id ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {m.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 leading-tight">
                            {m.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-3 block">
                      Interests{" "}
                      <span className="text-muted-foreground/40 font-normal">
                        (optional — fine-tunes selection)
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INTERESTS.map(({ id, emoji, label }) => {
                        const isSelected = request.interests?.includes(id as any);
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              const curr = request.interests || [];
                              updateRequest({
                                interests: isSelected
                                  ? curr.filter((i) => i !== id)
                                  : [...curr, id as any],
                              });
                            }}
                            className={`px-3.5 py-2 rounded-full border-2 text-sm font-medium transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? "border-accent bg-accent/20 text-accent shadow-[0_0_8px_rgba(219,39,119,0.2)]"
                                : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/20 hover:text-foreground"
                            }`}
                          >
                            <span>{emoji}</span> {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/8">
                {step > 1 ? (
                  <Button variant="ghost" onClick={prevStep} className="text-muted-foreground">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                ) : (
                  <div />
                )}

                {step < 4 ? (
                  <Button onClick={nextStep} disabled={step === 1 && !request.city?.trim()}>
                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleGenerate}
                    className="bg-gradient-to-r from-primary to-accent border-none shadow-lg shadow-primary/25"
                  >
                    Generate Itinerary <Sparkles className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}