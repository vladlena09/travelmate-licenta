import type { Poi } from "./pois.js";

export interface ItineraryRequest {
  city: string;
  country?: string;
  days: number;
  budgetAmount: number; // total EUR for the trip (0 = unlimited)
  travelRhythm: "relaxed" | "balanced" | "dynamic";
  travelProfile: "solo" | "couple" | "family" | "group";
  transportMode: "walking" | "car" | "public_transport";
  interests: string[];
}

export interface TransportSegment {
  fromPoiId: string;
  toPoiId: string;
  mode: string;
  durationMinutes: number;
  distanceMetres: number;
  instruction: string;
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  pois: Poi[];
  segments: TransportSegment[];
  totalDuration: number;
  travelDuration: number;
  totalCost: number;
  budgetUsed: number;
  transportSummary: string;
}

// ── Rhythm → attractions per day ─────────────────────────────
function getAttractionsPerDay(rhythm: string): { min: number; max: number } {
  switch (rhythm) {
    case "relaxed": return { min: 2, max: 4 };
    case "dynamic": return { min: 6, max: 8 };
    default:        return { min: 4, max: 6 };
  }
}

// ── Transport mode → max cluster radius in metres ─────────────
function getClusterRadius(mode: string): number {
  switch (mode) {
    case "walking":          return 2500;
    case "public_transport": return 7000;
    case "car":              return 25000;
    default:                 return 5000;
  }
}

// ── Walking speed constants ───────────────────────────────────
const WALKING_SPEED_MPS = 1.25; // 4.5 km/h

