import type { Poi } from "./pois.js";

export interface ItineraryRequest {
  city: string;
  country?: string;
  days: number;
  budgetAmount: number;
  travelRhythm: "relaxed" | "balanced" | "dynamic";
  travelProfile: "solo" | "couple" | "family" | "group";
  transportMode: "walking" | "car" | "public_transport";
  interests: string[];
  priorityMode: "iconic" | "mixed";
  startTime?: "early" | "normal" | "late";
  regenerateDayNumber?: number;
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
  freePoisCount: number;
  paidPoisCount: number;
  budgetUsed: number;
  transportSummary: string;
  startTimeLabel: string;
}

// ── Rhythm → attractions per day ─────────────────────────────
function getAttractionsPerDay(rhythm: string): { min: number; max: number } {
  switch (rhythm) {
    case "relaxed": return { min: 2, max: 4 };
    case "dynamic": return { min: 6, max: 8 };
    default:        return { min: 4, max: 6 };
  }
}

// ── Transport cluster radius in metres ────────────────────────
function getClusterRadius(mode: string): number {
  switch (mode) {
    case "walking":          return 2500;
    case "public_transport": return 7000;
    case "car":              return 28000;
    default:                 return 5000;
  }
}

// ── Travel speed per mode (m/s) ───────────────────────────────
function travelSpeedMps(mode: string): number {
  switch (mode) {
    case "walking":          return 1.25;
    case "public_transport": return 5.0;
    case "car":              return 8.5;
    default:                 return 2.0;
  }
}

