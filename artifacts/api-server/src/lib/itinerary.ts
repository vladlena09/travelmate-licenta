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

function getAttractionsPerDay(rhythm: string): number {
  switch (rhythm) {
    case "relaxed":
      return 3;
    case "balanced":
      return 5;
    case "dynamic":
      return 7;
    default:
      return 5;
  }
}

function scorePoiForRequest(poi: Poi, req: ItineraryRequest): number {
  let score = poi.popularityScore;

  if (req.interests.includes(poi.category)) {
    score += 25;
  }
  if (poi.isMustSee) {
    score += 20;
  }

  if (req.budgetLevel === "low") {
    if (poi.isFree) score += 30;
    else score -= 15;
  } else if (req.budgetLevel === "medium") {
    if (poi.isFree) score += 10;
    if (poi.estimatedCost > 25) score -= 10;
  } else {
    if (!poi.isFree && poi.estimatedCost > 15) score += 10;
  }

  switch (req.travelProfile) {
    case "solo":
      if (["viewpoint", "photography", "culture", "history"].includes(poi.category))
        score += 10;
      break;
    case "couple":
      if (["viewpoint", "relaxation", "gastronomy", "architecture"].includes(poi.category))
        score += 10;
      break;
    case "family":
      if (["nature", "entertainment", "museum", "relaxation"].includes(poi.category))
        score += 10;
      if (poi.category === "nightlife") score -= 20;
      break;
    case "group":
      if (["gastronomy", "landmark", "viewpoint", "culture"].includes(poi.category))
        score += 10;
      if (poi.category === "relaxation") score -= 5;
      break;
  }

  return score;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
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

function clusterNearby(pois: Poi[], maxDistance: number = 2000): Poi[][] {
  const assigned = new Set<string>();
  const clusters: Poi[][] = [];

  for (const poi of pois) {
    if (assigned.has(poi.id)) continue;
    const cluster: Poi[] = [poi];
    assigned.add(poi.id);

    for (const other of pois) {
      if (assigned.has(other.id)) continue;
      const dist = haversineDistance(poi.lat, poi.lon, other.lat, other.lon);
      if (dist <= maxDistance) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }
    clusters.push(cluster);
  }

  return clusters;
}

function optimizeRouteWithinDay(pois: Poi[]): Poi[] {
  if (pois.length <= 2) return pois;

  const result: Poi[] = [pois[0]];
  const remaining = pois.slice(1);

  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(
        last.lat,
        last.lon,
        remaining[i].lat,
        remaining[i].lon
      );
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    result.push(remaining[nearestIdx]);
    remaining.splice(nearestIdx, 1);
  }

  return result;
}

function getDayTheme(pois: Poi[], dayNum: number): string {
  const categories = pois.map((p) => p.category);
  const counts = categories.reduce(
    (acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const themes: Record<string, string[]> = {
    history: [
      "Historical Highlights",
      "Ancient Wonders",
      "Journey Through History",
    ],
    museum: ["Museum Day", "Art & Culture", "Gallery Exploration"],
    nature: ["Nature & Parks", "Green Escapes", "Outdoor Adventure"],
    gastronomy: [
      "Culinary Discovery",
      "Food & Flavours",
      "Local Tastes",
    ],
    architecture: [
      "Architectural Marvels",
      "City Icons",
      "Design & Beauty",
    ],
    culture: ["Cultural Immersion", "Art & Soul", "Creative Quarter"],
    viewpoint: [
      "Panoramic Views",
      "City From Above",
      "Scenic Vistas",
    ],
    nightlife: ["Evening Delights", "Night Out", "City After Dark"],
    landmark: ["City Landmarks", "Icons & Monuments", "Essential Sights"],
    relaxation: ["Leisure & Relaxation", "Slow Living", "Rest & Recharge"],
    photography: [
      "Photographer's Route",
      "Visual Journey",
      "Picture-Perfect Day",
    ],
  };

  const dayNames = [
    "First",
    "Second",
    "Third",
    "Fourth",
    "Fifth",
    "Sixth",
    "Seventh",
  ];
  const dayName = dayNames[dayNum - 1] ?? `Day ${dayNum}`;

  const themeOptions = themes[dominant] || ["City Exploration", "Discovery Day", "Adventure"];
  const theme = themeOptions[dayNum % themeOptions.length];
  return `${dayName} Day: ${theme}`;
}

export function generateItinerary(
  pois: Poi[],
  req: ItineraryRequest
): ItineraryDay[] {
  const attractionsPerDay = getAttractionsPerDay(req.travelRhythm);
  const totalAttractions = attractionsPerDay * req.days;

  const scoredPois = pois
    .map((p) => ({ poi: p, score: scorePoiForRequest(p, req) }))
    .sort((a, b) => b.score - a.score);

  const selectedPois = scoredPois.slice(0, Math.min(totalAttractions + 5, scoredPois.length)).map(
    (s) => s.poi
  );

  const mustSees = selectedPois.filter((p) => p.isMustSee);
  const others = selectedPois.filter((p) => !p.isMustSee);

  const ordered = [...mustSees, ...others].slice(0, totalAttractions);

  const days: ItineraryDay[] = [];
  let poiIdx = 0;

  for (let day = 1; day <= req.days; day++) {
    const dayPois: Poi[] = [];
    let count = attractionsPerDay;

    if (poiIdx >= ordered.length) break;

    for (let i = 0; i < count && poiIdx < ordered.length; i++) {
      dayPois.push(ordered[poiIdx++]);
    }

    if (dayPois.length < 2) {
      const extra = pois.filter((p) => !ordered.includes(p)).slice(0, count - dayPois.length);
      dayPois.push(...extra);
    }

    const optimizedPois = optimizeRouteWithinDay(dayPois);

    const totalDuration = optimizedPois.reduce(
      (sum, p) => sum + p.estimatedDuration,
      0
    );
    const totalCost = optimizedPois.reduce((sum, p) => sum + p.estimatedCost, 0);

    days.push({
      dayNumber: day,
      theme: getDayTheme(optimizedPois, day),
      pois: optimizedPois,
      totalDuration,
      totalCost,
      routePolyline: null,
    });
  }

  return days;
}