// ── Speed per transport mode (m/s) ───────────────────────────
function travelSpeedMps(mode: string): number {
  switch (mode) {
    case "walking":          return 1.25;
    case "public_transport": return 5.0;  // includes wait time
    case "car":              return 8.0;  // city driving
    default:                 return 2.0;
  }
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

// ── Build transport segments between ordered POIs ─────────────
function buildSegments(
  pois: Poi[],
  mode: string
): { segments: TransportSegment[]; travelDuration: number } {
  const segments: TransportSegment[] = [];
  let totalTravel = 0;

  for (let i = 0; i < pois.length - 1; i++) {
    const from = pois[i];
    const to = pois[i + 1];
    const dist = distanceMetres(from.lat, from.lon, to.lat, to.lon);
    const speed = travelSpeedMps(mode);
    const rawMinutes = dist / speed / 60;
    // Add boarding overhead for transit
    const overhead = mode === "public_transport" ? 5 : mode === "car" ? 3 : 0;
    const durationMinutes = Math.round(rawMinutes + overhead);
    totalTravel += durationMinutes;

    let instruction = "";
    const distLabel =
      dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;

    switch (mode) {
      case "walking":
        instruction = `Walk ${distLabel} (~${durationMinutes} min) to ${to.name}`;
        break;
      case "car":
        instruction = `Drive ${distLabel} (~${durationMinutes} min) to ${to.name}. Look for parking nearby.`;
        break;
      case "public_transport":
        if (dist < 600) {
          instruction = `Short walk (${Math.round(dist)} m) to ${to.name}`;
        } else {
          instruction = `Take bus/metro ${distLabel} (~${durationMinutes} min) to ${to.name}`;
        }
        break;
    }

    segments.push({
      fromPoiId: from.id,
      toPoiId: to.id,
      mode: dist < 600 && mode !== "walking" ? "walking" : mode,
      durationMinutes,
      distanceMetres: Math.round(dist),
      instruction,
    });

    // Annotate POI with walking info
    (to as Poi & { walkingMinutesFromPrev?: number; transportNote?: string }).walkingMinutesFromPrev =
      durationMinutes;
    (to as Poi & { transportNote?: string }).transportNote = instruction;
  }

  return { segments, travelDuration: totalTravel };
}

// ── Budget-aware scoring ──────────────────────────────────────
function dailyBudget(req: ItineraryRequest): number {
  if (req.budgetAmount <= 0) return Infinity;
  return req.budgetAmount / req.days;
}

function scorePoiForRequest(poi: Poi, req: ItineraryRequest): number {
  let score = poi.popularityScore;

  // Interest match
  if (req.interests.includes(poi.category)) score += 30;
  if (poi.isMustSee) score += 25;

  // Budget compatibility
  const daily = dailyBudget(req);
  if (req.budgetAmount > 0) {
    if (poi.isFree) {
      score += 20; // always prefer free when on a budget
    } else if (poi.estimatedCost > daily * 0.6) {
      // POI alone would eat most of the day budget
      score -= 40;
    } else if (poi.estimatedCost > daily * 0.35) {
      score -= 15;
    }
  }

  // Travel profile preferences
  switch (req.travelProfile) {
    case "solo":
      if (["viewpoint", "photography", "culture", "history", "museum"].includes(poi.category)) score += 14;
      break;
    case "couple":
      if (["viewpoint", "relaxation", "gastronomy", "architecture", "nature"].includes(poi.category)) score += 14;
      if (poi.category === "nightlife") score += 8;
      break;
    case "family":
      if (["nature", "entertainment", "museum", "relaxation", "landmark"].includes(poi.category)) score += 14;
      if (poi.category === "nightlife") score -= 40;
      break;
    case "group":
      if (["gastronomy", "landmark", "viewpoint", "culture", "entertainment", "nightlife"].includes(poi.category)) score += 14;
      break;
  }

  // Transport radius penalty: walking must skip far attractions
  // (handled at cluster level, this is a soft signal)
  return score;
}

// ── Nearest-neighbour TSP within a cluster ────────────────────
function optimiseRoute(pois: Poi[]): Poi[] {
  if (pois.length <= 2) return [...pois];

  // Start from the highest-scored must-see, else first
  let startIdx = 0;
  for (let i = 1; i < pois.length; i++) {
    if (
      pois[i].isMustSee && pois[i].popularityScore > pois[startIdx].popularityScore
    ) {
      startIdx = i;
    }
  }

  const result: Poi[] = [pois[startIdx]];
  const remaining = pois.filter((_, i) => i !== startIdx);

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

// ── Cluster POIs into days (greedy geographic spread + radius) ─
function clusterIntoDays(
  pois: Poi[],
  numDays: number,
  perDay: { min: number; max: number },
  clusterRadius: number
): Poi[][] {
  if (pois.length === 0) return Array.from({ length: numDays }, () => []);

  // Pool: take more than needed so clusters have enough to trim
  const pool = pois.slice(0, Math.min(numDays * perDay.max + numDays * 4, pois.length));

  // Pick numDays cluster seeds — greedy max-min distance spread
  const seeds: number[] = [0];
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
    if (bestIdx < 0) break;
    seeds.push(bestIdx);
  }

  // Assign each pool POI to its nearest seed, respecting radius limit
  const assigned: Poi[][] = seeds.map(() => []);
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    const seedIdx = seeds.indexOf(i);
    if (seedIdx >= 0) { assigned[seedIdx].push(p); continue; }

    let bestDay = 0;
    let minDist = Infinity;
    for (let d = 0; d < seeds.length; d++) {
      const seed = pool[seeds[d]];
      const dist = distanceMetres(seed.lat, seed.lon, p.lat, p.lon);
      if (dist < minDist) { minDist = dist; bestDay = d; }
    }
    // Only assign if within radius; otherwise skip (will be backfilled)
    if (minDist <= clusterRadius * 1.5) {
      assigned[bestDay].push(p);
    }
  }

  // Sort within each cluster: must-see first, then by trip score
  const result: Poi[][] = assigned.map((day) => {
    day.sort((a, b) => {
      if (a.isMustSee !== b.isMustSee) return a.isMustSee ? -1 : 1;
      return b.popularityScore - a.popularityScore;
    });
    return day.slice(0, perDay.max);
  });

  // Pad underflowing days from unused POIs
  const usedIds = new Set(result.flat().map((p) => p.id));
  const unused = pois.filter((p) => !usedIds.has(p.id));
  let ui = 0;
  for (let d = 0; d < numDays; d++) {
    while (result[d].length < perDay.min && ui < unused.length) {
      result[d].push(unused[ui++]);
    }
    if (result[d].length === 0) {
      const biggest = result.reduce((bi, day, i) => (day.length > result[bi].length ? i : bi), 0);
      if (result[biggest].length > perDay.min) {
        result[d].push(result[biggest].pop()!);
      }
    }
  }

  return result;
}