// ── Start time label ─────────────────────────────────────────
function startTimeLabel(startTime: string | undefined): string {
  switch (startTime) {
    case "early":  return "Starting 8:00 AM";
    case "late":   return "Starting 11:00 AM";
    default:       return "Starting 9:30 AM";
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

// ── Build transport segments ──────────────────────────────────
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
    const overhead = mode === "public_transport" ? 6 : mode === "car" ? 3 : 0;
    const durationMinutes = Math.max(1, Math.round(rawMinutes + overhead));
    totalTravel += durationMinutes;

    const distLabel =
      dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`;
    const isShortWalk = dist < 600;

    let instruction = "";
    let segMode = mode;

    switch (mode) {
      case "walking":
        instruction = `Walk ${distLabel} (~${durationMinutes} min) to ${to.name}`;
        break;
      case "car":
        if (dist < 400) {
          instruction = `Short walk (${Math.round(dist)} m) to ${to.name}`;
          segMode = "walking";
        } else {
          instruction = `Drive ${distLabel} (~${durationMinutes} min) to ${to.name} — look for street parking`;
        }
        break;
      case "public_transport":
        if (isShortWalk) {
          instruction = `Walk ${Math.round(dist)} m to ${to.name}`;
          segMode = "walking";
        } else if (dist < 2000) {
          instruction = `Walk or take a short bus (${distLabel}, ~${durationMinutes} min) to ${to.name}`;
          segMode = "walking";
        } else {
          instruction = `Metro/bus ${distLabel} (~${durationMinutes - overhead} min + ${overhead} min wait) — board at nearest stop to ${from.name}, exit at ${to.name}`;
        }
        break;
    }

    segments.push({
      fromPoiId: from.id,
      toPoiId: to.id,
      mode: segMode,
      durationMinutes,
      distanceMetres: Math.round(dist),
      instruction,
    });
  }

  return { segments, travelDuration: totalTravel };
}

// ── Per-day budget ────────────────────────────────────────────
function dailyBudget(req: ItineraryRequest): number {
  if (req.budgetAmount <= 0) return Infinity;
  return req.budgetAmount / req.days;
}

// ── Score a POI for this request ──────────────────────────────
function scorePoiForRequest(poi: Poi, req: ItineraryRequest): number {
  let score = poi.popularityScore;

  // Interest match bonus
  if (req.interests.includes(poi.category)) score += 28;

  // Priority mode
  if (req.priorityMode === "iconic") {
    if (poi.isMustSee) score += 35;
    // Penalise low-popularity items
    if (poi.popularityScore < 60) score -= 20;
  } else {
    // mixed: still reward must-see but not as aggressively
    if (poi.isMustSee) score += 15;
    // Slight bonus for less-famous items (hidden gems)
    if (!poi.isMustSee && poi.popularityScore >= 50 && poi.popularityScore < 75) score += 8;
  }

  // Budget compatibility
  const daily = dailyBudget(req);
  if (req.budgetAmount > 0) {
    if (poi.isFree) {
      score += 15;
    } else if (poi.estimatedCost > daily * 0.65) {
      score -= 45; // too expensive for this budget/day
    } else if (poi.estimatedCost > daily * 0.4) {
      score -= 18;
    }
  }

  // Travel profile
  switch (req.travelProfile) {
    case "solo":
      if (["viewpoint", "photography", "culture", "history", "museum"].includes(poi.category)) score += 12;
      if (poi.category === "nightlife") score += 5;
      break;
    case "couple":
      if (["viewpoint", "relaxation", "gastronomy", "architecture", "nature"].includes(poi.category)) score += 12;
      if (poi.category === "nightlife") score += 10;
      break;
    case "family":
      if (["nature", "entertainment", "museum", "relaxation", "landmark"].includes(poi.category)) score += 14;
      if (poi.category === "nightlife") score -= 50;
      if (poi.category === "gastronomy") score += 5;
      break;
    case "group":
      if (["gastronomy", "landmark", "viewpoint", "culture", "entertainment", "nightlife"].includes(poi.category)) score += 12;
      break;
  }

  return score;
}

// ── Nearest-neighbour TSP ─────────────────────────────────────
function optimiseRoute(pois: Poi[]): Poi[] {
  if (pois.length <= 2) return [...pois];

  // Start from the most iconic must-see, else highest-scored
  let startIdx = 0;
  for (let i = 1; i < pois.length; i++) {
    const curr = pois[i];
    const best = pois[startIdx];
    if (curr.isMustSee && !best.isMustSee) { startIdx = i; continue; }
    if (curr.isMustSee === best.isMustSee && curr.popularityScore > best.popularityScore) startIdx = i;
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

// ── k-means-style geographic clustering ───────────────────────
function clusterIntoDays(
  pois: Poi[],
  numDays: number,
  perDay: { min: number; max: number },
  clusterRadius: number
): Poi[][] {
  if (pois.length === 0) return Array.from({ length: numDays }, () => []);

  const pool = pois.slice(0, Math.min(numDays * perDay.max + numDays * 5, pois.length));

  // Seeds: greedy max-min distance spread from top-scored
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
    if (minDist <= clusterRadius * 1.5) {
      assigned[bestDay].push(p);
    }
  }

  const result: Poi[][] = assigned.map((day) => {
    day.sort((a, b) => {
      if (a.isMustSee !== b.isMustSee) return a.isMustSee ? -1 : 1;
      return b.popularityScore - a.popularityScore;
    });
    return day.slice(0, perDay.max);
  });

  // Backfill underflowing days
  const usedIds = new Set(result.flat().map((p) => p.id));
  const unused = pois.filter((p) => !usedIds.has(p.id));
  let ui = 0;
  for (let d = 0; d < numDays; d++) {
    while (result[d].length < perDay.min && ui < unused.length) {
      result[d].push(unused[ui++]);
    }
    if (result[d].length === 0) {
      const biggest = result.reduce((bi, day, i) =>
        day.length > result[bi].length ? i : bi, 0);
      if (result[biggest].length > perDay.min) {
        result[d].push(result[biggest].pop()!);
      }
    }
  }

  return result;
}

// ── Budget filter ─────────────────────────────────────────────
function applyBudgetFilter(dayPois: Poi[], dayBudget: number): Poi[] {
  if (dayBudget <= 0 || !isFinite(dayBudget)) return dayPois;

  const result: Poi[] = [];
  let spent = 0;

  // First pass: must-see (always include, even if paid)
  for (const p of dayPois) {
    if (p.isMustSee) {
      result.push(p);
      spent += p.estimatedCost;
    }
  }

  // Second pass: free non-must-see
  for (const p of dayPois) {
    if (!p.isMustSee && p.isFree) {
      result.push(p);
    }
  }

  // Third pass: paid non-must-see within remaining budget
  for (const p of dayPois) {
    if (!p.isMustSee && !p.isFree) {
      if (spent + p.estimatedCost <= dayBudget) {
        result.push(p);
        spent += p.estimatedCost;
      }
    }
  }

  result.sort((a, b) => {
    if (a.isMustSee !== b.isMustSee) return a.isMustSee ? -1 : 1;
    return b.popularityScore - a.popularityScore;
  });

  return result;
}

// ── Transport summary text ────────────────────────────────────
function buildTransportSummary(
  mode: string,
  segments: TransportSegment[]
): string {
  const totalDist = segments.reduce((s, seg) => s + seg.distanceMetres, 0);
  const distLabel =
    totalDist < 1000 ? `${Math.round(totalDist)} m` : `${(totalDist / 1000).toFixed(1)} km`;

  switch (mode) {
    case "walking":
      return `${distLabel} on foot across ${segments.length + 1} stops`;
    case "car": {
      const drivingSegs = segments.filter((s) => s.mode === "car").length;
      const walkSegs = segments.filter((s) => s.mode === "walking").length;
      return `${drivingSegs} drive${drivingSegs !== 1 ? "s" : ""} + ${walkSegs} short walk${walkSegs !== 1 ? "s" : ""} — parking suggested`;
    }
    case "public_transport": {
      const transitSegs = segments.filter((s) => s.mode === "public_transport").length;
      const walkSegs = segments.filter((s) => s.mode === "walking").length;
      return `${transitSegs} transit leg${transitSegs !== 1 ? "s" : ""} + ${walkSegs} walk${walkSegs !== 1 ? "s" : ""} (${distLabel})`;
    }
    default:
      return `${distLabel} total`;
  }
}

// ── Day theme ─────────────────────────────────────────────────
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
    nature:        ["Green Escapes", "Parks & Gardens", "Outdoor Day"],
    gastronomy:    ["Culinary Trail", "Food & Flavours", "Local Tastes"],
    architecture:  ["Architectural Marvels", "City Icons", "Built Beauties"],
    culture:       ["Cultural Immersion", "Arts & Soul", "Creative Quarter"],
    viewpoint:     ["Panoramic Vistas", "City From Above", "Scenic Highlights"],
    nightlife:     ["Evening Delights", "Night Out", "City After Dark"],
    landmark:      ["City Highlights", "Famous Sights", "Essential Icons"],
    relaxation:    ["Slow Travel Day", "Rest & Recharge", "Leisure & Calm"],
    photography:   ["Photographer's Route", "Visual Journey", "Picture-Perfect"],
    entertainment: ["Fun & Adventure", "Entertainment Day", "Discover & Play"],
    sports:        ["Active Day", "Sports & Movement", "City in Motion"],
  };

  const opts = themes[dominant] ?? ["City Exploration", "Discovery Day", "Urban Adventure"];
  const dayNames = [
    "First", "Second", "Third", "Fourth", "Fifth",
    "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
    "Eleventh", "Twelfth", "Thirteenth", "Fourteenth",
  ];
  const dayName = dayNames[dayNum - 1] ?? `Day ${dayNum}`;
  return `${dayName} Day — ${opts[(dayNum - 1) % opts.length]}`;
}

// ── Build a single ItineraryDay ───────────────────────────────
function buildDay(
  rawPois: Poi[],
  req: ItineraryRequest,
  dayNum: number,
  cumBudget: number
): ItineraryDay {
  const daily = dailyBudget(req);
  const filtered = applyBudgetFilter(rawPois, daily);
  const routed = optimiseRoute(filtered.length > 0 ? filtered : rawPois);

  const { segments, travelDuration } = buildSegments(routed, req.transportMode);
  const totalDuration = routed.reduce((s, p) => s + p.estimatedDuration, 0);
  const totalCost = routed.reduce((s, p) => s + p.estimatedCost, 0);
  const freePoisCount = routed.filter((p) => p.isFree).length;
  const paidPoisCount = routed.filter((p) => !p.isFree).length;

  return {
    dayNumber: dayNum,
    theme: getDayTheme(routed, dayNum),
    pois: routed,
    segments,
    totalDuration,
    travelDuration,
    totalCost,
    freePoisCount,
    paidPoisCount,
    budgetUsed: cumBudget + totalCost,
    transportSummary: buildTransportSummary(req.transportMode, segments),
    startTimeLabel: startTimeLabel(req.startTime),
  };
}

// ── Main export ──────────────────────────────────────────────
export function generateItinerary(pois: Poi[], req: ItineraryRequest): ItineraryDay[] {
  if (pois.length === 0) return [];

  const perDay = getAttractionsPerDay(req.travelRhythm);
  const clusterRadius = getClusterRadius(req.transportMode);

  const scoredPois = pois
    .map((p) => ({ poi: p, score: scorePoiForRequest(p, req) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.poi);

  const dayClusters = clusterIntoDays(scoredPois, req.days, perDay, clusterRadius);

  let cumBudget = 0;
  return dayClusters.map((rawPois, idx) => {
    const day = buildDay(rawPois, req, idx + 1, cumBudget);
    cumBudget = day.budgetUsed;
    return day;
  });
}

// ── Re-generate a single day (keeping others unchanged) ───────
export function regenerateSingleDay(
  pois: Poi[],
  req: ItineraryRequest,
  existingDays: ItineraryDay[],
  dayNumber: number
): ItineraryDay[] {
  // Collect IDs already used by other days
  const otherDays = existingDays.filter((d) => d.dayNumber !== dayNumber);
  const usedIds = new Set(otherDays.flatMap((d) => d.pois.map((p) => p.id)));

  // Available POIs for the regenerated day
  const available = pois
    .filter((p) => !usedIds.has(p.id))
    .map((p) => ({ poi: p, score: scorePoiForRequest(p, req) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.poi);

  const perDay = getAttractionsPerDay(req.travelRhythm);
  const cumBudget = otherDays
    .filter((d) => d.dayNumber < dayNumber)
    .reduce((s, d) => s + d.totalCost, 0);

  const newDay = buildDay(available.slice(0, perDay.max + 4), req, dayNumber, cumBudget);

  return existingDays.map((d) => (d.dayNumber === dayNumber ? newDay : d));
}
