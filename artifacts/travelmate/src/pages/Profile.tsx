import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useTripStore } from "@/store/use-trip-store";
import { useToast } from "@/hooks/use-toast";

type ProfileProps = {
  onBackToPlanner: () => void;
};

const PROFILE_OPTIONS = ["solo", "couple", "family", "group"];
const RHYTHM_OPTIONS = ["relaxed", "balanced", "dynamic"];
const TRANSPORT_OPTIONS = ["walking", "public_transport", "car"];
const START_TIME_OPTIONS = ["early", "normal", "late"];
const INTEREST_OPTIONS = [
  "history",
  "gastronomy",
  "culture",
  "nature",
  "architecture",
  "nightlife",
  "sports",
  "relaxation",
  "photography",
];

export default function Profile({ onBackToPlanner }: ProfileProps) {
    const { toast } = useToast();
  const { updateRequest } = useTripStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [travelProfile, setTravelProfile] = useState("couple");
  const [travelRhythm, setTravelRhythm] = useState("balanced");
  const [transportMode, setTransportMode] = useState("walking");
  const [startTime, setStartTime] = useState("normal");
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
  const loadProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!error && data) {
      setFullName(data.full_name ?? "");
      setTravelProfile(data.travel_profile ?? "couple");
      setTravelRhythm(data.travel_rhythm ?? "balanced");
      setTransportMode(data.transport_mode ?? "walking");
      setStartTime(data.start_time ?? "normal");
      setInterests(Array.isArray(data.interests) ? data.interests : []);
    }

    setLoading(false);
  };

  loadProfile();
 }, []);

  const toggleInterest = (value: string) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSaveProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      toast({
       title: "Not logged in",
       description: "Please log in to update your profile.",
      });
      return;
    }

    setSaving(true);

    const payload = {
      id: session.user.id,
      full_name: fullName,
      travel_profile: travelProfile,
      travel_rhythm: travelRhythm,
      transport_mode: transportMode,
      start_time: startTime,
      interests: interests,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) {
      console.error(error);
      toast({
       title: "Save failed",
       description: "There was an error saving your profile.",
       variant: "destructive",
      });
      setSaving(false);
      return;
    }

    updateRequest({
      travelProfile: travelProfile as any,
      travelRhythm: travelRhythm as any,
      transportMode: transportMode as any,
      startTime: startTime as any,
      interests: interests as any,
    });

    toast({
     title: "Profile saved",
     description: "Your profile was updated successfully.",
    });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-card/30 p-6 text-muted-foreground">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold">Profile</h1>
            <p className="text-muted-foreground mt-1">
              Personalize your experience and reuse these preferences in trip planning.
            </p>
          </div>

          <button
            onClick={onBackToPlanner}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
          >
            Back to Planner
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/30 backdrop-blur-xl p-6 space-y-6">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">Travel profile</label>
            <div className="flex flex-wrap gap-2">
              {PROFILE_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => setTravelProfile(item)}
                  className={`px-4 py-2 rounded-full border ${
                    travelProfile === item
                      ? "bg-primary text-white border-primary"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">Travel rhythm</label>
            <div className="flex flex-wrap gap-2">
              {RHYTHM_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => setTravelRhythm(item)}
                  className={`px-4 py-2 rounded-full border ${
                    travelRhythm === item
                      ? "bg-primary text-white border-primary"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">Transport mode</label>
            <div className="flex flex-wrap gap-2">
              {TRANSPORT_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => setTransportMode(item)}
                  className={`px-4 py-2 rounded-full border ${
                    transportMode === item
                      ? "bg-primary text-white border-primary"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">Preferred start time</label>
            <div className="flex flex-wrap gap-2">
              {START_TIME_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => setStartTime(item)}
                  className={`px-4 py-2 rounded-full border ${
                    startTime === item
                      ? "bg-primary text-white border-primary"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">Interests</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => toggleInterest(item)}
                  className={`px-4 py-2 rounded-full border ${
                    interests.includes(item)
                      ? "bg-primary text-white border-primary"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-5 py-3 rounded-2xl bg-primary text-white font-semibold hover:opacity-90 transition"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}