// ── Budget filter: trim paid attractions that blow the budget ──
function applyBudgetFilter(
  dayPois: Poi[],
  dayBudget: number
): Poi[] {
  if (dayBudget <= 0 || dayBudget === Infinity) return dayPois;

  const result: Poi[] = [];
  let spent = 0;

  // Must-see + free first pass
  for (const p of dayPois) {
    if (p.isMustSee || p.isFree) {
      result.push(p);
      spent += p.estimatedCost;
    }
  }

  // Then add paid non-must-see if budget allows
  for (const p of dayPois) {
    if (!p.isMustSee && !p.isFree) {
      if (spent + p.estimatedCost <= dayBudget) {
        result.push(p);
        spent += p.estimatedCost;
      }
    }
  }

  // Maintain original order by re-sorting (must-see first then popularity)
  result.sort((a, b) => {
    if (a.isMustSee !== b.isMustSee) return a.isMustSee ? -1 : 1;
    return b.popularityScore - a.popularityScore;
  });

  return result;
}

// ── Transport day summary ─────────────────────────────────────
function buildTransportSummary(
  mode: string,
  pois: Poi[],
  segments: TransportSegment[]
): string {
  const totalDist = segments.reduce((s, seg) => s + seg.distanceMetres, 0);
  const distLabel =
    totalDist < 1000 ? `${Math.round(totalDist)} m` : `${(totalDist / 1000).toFixed(1)} km`;

  switch (mode) {
    case "walking":
      return `All on foot — ${distLabel} total walking, ${segments.length} segments`;
    case "car":
      return `By car — ${distLabel} total driving. Parking available near most sights.`;
    case "public_transport": {
      const walkSegs = segments.filter((s) => s.mode === "walking").length;
      const transitSegs = segments.filter((s) => s.mode !== "walking").length;
      return `${transitSegs} transit leg${transitSegs !== 1 ? "s" : ""} + ${walkSegs} short walk${walkSegs !== 1 ? "s" : ""} (${distLabel} total)`;
    }
    default:
      return `${distLabel} total distance`;
  }
}

// ── Day theme string ─────────────────────────────────────────
function getDayTheme(pois: Poi[], dayNum: number): string {
  if (pois.length === 0) return `Day ${dayNum} — City Exploration`;
  const counts = pois.reduce((acc: Record<string, number>, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "landmark";
  const themes: Record<string, string[]> = {
    history:       ["Historical Journey", "Ancient Wonders", "Through the Ages"],
    museum:        ["Art & Discovery", "Gallery Day", "Cultural Masterpieces"],
    nature:        ["Green Escapes", "Nature & Parks", "Outdoor Day"],
    gastronomy:    ["Culinary Trail", "Food & Flavours", "Local Tastes"],
    architecture:  ["Architectural Marvels", "City Icons", "Built Beauties"],
    culture:       ["Cultural Immersion", "Arts & Soul", "Creative Quarter"],
    viewpoint:     ["Panoramic Vistas", "City From Above", "Scenic Highlights"],
    nightlife:     ["Evening Delights", "Night Out", "City After Dark"],
    landmark:      ["City Icons", "Famous Sights", "Essential Highlights"],
    relaxation:    ["Slow Travel Day", "Rest & Recharge", "Leisure & Calm"],
    photography:   ["Photographer's Route", "Visual Journey", "Picture-Perfect"],
    entertainment: ["Fun & Adventure", "Entertainment Day", "Discover & Play"],
    sports:        ["Active Day", "Sports & Movement", "City in Motion"],
  };
  const opts = themes[dominant] ?? ["City Exploration", "Discovery Day", "Urban Adventure"];
  const dayNames = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth", "Fourteenth"];
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
  const clusterRadius = getClusterRadius(req.transportMode);
  const daily = dailyBudget(req);

  // Score and rank
  const scoredPois = pois
    .map((p) => ({ poi: p, score: scorePoiForRequest(p, req) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.poi);

  // Cluster geographically
  const dayClusters = clusterIntoDays(scoredPois, req.days, perDay, clusterRadius);

  // Build days
  let cumBudget = 0;
  return dayClusters.map((rawPois, idx) => {
    // Apply budget filter per day
    const filtered = applyBudgetFilter(rawPois, daily);
    // Optimise route within cluster
    const routed = optimiseRoute(filtered.length > 0 ? filtered : rawPois);

    const { segments, travelDuration } = buildSegments(routed, req.transportMode);
    const totalDuration = routed.reduce((s, p) => s + p.estimatedDuration, 0);
    const totalCost = routed.reduce((s, p) => s + p.estimatedCost, 0);
    cumBudget += totalCost;

    return {
      dayNumber: idx + 1,
      theme: getDayTheme(routed, idx + 1),
      pois: routed,
      segments,
      totalDuration,
      travelDuration,
      totalCost,
      budgetUsed: cumBudget,
      transportSummary: buildTransportSummary(req.transportMode, routed, segments),
    };
  });
}
