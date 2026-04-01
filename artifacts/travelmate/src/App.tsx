import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Planner from "./pages/Planner";
import MyTrips from "./pages/MyTrips";
import Profile from "./pages/Profile";
import WelcomeHub from "./pages/WelcomeHub";

type LoggedOutView = "intro" | "auth" | "login" | "register";
type LoggedInView = "hub" | "planner" | "history" | "profile";

type RecentTrip = {
  id: string;
  city: string;
  country: string | null;
  created_at: string;
  itinerary_json?: any;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [loggedOutView, setLoggedOutView] = useState<LoggedOutView>("intro");
  const [loggedInView, setLoggedInView] = useState<LoggedInView>("hub");

  const [profileName, setProfileName] = useState("");
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [recentTrip, setRecentTrip] = useState<RecentTrip | null>(null);

  const loadProfileData = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, travel_profile, travel_rhythm, transport_mode, interests, start_time")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      setProfileName(data.full_name ?? "");

      const isComplete = Boolean(
        data.full_name ||
          data.travel_profile ||
          data.travel_rhythm ||
          data.transport_mode ||
          (Array.isArray(data.interests) && data.interests.length > 0) ||
          data.start_time
      );

      setProfileCompleted(isComplete);
    } else {
      setProfileName("");
      setProfileCompleted(false);
    }
  };

  const loadRecentTrip = async (userId: string) => {
    const { data, error } = await supabase
      .from("itineraries")
      .select("id, city, country, created_at, itinerary_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      setRecentTrip(data[0] as RecentTrip);
    } else {
      setRecentTrip(null);
    }
  };

  const loadUserData = async (userId: string) => {
    await Promise.all([loadProfileData(userId), loadRecentTrip(userId)]);
  };

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();

      setSession(data.session);

      if (data.session?.user?.id) {
        await loadUserData(data.session.user.id);
        setLoggedInView("hub");
      }

      setLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user?.id) {
        setLoggedInView("hub");
        loadUserData(nextSession.user.id);
      } else {
        setLoggedOutView("intro");
        setLoggedInView("hub");
        setProfileName("");
        setProfileCompleted(false);
        setRecentTrip(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedOutView("intro");
    setLoggedInView("hub");
    setProfileName("");
    setProfileCompleted(false);
    setRecentTrip(null);
  };

  const handleBackFromProfile = async () => {
    if (session?.user?.id) {
      await loadUserData(session.user.id);
    }
    setLoggedInView("hub");
  };

  const resolvedName =
    profileName?.trim() || session?.user?.email?.split("@")[0] || "Traveler";

  const avatarLetter = resolvedName.charAt(0).toUpperCase();

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!session) {
    if (loggedOutView === "intro") {
      return <Landing onGetStarted={() => setLoggedOutView("auth")} />;
    }

    if (loggedOutView === "auth") {
      return (
        <Auth
          onLogin={() => setLoggedOutView("login")}
          onRegister={() => setLoggedOutView("register")}
          onBack={() => setLoggedOutView("intro")}
        />
      );
    }

    if (loggedOutView === "login") {
      return <Login onSwitchToRegister={() => setLoggedOutView("register")} />;
    }

    return <Register onSwitchToLogin={() => setLoggedOutView("login")} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-5 py-4 bg-slate-950/95 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center font-bold text-lg shrink-0">
            {avatarLetter}
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Logged in
            </p>
            <p className="text-white font-semibold truncate">{resolvedName}</p>
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => setLoggedInView("hub")}
            className={`px-4 py-2.5 rounded-2xl font-semibold transition ${
              loggedInView === "hub"
                ? "bg-primary text-white"
                : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
            }`}
          >
            Home
          </button>

          <button
            onClick={() => setLoggedInView("planner")}
            className={`px-4 py-2.5 rounded-2xl font-semibold transition ${
              loggedInView === "planner"
                ? "bg-primary text-white"
                : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
            }`}
          >
            Planner
          </button>

          <button
            onClick={() => setLoggedInView("history")}
            className={`px-4 py-2.5 rounded-2xl font-semibold transition ${
              loggedInView === "history"
                ? "bg-primary text-white"
                : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
            }`}
          >
            My Trips
          </button>

          <button
            onClick={() => setLoggedInView("profile")}
            className={`px-4 py-2.5 rounded-2xl font-semibold transition ${
              loggedInView === "profile"
                ? "bg-primary text-white"
                : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
            }`}
          >
            Profile
          </button>

          <button
            onClick={handleLogout}
            className="px-4 py-2.5 rounded-2xl font-semibold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {loggedInView === "hub" && (
        <WelcomeHub
          userEmail={session.user.email}
          displayName={profileName}
          profileCompleted={profileCompleted}
          recentTrip={
            recentTrip
              ? {
                  city: recentTrip.city,
                  country: recentTrip.country,
                  createdAt: recentTrip.created_at,
                }
              : null
          }
          onStartPlanning={() => setLoggedInView("planner")}
          onOpenTrips={() => setLoggedInView("history")}
          onOpenProfile={() => setLoggedInView("profile")}
          onContinueLastTrip={() => setLoggedInView("history")}
        />
      )}

      {loggedInView === "planner" && <Planner />}

      {loggedInView === "history" && (
        <MyTrips onBackToPlanner={() => setLoggedInView("planner")} />
      )}

      {loggedInView === "profile" && (
        <Profile onBackToPlanner={handleBackFromProfile} />
      )}
    </div>
  );
}