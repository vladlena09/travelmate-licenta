import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useGenerateItinerary } from "@workspace/api-client-react";
import type { ItineraryRequest } from "@workspace/api-client-react";
import { useTripStore } from "@/store/use-trip-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ItineraryMap } from "@/components/Map";
import { PoiCard } from "@/components/PoiCard";
import { 
  Plane, Calendar, Wallet, Footprints, Users, Car, Heart, 
  MapPin, ChevronRight, ArrowLeft, Loader2, Sparkles 
} from "lucide-react";

const BUDGETS = [
  { id: 'low', label: 'Budget', icon: '€' },
  { id: 'medium', label: 'Comfort', icon: '€€' },
  { id: 'high', label: 'Luxury', icon: '€€€' }
];

const RHYTHMS = [
  { id: 'relaxed', label: 'Relaxed', desc: 'Take it easy, fewer stops' },
  { id: 'balanced', label: 'Balanced', desc: 'A nice mix of sights and rest' },
  { id: 'dynamic', label: 'Dynamic', desc: 'See as much as possible' }
];

const PROFILES = [
  { id: 'solo', label: 'Solo', icon: Footprints },
  { id: 'couple', label: 'Couple', icon: Heart },
  { id: 'family', label: 'Family', icon: Users },
  { id: 'group', label: 'Group', icon: Users }
];

const TRANSPORTS = [
  { id: 'walking', label: 'Walking', icon: Footprints },
  { id: 'public_transport', label: 'Transit', icon: Plane },
  { id: 'car', label: 'Car', icon: Car }
];

const INTERESTS = [
  'history', 'gastronomy', 'culture', 'nature', 
  'architecture', 'nightlife', 'sports', 'relaxation', 'photography'
];

