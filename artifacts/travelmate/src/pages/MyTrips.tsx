import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useTripStore } from "@/store/use-trip-store";
import type { ItineraryResponse } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type MyTripsProps = {
  onBackToPlanner: () => void;
};

type SavedItineraryRow = {
  id: string;
  user_id: string;
  city: string;
  country: string | null;
  days: number;
  budget: number | null;
  itinerary_json: ItineraryResponse;
  created_at: string;
};

export default function MyTrips({ onBackToPlanner }: MyTripsProps) {
  const { toast } = useToast();

  const [items, setItems] = useState<SavedItineraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const { setResult, setSelectedDay } = useTripStore();

  useEffect(() => {
    const loadTrips = async () => {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("itineraries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setMessage("Failed to load saved itineraries.");
      } else {
        setItems((data as SavedItineraryRow[]) || []);
      }

      setLoading(false);
    };

    loadTrips();
  }, []);

  const handleOpenTrip = (trip: SavedItineraryRow) => {
    if (!trip.itinerary_json) {
      alert("Saved itinerary data is missing.");
      return;
    }

    setResult(trip.itinerary_json);
    setSelectedDay(trip.itinerary_json.days?.[0]?.dayNumber ?? 1);
    onBackToPlanner();
  };

  const handleDeleteTrip = async (id: string) => {
    const confirmed = window.confirm("Delete this saved itinerary?");
    if (!confirmed) return;

    const { error } = await supabase.from("itineraries").delete().eq("id", id);

    if (error) {
      console.error(error);
      toast({
        title: "Delete failed",
        description: "There was an error deleting this itinerary.",
        variant: "destructive",
      });
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== id));

    toast({
      title: "Trip deleted",
      description: "The itinerary was removed successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-background px-4 md:px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold">My Trips</h1>
            <p className="text-muted-foreground mt-1">
              Your saved itineraries, ready to reopen anytime.
            </p>
          </div>

          <button
            onClick={onBackToPlanner}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
          >
            Back to Planner
          </button>
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-card/30 p-6 text-muted-foreground">
            Loading saved itineraries...
          </div>
        )}

        {!loading && message && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
            {message}
          </div>
        )}

        {!loading && !message && items.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-card/30 p-6 text-muted-foreground">
            No saved itineraries yet.
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((trip) => (
              <div
                key={trip.id}
                className="rounded-3xl border border-white/10 bg-card/30 backdrop-blur-xl p-5 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-2xl font-display font-bold leading-tight">
                      {trip.city}
                      {trip.country ? (
                        <span className="text-muted-foreground font-normal text-base">
                          , {trip.country}
                        </span>
                      ) : null}
                    </h2>

                    <p className="text-sm text-muted-foreground mt-1">
                      Saved on {new Date(trip.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Budget
                    </p>
                    <p className="text-lg font-bold">€{trip.budget ?? 0}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-muted-foreground">
                    {trip.days} {trip.days === 1 ? "day" : "days"}
                  </span>

                  <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-muted-foreground">
                    {trip.itinerary_json?.transportMode ?? "Unknown transport"}
                  </span>

                  <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-muted-foreground">
                    €{trip.itinerary_json?.totalEstimatedCost ?? 0} estimated
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleOpenTrip(trip)}
                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition"
                  >
                    Open itinerary
                  </button>

                  <button
                    onClick={() => handleDeleteTrip(trip.id)}
                    className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}