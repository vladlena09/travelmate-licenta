import { Router, type IRouter } from "express";
import {
  GeocodeCityQueryParams,
  GetPoisQueryParams,
  GenerateItineraryBody,
} from "@workspace/api-zod";
import { geocodeCity, getMockGeocode } from "../lib/geocode.js";
import { fetchPoisFromOverpass, getMockPois } from "../lib/pois.js";
import { generateItinerary } from "../lib/itinerary.js";

const router: IRouter = Router();

router.get("/geocode", async (req, res) => {
  const parsed = GeocodeCityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const { city, country } = parsed.data;
  let location = await geocodeCity(city, country ?? undefined);
  if (!location) location = getMockGeocode(city);
  res.json(location);
});

router.get("/pois", async (req, res) => {
  const parsed = GetPoisQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const { lat, lon, radius } = parsed.data;
  let pois = await fetchPoisFromOverpass(lat, lon, radius ?? 5000);
  if (pois.length < 5) {
    pois = getMockPois(`${lat},${lon}`, lat, lon);
  }
  res.json({ pois });
});

router.post("/itinerary/generate", async (req, res) => {
  const parsed = GenerateItineraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const reqData = parsed.data;

  // Expand radius for car users so they get further-away attractions
  const overpassRadius =
    reqData.transportMode === "car"
      ? 20000
      : reqData.transportMode === "public_transport"
      ? 9000
      : 6000;

  let location = await geocodeCity(reqData.city, reqData.country ?? undefined);
  if (!location) location = getMockGeocode(reqData.city);

  let overpassPois = await fetchPoisFromOverpass(location.lat, location.lon, overpassRadius);

  // Always seed with mock data for major cities so famous landmarks are guaranteed
  const mockPois = getMockPois(reqData.city, location.lat, location.lon);
  const hasMockData = mockPois.length > 0 && mockPois[0].id !== `${reqData.city.toLowerCase()}-1`;

  if (overpassPois.length < 5) {
    console.log(`Overpass returned ${overpassPois.length} POIs for ${reqData.city}, using mock data only`);
    overpassPois = mockPois;
  } else if (hasMockData || mockPois.length >= 7) {
    // Merge: mock data provides the guaranteed must-see landmarks; Overpass supplements
    const overpassNames = new Set(overpassPois.map((p) => p.name.toLowerCase().trim()));
    const uniqueMock = mockPois.filter((m) => !overpassNames.has(m.name.toLowerCase().trim()));
    overpassPois = [...mockPois, ...overpassPois.filter((p) => {
      const n = p.name.toLowerCase().trim();
      return !mockPois.some((m) => m.name.toLowerCase().trim() === n);
    })];
    console.log(`Merged ${uniqueMock.length} mock + ${overpassPois.length} total POIs for ${reqData.city}`);
  }

  const pois = overpassPois;

  const itineraryReq = {
    city: reqData.city,
    country: reqData.country ?? undefined,
    days: reqData.days,
    budgetAmount: reqData.budgetAmount,
    travelRhythm: reqData.travelRhythm as "relaxed" | "balanced" | "dynamic",
    travelProfile: reqData.travelProfile as "solo" | "couple" | "family" | "group",
    transportMode: reqData.transportMode as "walking" | "car" | "public_transport",
    interests: reqData.interests,
  };

  const days = generateItinerary(pois, itineraryReq);

  const totalEstimatedCost = days.reduce((sum, d) => sum + d.totalCost, 0);
  const budgetRemaining =
    reqData.budgetAmount > 0
      ? Math.max(0, reqData.budgetAmount - totalEstimatedCost)
      : 0;

  res.json({
    city: location.city,
    country: location.country ?? "",
    lat: location.lat,
    lon: location.lon,
    transportMode: reqData.transportMode,
    days,
    totalEstimatedCost,
    budgetAmount: reqData.budgetAmount,
    budgetRemaining,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
