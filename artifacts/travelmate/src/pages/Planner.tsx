import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useGenerateItinerary } from "@workspace/api-client-react";
import type { ItineraryRequest } from "@workspace/api-client-react";
import { useTripStore } from "@/store/use-trip-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/utils";
import { ItineraryMap } from "@/components/Map";
import { PoiCard } from "@/components/PoiCard";
import {
  Plane, Calendar, Footprints, Users, Car, Heart,
  MapPin, ChevronRight, ArrowLeft, Sparkles, Bus,
  Clock, Euro, TrendingUp, Wallet
} from "lucide-react";

const BUDGET_PRESETS = [50, 100, 200, 500, 1000];

const RHYTHMS = [
  { id: "relaxed",  label: "Relaxed",  desc: "2–4 stops/day — slow pace, plenty of rest" },
  { id: "balanced", label: "Balanced", desc: "4–6 stops/day — comfortable mix of sights and leisure" },
  { id: "dynamic",  label: "Dynamic",  desc: "6–8 stops/day — pack in as much as possible" },
];

const PROFILES = [
  { id: "solo",   label: "Solo",   icon: Footprints },
  { id: "couple", label: "Couple", icon: Heart },
  { id: "family", label: "Family", icon: Users },
  { id: "group",  label: "Group",  icon: Users },
];

const TRANSPORTS = [
  {
    id: "walking",
    label: "Walking",
    icon: Footprints,
    desc: "Compact routes, attractions within 2 km",
  },
  {
    id: "public_transport",
    label: "Transit",
    icon: Bus,
    desc: "Bus & metro with short walking segments",
  },
  {
    id: "car",
    label: "Car",
    icon: Car,
    desc: "Wide coverage, parking notes included",
  },
];

const INTERESTS = [
  { id: "history",      emoji: "⚔️" },
  { id: "gastronomy",   emoji: "🍽️" },
  { id: "culture",      emoji: "🎭" },
  { id: "nature",       emoji: "🌿" },
  { id: "architecture", emoji: "🏛️" },
  { id: "nightlife",    emoji: "🌙" },
  { id: "sports",       emoji: "⚽" },
  { id: "relaxation",   emoji: "🧘" },
  { id: "photography",  emoji: "📸" },
];

// ── Transport badge colour ────────────────────────────────────
function transportColor(mode: string) {
  switch (mode) {
    case "walking":          return "text-green-400 bg-green-500/10 border-green-500/20";
    case "car":              return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    case "public_transport": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    default:                 return "text-muted-foreground";
  }
}

function transportIcon(mode: string) {
  switch (mode) {
    case "walking":          return <Footprints className="w-3 h-3" />;
    case "car":              return <Car className="w-3 h-3" />;
    case "public_transport": return <Bus className="w-3 h-3" />;
    default:                 return null;
  }
}