export function Planner() {
  const { 
    step, nextStep, prevStep, request, updateRequest, 
    result, setResult, selectedDay, setSelectedDay, reset 
  } = useTripStore();
  
  const generateMutation = useGenerateItinerary();

  const handleGenerate = async () => {
    if (!request.city) return;
    
    try {
      const response = await generateMutation.mutateAsync({
        data: request as ItineraryRequest
      });
      setResult(response);
    } catch (error) {
      console.error("Failed to generate", error);
      // Fallback/Mock behavior if backend isn't ready
      alert("Backend API not found or failed. Check console.");
    }
  };

  const isGenerating = generateMutation.isPending;

  // --- RENDERING HELPERS ---

  if (result) {
    const dayData = result.days.find(d => d.dayNumber === selectedDay) || result.days[0];
    
    return (
      <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-background">
        {/* Left Sidebar */}
        <div className="w-full md:w-[450px] lg:w-[500px] flex flex-col h-full border-r border-border bg-card/30 backdrop-blur-md z-10 shadow-2xl">
          <div className="p-6 border-b border-border bg-card/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-display font-bold">{result.city}</h2>
                <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                  <Calendar className="w-4 h-4" /> {result.days.length} Days Trip
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. Cost</p>
                <p className="text-xl font-bold text-accent">{formatCurrency(result.totalEstimatedCost)}</p>
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {result.days.map((day) => (
                <button
                  key={day.dayNumber}
                  onClick={() => setSelectedDay(day.dayNumber)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedDay === day.dayNumber 
                      ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  Day {day.dayNumber}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <div className="mb-4">
              <h3 className="font-display text-xl font-bold">{dayData.theme}</h3>
              <p className="text-sm text-muted-foreground">
                {dayData.pois.length} stops • {Math.round(dayData.totalDuration/60)} hours total
              </p>
            </div>
            
            {dayData.pois.map((poi, idx) => (
              <PoiCard key={poi.id} poi={poi} index={idx + 1} />
            ))}
            
            <div className="pt-8 pb-4">
              <Button variant="outline" className="w-full" onClick={reset}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Plan Another Trip
              </Button>
            </div>
          </div>
        </div>

        {/* Right Map Area */}
        <div className="flex-1 h-[50vh] md:h-full relative bg-muted">
          <ItineraryMap pois={dayData.pois} routePolyline={dayData.routePolyline} />
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="glass-panel p-12 rounded-3xl max-w-md w-full text-center relative z-10 flex flex-col items-center">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 mb-8 border-4 border-primary/20 border-t-primary rounded-full"
          />
          <h2 className="text-3xl font-display font-bold mb-4">Crafting Your Journey</h2>
          <p className="text-muted-foreground">
            Our AI is analyzing routes, opening hours, and local secrets for {request.city}...
          </p>
        </div>
      </div>
    );
  }

  // --- WIZARD STEPS ---
  
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
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-500 ${
                i === step ? 'w-8 bg-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]' : 
                i < step ? 'w-4 bg-primary/50' : 'w-4 bg-white/10'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Wizard Content */}
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
              {step === 1 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Where to?</h2>
                    <p className="text-muted-foreground">Enter your dream destination.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">City</label>
                      <Input 
                        placeholder="e.g., Paris, Tokyo, Kyoto..." 
                        value={request.city || ''}
                        onChange={(e) => updateRequest({ city: e.target.value })}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">Country (Optional)</label>
                      <Input 
                        placeholder="e.g., France, Japan..." 
                        value={request.country || ''}
                        onChange={(e) => updateRequest({ country: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-10">
                  <div>
                    <h2 className="text-3xl font-display font-bold mb-3">Time & Money</h2>
                    <p className="text-muted-foreground">How long are you staying and what's your budget?</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-end mb-6">
                      <label className="text-sm font-medium text-muted-foreground">Duration</label>
                      <span className="text-2xl font-bold text-primary">{request.days} Days</span>
                    </div>
                    <Slider 
                      min={1} 
                      max={14} 
                      step={1} 
                      value={[request.days || 3]} 
                      onValueChange={([val]) => updateRequest({ days: val })} 
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block">Budget Level</label>
                    <div className="grid grid-cols-3 gap-4">
                      {BUDGETS.map(b => (
                        <button
                          key={b.id}
                          onClick={() => updateRequest({ budgetLevel: b.id as any })}
                          className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                            request.budgetLevel === b.id 
                              ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(124,58,237,0.2)]' 
                              : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <span className="text-xl font-bold text-accent">{b.icon}</span>
                          <span className="text-sm font-medium">{b.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-10">
                  <div>
                    <h2 className="text-3xl font-display font-bold mb-3">Your Style</h2>
                    <p className="text-muted-foreground">Who are you traveling with and at what pace?</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block">Travel Profile</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {PROFILES.map(p => {
                        const Icon = p.icon;
                        return (
                          <button
                            key={p.id}
                            onClick={() => updateRequest({ travelProfile: p.id as any })}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                              request.travelProfile === p.id 
                                ? 'border-primary bg-primary/10 text-primary' 
                                : 'border-white/5 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Icon className="w-6 h-6" />
                            <span className="text-sm font-medium">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block">Travel Rhythm</label>
                    <div className="space-y-3">
                      {RHYTHMS.map(r => (
                        <button
                          key={r.id}
                          onClick={() => updateRequest({ travelRhythm: r.id as any })}
                          className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between text-left ${
                            request.travelRhythm === r.id 
                              ? 'border-primary bg-primary/10' 
                              : 'border-white/5 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div>
                            <div className={`font-bold ${request.travelRhythm === r.id ? 'text-primary' : 'text-foreground'}`}>
                              {r.label}
                            </div>
                            <div className="text-sm text-muted-foreground">{r.desc}</div>
                          </div>
                          {request.travelRhythm === r.id && <Sparkles className="w-5 h-5 text-accent" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-10">
                  <div>
                    <h2 className="text-3xl font-display font-bold mb-3">Final Touches</h2>
                    <p className="text-muted-foreground">Pick your interests and getting around.</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block">Transport Mode</label>
                    <div className="grid grid-cols-3 gap-3">
                      {TRANSPORTS.map(t => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.id}
                            onClick={() => updateRequest({ transportMode: t.id as any })}
                            className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                              request.transportMode === t.id 
                                ? 'border-primary bg-primary/10 text-primary' 
                                : 'border-white/5 bg-white/5 hover:bg-white/10 text-muted-foreground'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-bold">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-4 block">Interests (Select multiple)</label>
                    <div className="flex flex-wrap gap-2">
                      {INTERESTS.map(interest => {
                        const isSelected = request.interests?.includes(interest as any);
                        return (
                          <button
                            key={interest}
                            onClick={() => {
                              const current = request.interests || [];
                              const next = isSelected 
                                ? current.filter(i => i !== interest)
                                : [...current, interest as any];
                              updateRequest({ interests: next });
                            }}
                            className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all capitalize ${
                              isSelected
                                ? 'border-accent bg-accent/20 text-accent shadow-[0_0_10px_rgba(219,39,119,0.3)]'
                                : 'border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:border-white/20'
                            }`}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="mt-10 flex items-center justify-between pt-6 border-t border-white/10">
                {step > 1 ? (
                  <Button variant="ghost" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                ) : <div />}
                
                {step < 4 ? (
                  <Button onClick={nextStep} disabled={step === 1 && !request.city}>
                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button size="lg" onClick={handleGenerate} className="bg-gradient-to-r from-primary to-accent border-none">
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
