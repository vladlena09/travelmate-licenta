import { Map, History, UserCircle2, Sparkles, Clock3, BadgeCheck } from "lucide-react";

type WelcomeHubProps = {
  userEmail?: string;
  displayName?: string;
  profileCompleted?: boolean;
  recentTrip?: {
    city?: string;
    country?: string | null;
    createdAt?: string;
  } | null;
  onStartPlanning: () => void;
  onOpenTrips: () => void;
  onOpenProfile: () => void;
  onContinueLastTrip?: () => void;
};

type HubCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
};

function HubCard({ title, description, icon, onClick }: HubCardProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 hover:bg-white/8 hover:border-primary/30 transition-all duration-300 shadow-xl"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary mb-5 group-hover:scale-105 transition-transform">
        {icon}
      </div>

      <h3 className="text-2xl font-display font-bold mb-2">{title}</h3>

      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        Open
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </button>
  );
}

export default function WelcomeHub({
  userEmail,
  displayName,
  profileCompleted = false,
  recentTrip = null,
  onStartPlanning,
  onOpenTrips,
  onOpenProfile,
  onContinueLastTrip,
}: WelcomeHubProps) {
  const resolvedName = displayName?.trim() || userEmail?.split("@")[0] || "Traveler";

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.18),_transparent_38%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),_transparent_28%)] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pt-14 pb-10">
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-5">
            <Sparkles className="w-4 h-4" />
            TravelMate
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight mb-4">
            Welcome back, <span className="text-primary">{resolvedName}</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Choose how you want to continue. Start a new personalized itinerary,
            reopen one of your saved journeys, or fine-tune your travel profile.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <HubCard
            title="Start Planning"
            description="Create a new itinerary based on destination, budget, travel style, and transport preferences."
            icon={<Map className="w-7 h-7" />}
            onClick={onStartPlanning}
          />

          <HubCard
            title="My Trips"
            description="Open your saved itineraries, continue exploring, or remove trips you no longer need."
            icon={<History className="w-7 h-7" />}
            onClick={onOpenTrips}
          />

          <HubCard
            title="Profile"
            description="Personalize your travel identity with interests, rhythm, transport mode, and preferences."
            icon={<UserCircle2 className="w-7 h-7" />}
            onClick={onOpenProfile}
          />
        </div>

        <div className="grid gap-5 mt-8 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-card/30 backdrop-blur-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                <Clock3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Continue your latest trip</h2>
                <p className="text-sm text-muted-foreground">
                  Jump back into your most recent saved itinerary.
                </p>
              </div>
            </div>

            {recentTrip ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
                  <p className="text-xl font-display font-bold">
                    {recentTrip.city}
                    {recentTrip.country ? (
                      <span className="text-muted-foreground font-normal text-base">
                        , {recentTrip.country}
                      </span>
                    ) : null}
                  </p>

                  {recentTrip.createdAt ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Saved on {new Date(recentTrip.createdAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={onContinueLastTrip || onOpenTrips}
                  className="px-5 py-3 rounded-2xl bg-primary text-white font-semibold hover:opacity-90 transition"
                >
                  Continue latest trip
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                No saved trips yet. Create your first itinerary to see it here.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-card/30 backdrop-blur-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Profile status</h2>
                <p className="text-sm text-muted-foreground">
                  A complete profile helps generate more relevant itineraries.
                </p>
              </div>
            </div>

            {profileCompleted ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="font-semibold text-emerald-300">Your profile is ready.</p>
                <p className="text-sm text-emerald-200/80 mt-1">
                  Your preferences can now be reused in the planner.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 mb-4">
                  <p className="font-semibold text-amber-300">Complete your profile</p>
                  <p className="text-sm text-amber-200/80 mt-1">
                    Add your name, travel style, interests, and preferred transport for a more personalized experience.
                  </p>
                </div>

                <button
                  onClick={onOpenProfile}
                  className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 font-semibold hover:bg-white/10 transition"
                >
                  Open profile
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}