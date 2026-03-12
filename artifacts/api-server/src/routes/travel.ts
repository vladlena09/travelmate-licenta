import { Router, type IRouter } from "express";
import {
  GeocodeCityQueryParams,
  GetPoisQueryParams,
  GenerateItineraryBody,
} from "@workspace/api-zod";
import { geocodeCity, getMockGeocode } from "../lib/geocode.js";
import { fetchPoisFromOverpass, getMockPois } from "../lib/pois.js";
import { generateItinerary, regenerateSingleDay } from "../lib/itinerary.js";

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
  if (pois.length < 5) pois = getMockPois(`${lat},${lon}`, lat, lon);
  res.json({ pois });
});

router.post("/itinerary/generate", async (req, res) => {
  const parsed = GenerateItineraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const reqData = parsed.data;

  // Overpass radius scales with transport mode
  const overpassRadius =
    reqData.transportMode === "car" ? 22000 :
    reqData.transportMode === "public_transport" ? 9000 : 6000;

  let location = await geocodeCity(reqData.city, reqData.country ?? undefined);
  if (!location) location = getMockGeocode(reqData.city);

  let overpassPois = await fetchPoisFromOverpass(location.lat, location.lon, overpassRadius);

  // Always merge with curated mock data so famous landmarks are guaranteed
  const mockPois = getMockPois(reqData.city, location.lat, location.lon);
  if (overpassPois.length < 5) {
    console.log(`Overpass returned ${overpassPois.length} POIs for ${reqData.city}, using mock data`);
    overpassPois = mockPois;
  } else if (mockPois.length >= 7) {
    // Mock data guarantees iconic landmarks; Overpass supplements with real local POIs
    const mockNames = new Set(mockPois.map((m) => m.name.toLowerCase().trim()));
    const uniqueOverpass = overpassPois.filter(
      (p) => !mockNames.has(p.name.toLowerCase().trim())
    );
    overpassPois = [...mockPois, ...uniqueOverpass];
    console.log(`Merged: ${mockPois.length} curated + ${uniqueOverpass.length} Overpass = ${overpassPois.length} total for ${reqData.city}`);
  }

  const itineraryReq = {
    city: reqData.city,
    country: reqData.country ?? undefined,
    days: reqData.days,
    budgetAmount: reqData.budgetAmount,
    travelRhythm: reqData.travelRhythm as "relaxed" | "balanced" | "dynamic",
    travelProfile: reqData.travelProfile as "solo" | "couple" | "family" | "group",
    transportMode: reqData.transportMode as "walking" | "car" | "public_transport",
    interests: reqData.interests,
    priorityMode: reqData.priorityMode as "iconic" | "mixed",
    startTime: (reqData.startTime ?? "normal") as "early" | "normal" | "late",
  };

  // Handle single-day regeneration
  if (reqData.regenerateDayNumber && req.body.existingDays) {
    const days = regenerateSingleDay(
      overpassPois,
      itineraryReq,
      req.body.existingDays,
      reqData.regenerateDayNumber
    );
    const totalEstimatedCost = days.reduce((s, d) => s + d.totalCost, 0);
    res.json({
      city: location.city,
      country: location.country ?? "",
      lat: location.lat,
      lon: location.lon,
      transportMode: reqData.transportMode,
      priorityMode: reqData.priorityMode,
      startTime: reqData.startTime ?? "normal",
      days,
      totalEstimatedCost,
      budgetAmount: reqData.budgetAmount,
      budgetRemaining: reqData.budgetAmount > 0
        ? Math.max(0, reqData.budgetAmount - totalEstimatedCost) : 0,
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  const days = generateItinerary(overpassPois, itineraryReq);
  const totalEstimatedCost = days.reduce((s, d) => s + d.totalCost, 0);

  res.json({
    city: location.city,
    country: location.country ?? "",
    lat: location.lat,
    lon: location.lon,
    transportMode: reqData.transportMode,
    priorityMode: reqData.priorityMode,
    startTime: reqData.startTime ?? "normal",
    days,
    totalEstimatedCost,
    budgetAmount: reqData.budgetAmount,
    budgetRemaining: reqData.budgetAmount > 0
      ? Math.max(0, reqData.budgetAmount - totalEstimatedCost) : 0,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
