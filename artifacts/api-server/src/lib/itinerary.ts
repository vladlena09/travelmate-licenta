import type { Poi } from "./pois.js";

export interface ItineraryRequest {
  city: string;
  country?: string;
  days: number;
  budgetLevel: "low" | "medium" | "high";
  travelRhythm: "relaxed" | "balanced" | "dynamic";
  travelProfile: "solo" | "couple" | "family" | "group";
  transportMode: "walking" | "car" | "public_transport";
  interests: string[];
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  pois: Poi[];
  totalDuration: number;
  totalCost: number;
  routePolyline: string | null;
}

// ── Rhythm → attractions per day ─────────────────────────────
function getAttractionsPerDay(rhythm: string): { min: number; max: number } {
  switch (rhythm) {
    case "relaxed":  return { min: 3, max: 4 };
    case "dynamic":  return { min: 6, max: 8 };
    default:         return { min: 4, max: 6 };
  }
}

// ── Score a POI against the trip request ─────────────────────
function scorePoiForRequest(poi: Poi, req: ItineraryRequest): number {
  let score = poi.popularityScore;

  // Strong interest match
  if (req.interests.includes(poi.category)) score += 30;
  if (poi.isMustSee) score += 25;

  // Budget compatibility
  if (req.budgetLevel === "low") {
    score += poi.isFree ? 35 : -20;
  } else if (req.budgetLevel === "medium") {
    score += poi.isFree ? 10 : 0;
    if (poi.estimatedCost > 25) score -= 10;
  } else {
    // high budget — premium paid experiences
    if (!poi.isFree && poi.estimatedCost >= 15) score += 10;
  }

  // Travel profile
  switch (req.travelProfile) {
    case "solo":
      if (["viewpoint", "photography", "culture", "history"].includes(poi.category)) score += 12;
      break;
    case "couple":
      if (["viewpoint", "relaxation", "gastronomy", "architecture"].includes(poi.category)) score += 12;
      break;
    case "family":
      if (["nature", "entertainment", "museum", "relaxation"].includes(poi.category)) score += 12;
      if (poi.category === "nightlife") score -= 30;
      break;
    case "group":
      if (["gastronomy", "landmark", "viewpoint", "culture", "entertainment"].includes(poi.category)) score += 12;
      break;
  }

  return score;
}

// ── Haversine distance in metres ─────────────────────────────
function distanceMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Nearest-neighbour TSP to form a logical walking route ─────
function optimiseRoute(pois: Poi[]): Poi[] {
  if (pois.length <= 2) return pois;

  // Start from the must-see with the highest score, else the first element
  const startIdx = pois.reduce((best, p, i) => {
    if (p.isMustSee && p.popularityScore > pois[best].popularityScore) return i;
    return best;
  }, 0);

  const result: Poi[] = [pois[startIdx]];
  const remaining = [...pois.slice(0, startIdx), ...pois.slice(startIdx + 1)];

  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceMetres(last.lat, last.lon, remaining[i].lat, remaining[i].lon);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }
    result.push(remaining[nearestIdx]);
    remaining.splice(nearestIdx, 1);
  }
  return result;
}

