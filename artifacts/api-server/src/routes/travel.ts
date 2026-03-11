import { Router, type IRouter } from "express";
import {
  GeocodeCityQueryParams,
  GetPoisQueryParams,
  GenerateItineraryBody,
} from "@workspace/api-zod";
import { geocodeCity, getMockGeocode } from "../lib/geocode.js";
import {
  fetchPoisFromOverpass,
  getMockPois,
} from "../lib/pois.js";
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

  if (!location) {
    location = getMockGeocode(city);
  }

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
    console.log("Overpass returned few results, using mock data");
    const cityKey = `${lat},${lon}`;
    pois = getMockPois(cityKey, lat, lon);
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

  let location = await geocodeCity(reqData.city, reqData.country ?? undefined);
  if (!location) {
    location = getMockGeocode(reqData.city);
  }

  let pois = await fetchPoisFromOverpass(location.lat, location.lon, 6000);

  if (pois.length < 5) {
    console.log(`Overpass returned ${pois.length} POIs for ${reqData.city}, using mock data`);
    pois = getMockPois(reqData.city, location.lat, location.lon);
  }

  const itineraryReq = {
    city: reqData.city,
    country: reqData.country ?? undefined,
    days: reqData.days,
    budgetLevel: reqData.budgetLevel as "low" | "medium" | "high",
    travelRhythm: reqData.travelRhythm as "relaxed" | "balanced" | "dynamic",
    travelProfile: reqData.travelProfile as "solo" | "couple" | "family" | "group",
    transportMode: reqData.transportMode as "walking" | "car" | "public_transport",
    interests: reqData.interests,
  };

  const days = generateItinerary(pois, itineraryReq);

  const totalEstimatedCost = days.reduce((sum, d) => sum + d.totalCost, 0);

  const response = {
    city: location.city,
    country: location.country,
    lat: location.lat,
    lon: location.lon,
    days,
    totalEstimatedCost,
    generatedAt: new Date().toISOString(),
  };

  res.json(response);
});

export default router;