// ── Main component ────────────────────────────────────────────
export function Planner() {
  const {
    step, nextStep, prevStep, request, updateRequest,
    result, setResult, selectedDay, setSelectedDay, reset,
  } = useTripStore();

  const [budgetInput, setBudgetInput] = useState(
    String(request.budgetAmount ?? 200)
  );

  const generateMutation = useGenerateItinerary();

  const handleGenerate = async () => {
    if (!request.city) return;
    try {
      const response = await generateMutation.mutateAsync({
        data: request as ItineraryRequest,
      });
      setResult(response);
    } catch (error) {
      console.error("Failed to generate itinerary:", error);
    }
  };

  const isGenerating = generateMutation.isPending;

  // ── RESULT VIEW ───────────────────────────────────────────
  if (result) {
    const dayData =
      result.days.find((d) => d.dayNumber === selectedDay) ?? result.days[0];
    const budgetDefined = result.budgetAmount > 0;

    return (
      <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-background">
        {/* ── Sidebar ── */}
        <div className="w-full md:w-[460px] lg:w-[520px] flex flex-col h-full border-r border-border bg-card/30 backdrop-blur-md z-10 shadow-2xl">

          {/* Header */}
          <div className="p-5 border-b border-border bg-card/80 shrink-0">
            {/* City / country */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-2xl font-display font-bold leading-tight">
                  {result.city}
                  {result.country && result.country !== result.city && (
                    <span className="text-muted-foreground font-normal text-lg">, {result.country}</span>
                  )}
                </h2>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Calendar className="w-3.5 h-3.5" />
                    {result.days.length} {result.days.length === 1 ? "Day" : "Days"}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${transportColor(result.transportMode)}`}>
                    {transportIcon(result.transportMode)}
                    {result.transportMode === "public_transport" ? "Transit" : result.transportMode === "walking" ? "Walking" : "Car"}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Cost</p>
                <p className="text-xl font-bold text-accent">{formatCurrency(result.totalEstimatedCost)}</p>
                {budgetDefined && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    of {formatCurrency(result.budgetAmount)} budget
                    {result.budgetRemaining > 0 && (
                      <span className="text-green-400 ml-1">({formatCurrency(result.budgetRemaining)} left)</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Budget bar */}
            {budgetDefined && (
              <div className="mb-4">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (result.totalEstimatedCost / result.budgetAmount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Day tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {result.days.map((day) => (
                <button
                  key={day.dayNumber}
                  onClick={() => setSelectedDay(day.dayNumber)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
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

          {/* Day content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDay}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* Day header */}
                <div className="mb-4">
                  <h3 className="font-display text-lg font-bold leading-tight">{dayData.theme}</h3>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {dayData.pois.length} stops
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {Math.round(dayData.totalDuration / 60)}h visit
                      {dayData.travelDuration > 0 && (
                        <> + {dayData.travelDuration}min travel</>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Euro className="w-3 h-3" /> {formatCurrency(dayData.totalCost)}
                    </span>
                  </div>
                  {/* Transport summary */}
                  <p className={`mt-2 text-xs px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${transportColor(result.transportMode)}`}>
                    {transportIcon(result.transportMode)}
                    {dayData.transportSummary}
                  </p>
                </div>

                {/* POI cards */}
                <div className="space-y-3">
                  {dayData.pois.map((poi, idx) => (
                    <div key={poi.id}>
                      <PoiCard poi={poi} index={idx + 1} />
                      {/* Segment connector */}
                      {idx < dayData.pois.length - 1 && dayData.segments[idx] && (
                        <div className="flex items-center gap-2 my-1 px-3">
                          <div className="w-0.5 h-5 ml-6 bg-primary/20 rounded-full" />
                          <span className="text-xs text-muted-foreground/60 truncate">
                            {dayData.segments[idx].instruction}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-6 pb-4">
                  <Button variant="outline" className="w-full" onClick={reset}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Plan Another Trip
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Map ── */}
        <div className="flex-1 h-[50vh] md:h-full relative">
          <ItineraryMap
            key={selectedDay}
            pois={dayData.pois}
            segments={dayData.segments}
            transportMode={result.transportMode}
          />
        </div>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="glass-panel p-12 rounded-3xl max-w-md w-full text-center relative z-10 flex flex-col items-center gap-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full"
          />
          <div>
            <h2 className="text-2xl font-display font-bold mb-2">Crafting Your Journey</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Discovering the best of <strong className="text-foreground">{request.city}</strong> — clustering routes, scoring attractions, and fitting your {formatCurrency(request.budgetAmount ?? 0)} budget…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── WIZARD ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="absolute inset-0 bg-background z-0" />
      <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-primary/10 to-transparent z-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 text-xl font-display font-bold cursor-pointer hover:text-primary transition-colors">
            <MapPin className="w-6 h-6 text-primary" /> TravelMate
          </div>
        </Link>
        {/* Step dots */}
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

      <main className="flex-1 flex items-center justify-center p-4 md:p-6 relative z-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-panel p-8 md:p-12 rounded-3xl"
            >
              {/* ── STEP 1: Destination ── */}
              {step === 1 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">Where to?</h2>
                    <p className="text-muted-foreground">Enter your destination city.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">City *</label>
                      <Input
                        placeholder="e.g., Paris, Rome, Tokyo, Kyoto…"
                        value={request.city || ""}
                        onChange={(e) => updateRequest({ city: e.target.value })}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Country <span className="text-muted-foreground/50">(optional, helps with smaller cities)</span>
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

              {/* ── STEP 2: Duration + Budget ── */}
              {step === 2 && (
                <div className="space-y-10">
                  <div>
                    <h2 className="text-3xl font-display font-bold mb-2">Time & Budget</h2>
                    <p className="text-muted-foreground">How long are you staying and what can you spend?</p>
                  </div>

                  {/* Days slider */}
                  <div>
                    <div className="flex justify-between items-end mb-5">
                      <label className="text-sm font-medium text-muted-foreground">Duration</label>
                      <span className="text-2xl font-bold text-primary">{request.days} {request.days === 1 ? "Day" : "Days"}</span>
                    </div>
                    <Slider
                      min={1}
                      max={14}
                      step={1}
                      value={[request.days || 3]}
                      onValueChange={([val]) => updateRequest({ days: val })}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground/50 mt-2">
                      <span>1 day</span>
                      <span>14 days</span>
                    </div>
                  </div>

                  {/* Budget manual input */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block flex items-center gap-1.5">
                      <Wallet className="w-4 h-4" /> Total Trip Budget (EUR)
                    </label>

                    {/* Preset buttons */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {BUDGET_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => {
                            setBudgetInput(String(preset));
                            updateRequest({ budgetAmount: preset });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                            request.budgetAmount === preset
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-white/8 bg-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/20"
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
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                          request.budgetAmount === 0
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-white/8 bg-white/5 text-muted-foreground hover:bg-white/10"
                        }`}
                      >
                        No limit
                      </button>
                    </div>

                    {/* Free text input */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">€</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Enter amount…"
                        className="pl-8 text-lg font-bold"
                        value={budgetInput}
                        onChange={(e) => {
                          setBudgetInput(e.target.value);
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) updateRequest({ budgetAmount: val });
                        }}
                      />
                    </div>

                    {/* Budget guidance */}
                    {(request.budgetAmount ?? 0) > 0 && (request.days ?? 1) > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        ≈ <strong className="text-foreground">{formatCurrency(Math.round((request.budgetAmount ?? 0) / (request.days ?? 1)))}</strong> per day
                        {(request.budgetAmount ?? 0) < 50 && " — we'll prioritise free attractions"}
                        {(request.budgetAmount ?? 0) >= 50 && (request.budgetAmount ?? 0) < 150 && " — mix of free and affordable paid sights"}
                        {(request.budgetAmount ?? 0) >= 150 && " — full access to premium attractions"}
                      </p>
                    )}
                    {(request.budgetAmount ?? 0) === 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">No budget limit — we'll include all top attractions regardless of cost.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 3: Style ── */}
              {step === 3 && (
                <div className="space-y-10">
                  <div>
                    <h2 className="text-3xl font-display font-bold mb-2">Your Style</h2>
                    <p className="text-muted-foreground">Who's travelling and at what pace?</p>
                  </div>

                  {/* Travel profile */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block">Travelling as</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {PROFILES.map((p) => {
                        const Icon = p.icon;
                        return (
                          <button
                            key={p.id}
                            onClick={() => updateRequest({ travelProfile: p.id as ItineraryRequest["travelProfile"] })}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                              request.travelProfile === p.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-white/5 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Icon className="w-6 h-6" />
                            <span className="text-sm font-medium">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Travel rhythm */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" /> Travel Rhythm
                    </label>
                    <div className="space-y-3">
                      {RHYTHMS.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => updateRequest({ travelRhythm: r.id as ItineraryRequest["travelRhythm"] })}
                          className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left ${
                            request.travelRhythm === r.id
                              ? "border-primary bg-primary/10"
                              : "border-white/5 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div>
                            <div className={`font-bold text-sm ${request.travelRhythm === r.id ? "text-primary" : "text-foreground"}`}>
                              {r.label}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                          </div>
                          {request.travelRhythm === r.id && <Sparkles className="w-5 h-5 text-accent shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Interests + Transport ── */}
              {step === 4 && (
                <div className="space-y-10">
                  <div>
                    <h2 className="text-3xl font-display font-bold mb-2">Final Touches</h2>
                    <p className="text-muted-foreground">How do you get around, and what do you love?</p>
                  </div>

                  {/* Transport mode */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block">Transport Mode</label>
                    <div className="space-y-3">
                      {TRANSPORTS.map((t) => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.id}
                            onClick={() => updateRequest({ transportMode: t.id as ItineraryRequest["transportMode"] })}
                            className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 text-left ${
                              request.transportMode === t.id
                                ? "border-primary bg-primary/10"
                                : "border-white/5 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <Icon className={`w-6 h-6 shrink-0 ${request.transportMode === t.id ? "text-primary" : "text-muted-foreground"}`} />
                            <div>
                              <div className={`font-bold text-sm ${request.transportMode === t.id ? "text-primary" : "text-foreground"}`}>
                                {t.label}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                            </div>
                            {request.transportMode === t.id && <Sparkles className="w-5 h-5 text-accent shrink-0 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interests */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block">
                      Interests <span className="text-muted-foreground/50 font-normal">(select any)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INTERESTS.map(({ id, emoji }) => {
                        const isSelected = request.interests?.includes(id as any);
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              const current = request.interests || [];
                              const next = isSelected
                                ? current.filter((i) => i !== id)
                                : [...current, id as any];
                              updateRequest({ interests: next });
                            }}
                            className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all capitalize flex items-center gap-1.5 ${
                              isSelected
                                ? "border-accent bg-accent/20 text-accent shadow-[0_0_10px_rgba(219,39,119,0.2)]"
                                : "border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                            }`}
                          >
                            <span>{emoji}</span> {id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-10 flex items-center justify-between pt-6 border-t border-white/10">
                {step > 1 ? (
                  <Button variant="ghost" onClick={prevStep}>
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
                    className="bg-gradient-to-r from-primary to-accent border-none"
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