// ── Group POIs into spatially coherent day clusters ──────────
function clusterIntoDays(
  pois: Poi[],
  numDays: number,
  perDay: { min: number; max: number }
): Poi[][] {
  if (pois.length === 0) return Array.from({ length: numDays }, () => []);

  // K-means-style assignment: pick seeds from highest-scored must-sees spread across the list
  const totalWanted = numDays * perDay.max;
  const pool = pois.slice(0, Math.min(totalWanted + numDays * 3, pois.length));

  // Seeds: pick numDays POIs that are as far apart as possible (greedy max-min)
  const seeds: number[] = [0]; // start with top-scored
  while (seeds.length < numDays && seeds.length < pool.length) {
    let bestIdx = -1;
    let bestMinDist = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      if (seeds.includes(i)) continue;
      const minDist = Math.min(
        ...seeds.map((s) => distanceMetres(pool[s].lat, pool[s].lon, pool[i].lat, pool[i].lon))
      );
      if (minDist > bestMinDist) { bestMinDist = minDist; bestIdx = i; }
    }
    if (bestIdx >= 0) seeds.push(bestIdx);
  }

  // Assign each POI to nearest seed's day
  const assigned: Poi[][] = seeds.map(() => []);
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    // Each day already has a seed
    let bestDay = seeds.indexOf(i);
    if (bestDay >= 0) { assigned[bestDay].push(p); continue; }

    bestDay = 0;
    let minDist = Infinity;
    for (let d = 0; d < seeds.length; d++) {
      const seed = pool[seeds[d]];
      const dist = distanceMetres(seed.lat, seed.lon, p.lat, p.lon);
      if (dist < minDist) { minDist = dist; bestDay = d; }
    }
    assigned[bestDay].push(p);
  }

  // Trim each day to perDay.max and ensure at least perDay.min
  const result: Poi[][] = [];
  for (let d = 0; d < numDays; d++) {
    let day = assigned[d] ?? [];

    // Sort within cluster: must-see first, then by score
    day.sort((a, b) => {
      if (a.isMustSee !== b.isMustSee) return a.isMustSee ? -1 : 1;
      return b.popularityScore - a.popularityScore;
    });

    day = day.slice(0, perDay.max);
    result.push(day);
  }

  // Backfill empty or underflowing days from unused top-scored POIs
  const usedIds = new Set(result.flat().map((p) => p.id));
  const unused = pois.filter((p) => !usedIds.has(p.id));
  let unusedIdx = 0;

  for (let d = 0; d < numDays; d++) {
    while (result[d].length < perDay.min && unusedIdx < unused.length) {
      result[d].push(unused[unusedIdx++]);
    }
    if (result[d].length === 0) {
      // Absolute fallback: take from biggest day
      const biggestDay = result.reduce((bi, day, i) => (day.length > result[bi].length ? i : bi), 0);
      if (result[biggestDay].length > perDay.min) {
        result[d].push(result[biggestDay].pop()!);
      }
    }
  }

  return result;
}

// ── Day theme string ─────────────────────────────────────────
function getDayTheme(pois: Poi[], dayNum: number): string {
  if (pois.length === 0) return `Day ${dayNum}: City Exploration`;

  const counts = pois.reduce((acc: Record<string, number>, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "landmark";

  const themes: Record<string, string[]> = {
    history:      ["Historical Journey", "Ancient Wonders", "Through the Ages"],
    museum:       ["Art & Discovery", "Gallery Day", "Cultural Masterpieces"],
    nature:       ["Green Escapes", "Nature & Parks", "Outdoor Day"],
    gastronomy:   ["Culinary Trail", "Food & Flavours", "Local Tastes"],
    architecture: ["Architectural Marvels", "City Icons", "Built Beauties"],
    culture:      ["Cultural Immersion", "Arts & Soul", "Creative Quarter"],
    viewpoint:    ["Panoramic Vistas", "City From Above", "Scenic Highlights"],
    nightlife:    ["Evening Delights", "Night Out", "City After Dark"],
    landmark:     ["City Icons", "Famous Sights", "Essential Highlights"],
    relaxation:   ["Slow Travel Day", "Rest & Recharge", "Leisure & Calm"],
    photography:  ["Photographer's Route", "Visual Journey", "Picture-Perfect"],
    entertainment:["Fun & Adventure", "Entertainment Day", "Discover & Play"],
    sports:       ["Active Day", "Sports & Movement", "City in Motion"],
  };

  const opts = themes[dominant] ?? ["City Exploration", "Discovery Day", "Urban Adventure"];
  const dayNames = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
  const dayName = dayNames[dayNum - 1] ?? `Day ${dayNum}`;
  return `${dayName} Day — ${opts[(dayNum - 1) % opts.length]}`;
}

// ── Main export ──────────────────────────────────────────────
export function generateItinerary(
  pois: Poi[],
  req: ItineraryRequest
): ItineraryDay[] {
  if (pois.length === 0) return [];

  const perDay = getAttractionsPerDay(req.travelRhythm);

  // Score and rank all POIs
  const scoredPois = pois
    .map((p) => ({ poi: p, score: scorePoiForRequest(p, req) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.poi);

  // Cluster into spatially coherent days
  const dayClusters = clusterIntoDays(scoredPois, req.days, perDay);

  // Build ItineraryDay objects
  return dayClusters.map((dayPois, idx) => {
    const routed = optimiseRoute(dayPois);
    const totalDuration = routed.reduce((sum, p) => sum + p.estimatedDuration, 0);
    const totalCost = routed.reduce((sum, p) => sum + p.estimatedCost, 0);

    return {
      dayNumber: idx + 1,
      theme: getDayTheme(routed, idx + 1),
      pois: routed,
      totalDuration,
      totalCost,
      routePolyline: null,
    };
  });
}
