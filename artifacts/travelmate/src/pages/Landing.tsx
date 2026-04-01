import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Compass, Sparkles, Map } from "lucide-react";

type LandingProps = {
  onGetStarted: () => void;
};

export default function Landing({ onGetStarted }: LandingProps) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Cinematic premium travel landscape" 
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      </div>

      <div className="container relative z-10 px-4 mx-auto text-center max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-6">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium tracking-wide">AI-Powered Premium Travel</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-bold font-display leading-[1.1] mb-6 drop-shadow-2xl">
            Design your <span className="text-gradient">perfect escape.</span>
          </h1>
          <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            TravelMate crafts bespoke, day-by-day itineraries tailored to your unique rhythm, budget, and passions.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12"
        >
          <Link href="/planner">
            <Button
             onClick={onGetStarted}
             size="lg"
             className="w-full sm:w-auto h-16 px-10 text-lg rounded-full"
            >
             <Compass className="w-5 h-5 mr-2" />
              Start Planning
            </Button>
          </Link>
          <Button size="lg" variant="glass" className="w-full sm:w-auto h-16 px-10 text-lg rounded-full">
            <Map className="w-5 h-5 mr-2" />
            Explore Destinations
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
