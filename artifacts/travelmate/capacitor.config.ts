import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.travelmate.app",
  appName: "TravelMate",
  webDir: "dist/public",
  server: {
    androidScheme: "http",
  },
};

export default config;