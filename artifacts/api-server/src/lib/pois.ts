import axios from "axios";

export interface Poi {
  id: string;
  name: string;
  description: string;
  category: string;
  lat: number;
  lon: number;
  estimatedDuration: number;
  estimatedCost: number;
  isMustSee: boolean;
  isFree: boolean;
  optionalPaidExperience: string | null;
  optionalPaidCost: number | null;
  popularityScore: number;
  imageUrl: string | null;
  address: string | null;
  openingHours: string | null;
}

type OsmTags = Record<string, string>;

function categoryFromTags(tags: OsmTags): string {
  if (tags.tourism === "museum" || tags.amenity === "museum") return "museum";
  if (tags.tourism === "viewpoint" || tags.natural === "peak") return "viewpoint";
  if (tags.historic === "castle" || tags.historic === "fort") return "history";
  if (tags.historic === "ruins" || tags.historic === "archaeological_site") return "history";
  if (tags.historic === "monument" || tags.historic === "memorial") return "history";
  if (tags.historic) return "history";
  if (tags.tourism === "gallery" || tags.amenity === "arts_centre") return "culture";
  if (tags.amenity === "theatre" || tags.amenity === "cinema") return "culture";
  if (tags.tourism === "artwork") return "culture";
  if (tags.leisure === "park" || tags.leisure === "garden") return "nature";
  if (tags.natural === "wood" || tags.landuse === "forest") return "nature";
  if (tags.amenity === "restaurant" || tags.amenity === "cafe") return "gastronomy";
  if (tags.shop === "bakery" || tags.amenity === "fast_food") return "gastronomy";
  if (tags.amenity === "nightclub" || tags.amenity === "pub") return "nightlife";
  if (tags.amenity === "bar") return "nightlife";
  if (tags.amenity === "place_of_worship" || tags.religion) return "architecture";
  if (tags.tourism === "theme_park") return "entertainment";
  if (tags.tourism === "zoo" || tags.tourism === "aquarium") return "entertainment";
  if (tags.leisure === "sports_centre" || tags.leisure === "stadium") return "sports";
  if (tags.amenity === "spa" || tags.leisure === "spa") return "relaxation";
  // Default: tourism=attraction → "landmark"
  return "landmark";
}

function isFreeFromTags(tags: OsmTags, category: string): boolean {
  // Explicit OSM fee tags take precedence
  if (tags.fee === "no") return true;
  if (tags.fee === "yes") return false;
  // Gastronomy and nightlife are never "free"
  if (["gastronomy", "nightlife"].includes(category)) return false;
  // Paid categories by default
  if (["museum", "entertainment"].includes(category)) return false;
  // Viewpoints, nature, history exteriors, architecture = free
  if (["viewpoint", "nature", "relaxation"].includes(category)) return true;
  if (category === "history") return true;
  if (category === "architecture") return true;
  if (category === "culture" && !tags.fee) return false; // galleries usually charge
  return true;
}

function estimateCost(isFree: boolean, category: string): number {
  if (isFree) return 0;
  const costs: Record<string, number> = {
    museum: 15,
    entertainment: 20,
    culture: 12,
    history: 8,
    viewpoint: 5,
    architecture: 5,
    sports: 15,
    relaxation: 25,
    nightlife: 20,
    gastronomy: 30,
    nature: 0,
    landmark: 0,
    photography: 0,
  };
  return costs[category] ?? 10;
}

function estimateDuration(category: string, tags: OsmTags): number {
  const durations: Record<string, number> = {
    museum: 90,
    viewpoint: 30,
    history: 60,
    culture: 60,
    nature: 60,
    gastronomy: 75,
    nightlife: 120,
    architecture: 45,
    entertainment: 90,
    sports: 90,
    relaxation: 60,
    landmark: 45,
    photography: 40,
  };
  // Big parks / gardens get more time
  if (category === "nature" && (tags.leisure === "garden" || tags.leisure === "park")) {
    return 75;
  }
  return durations[category] ?? 60;
}

/**
 * Multi-factor popularity scoring — strongly differentiates world-famous vs local attractions.
 * Base is kept low (20) so only truly notable places climb to 80+.
 */
function popularityScore(tags: OsmTags, category: string, name: string): number {
  let score = 20;

  // Internationally known: has English name + wikidata + wikipedia = very famous
  const hasWikidata = !!tags.wikidata;
  const hasWikipedia = !!tags.wikipedia;
  const hasEnName = !!tags["name:en"];

  if (hasWikidata) score += 30;
  if (hasWikipedia) score += 20;
  if (hasEnName) score += 10;

  // Category boosts
  if (tags.tourism === "attraction") score += 15;
  if (tags.tourism === "museum") score += 12;
  if (tags.tourism === "viewpoint") score += 10;
  if (tags.historic) score += 8;

  // Boost for explicitly tagged as heritage or capital attractions
  if (tags["heritage:operator"] || tags["heritage"]) score += 5;
  if (tags.boundary === "national_park") score += 10;

  // Penalty for minor/local things without international recognition
  if (!hasWikidata && !hasWikipedia) score -= 10;

  // Length of English name is a weak signal of fame
  if (name.length > 5 && hasEnName) score += 3;

  return Math.max(5, Math.min(score, 100));
}

function isMustSee(score: number, tags: OsmTags): boolean {
  if (score >= 70) return true;
  // Explicitly heritage sites
  if (tags["heritage:operator"] || tags.heritage) return score >= 50;
  return false;
}

function getOptionalPaidInfo(
  tags: OsmTags,
  category: string,
  isFree: boolean,
  name: string
): { exp: string | null; cost: number | null } {
  if (!isFree) return { exp: null, cost: null };
  if (category === "viewpoint" && (tags.tower === "observation" || name.toLowerCase().includes("tower"))) {
    return { exp: "Ascend to the viewing platform", cost: 15 };
  }
  if (category === "history" && tags.historic === "castle") {
    return { exp: "Castle interior entry", cost: 10 };
  }
  if (category === "architecture" && (tags.building === "cathedral" || tags.amenity === "place_of_worship")) {
    return { exp: "Guided tour of interior", cost: 8 };
  }
  return { exp: null, cost: null };
}

/** Build a rich description from OSM tags */
function buildDescription(tags: OsmTags, name: string, category: string): string {
  if (tags["description:en"]) return tags["description:en"];
  if (tags.description) return tags.description;

  const catLabels: Record<string, string> = {
    museum: "museum",
    viewpoint: "panoramic viewpoint",
    history: "historic site",
    culture: "cultural venue",
    nature: "park or garden",
    gastronomy: "dining spot",
    nightlife: "nightlife venue",
    architecture: "architectural landmark",
    entertainment: "entertainment venue",
    sports: "sports venue",
    relaxation: "relaxation spot",
    landmark: "landmark",
    photography: "photography spot",
  };

  const label = catLabels[category] ?? "attraction";
  const heritage = tags.heritage ? " — a UNESCO-listed heritage site" : "";
  const century = tags["start_date"]
    ? ` dating back to ${tags["start_date"]}`
    : "";
  return `${name} is a notable ${label} in the city${century}${heritage}.`;
}

export async function fetchPoisFromOverpass(
  lat: number,
  lon: number,
  radius: number = 6000
): Promise<Poi[]> {
  // Two-pass query: first get internationally known attractions (with wikidata),
  // then supplement with other tourist features nearby
  const query = `
[out:json][timeout:30];
(
  node["tourism"~"attraction|museum|viewpoint|gallery|zoo|aquarium|theme_park"]["wikidata"](around:${radius},${lat},${lon});
  node["tourism"~"attraction|museum|viewpoint|gallery"]["wikipedia"](around:${radius},${lat},${lon});
  node["historic"~"castle|monument|memorial|ruins|fort|archaeological_site"]["wikidata"](around:${radius},${lat},${lon});
  node["historic"]["wikipedia"](around:${radius},${lat},${lon});
  node["leisure"~"park|garden"]["wikidata"](around:${radius},${lat},${lon});
  node["tourism"~"attraction|museum|viewpoint"](around:${radius},${lat},${lon});
  node["historic"~"castle|monument|memorial|ruins|fort|archaeological_site"](around:${radius},${lat},${lon});
  node["leisure"~"park|garden"](around:${radius},${lat},${lon});
  node["amenity"~"theatre|cinema|arts_centre"]["wikidata"](around:${radius},${lat},${lon});
  way["tourism"~"attraction|museum|viewpoint"]["wikidata"](around:${radius},${lat},${lon});
  way["tourism"~"attraction|museum|viewpoint"]["wikipedia"](around:${radius},${lat},${lon});
  way["historic"~"castle|monument|ruins"]["wikidata"](around:${radius},${lat},${lon});
  way["leisure"~"park|garden"]["wikidata"](around:${radius},${lat},${lon});
  way["tourism"~"attraction|museum|viewpoint"](around:${radius},${lat},${lon});
  way["historic"~"castle|monument|ruins|fort"](around:${radius},${lat},${lon});
  way["leisure"~"park|garden"](around:${radius},${lat},${lon});
);
out center 150;
`;

  try {
    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      `data=${encodeURIComponent(query)}`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 25000,
      }
    );

    const elements: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: OsmTags;
    }> = response.data?.elements || [];

    // Deduplicate by name (OSM can return same place as node + way)
    const seen = new Set<string>();
    const pois: Poi[] = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"] || "";
      if (!name || name.length < 2) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!elLat || !elLon) continue;

      // Deduplicate by name + approximate location
      const dedupeKey = `${name.toLowerCase().trim()}-${Math.round(elLat * 1000)}-${Math.round(elLon * 1000)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const category = categoryFromTags(tags);
      const free = isFreeFromTags(tags, category);
      const cost = estimateCost(free, category);
      const duration = estimateDuration(category, tags);
      const score = popularityScore(tags, category, name);
      const mustSee = isMustSee(score, tags);
      const { exp, cost: optCost } = getOptionalPaidInfo(tags, category, free, name);
      const description = buildDescription(tags, name, category);

      pois.push({
        id: `osm-${el.type}-${el.id}`,
        name,
        description,
        category,
        lat: elLat,
        lon: elLon,
        estimatedDuration: duration,
        estimatedCost: cost,
        isMustSee: mustSee,
        isFree: free,
        optionalPaidExperience: exp,
        optionalPaidCost: optCost,
        popularityScore: score,
        imageUrl: null,
        address: tags["addr:street"]
          ? `${tags["addr:street"]} ${tags["addr:housenumber"] ?? ""}`.trim()
          : null,
        openingHours: tags.opening_hours ?? null,
      });
    }

    // Sort by popularity descending
    return pois.sort((a, b) => b.popularityScore - a.popularityScore);
  } catch (error) {
    console.error("Overpass API error:", error);
    return [];
  }
}

// ───────────────────────── MOCK DATA ─────────────────────────

export function getMockPois(city: string, lat: number, lon: number): Poi[] {
  const key = city.toLowerCase().trim();

  if (key.includes("paris")) return getParisPois(lat, lon);
  if (key.includes("barcelona")) return getBarcelonaPois(lat, lon);
  if (key.includes("rome") || key.includes("roma")) return getRomePois(lat, lon);
  if (key.includes("london")) return getLondonPois(lat, lon);
  if (key.includes("amsterdam")) return getAmsterdamPois(lat, lon);
  if (key.includes("vienna") || key.includes("wien")) return getViennaPois(lat, lon);
  if (key.includes("prague") || key.includes("praha")) return getPraguePois(lat, lon);
  if (key.includes("berlin")) return getBerlinPois(lat, lon);
  if (key.includes("istanbul")) return getIstanbulPois(lat, lon);
  if (key.includes("lisbon") || key.includes("lisboa")) return getLisbonPois(lat, lon);
  if (key.includes("chisinau") || key.includes("chișinău") || key.includes("kishinev")) return getChisinauPois(lat, lon);
  if (key.includes("budapest")) return getBudapestPois(lat, lon);
  if (key.includes("madrid")) return getMadridPois(lat, lon);
  if (key.includes("athens") || key.includes("athina")) return getAthensPois(lat, lon);
  if (key.includes("tokyo")) return getTokyoPois(lat, lon);
  if (key.includes("kyoto")) return getKyotoPois(lat, lon);
  if (key.includes("bucharest") || key.includes("bucurești")) return getBucharestPois(lat, lon);

  return getGenericPois(city, lat, lon);
}

type PoiTemplate = {
  name: string; desc: string; cat: string; free: boolean; must: boolean;
  score: number; dur: number; cost: number;
  dlat: number; dlon: number;
  optExp?: string; optCost?: number;
};

function buildPoi(id: string, t: PoiTemplate, baseLat: number, baseLon: number): Poi {
  return {
    id,
    name: t.name,
    description: t.desc,
    category: t.cat,
    lat: baseLat + t.dlat,
    lon: baseLon + t.dlon,
    estimatedDuration: t.dur,
    estimatedCost: t.cost,
    isMustSee: t.must,
    isFree: t.free,
    optionalPaidExperience: t.optExp ?? null,
    optionalPaidCost: t.optCost ?? null,
    popularityScore: t.score,
    imageUrl: null,
    address: null,
    openingHours: null,
  };
}

function getParisPois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Eiffel Tower", desc: "The iconic iron lattice tower on the Champ de Mars, symbol of Paris and France.", cat: "landmark", free: true, must: true, score: 100, dur: 60, cost: 0, dlat: 0.002, dlon: -0.012, optExp: "Ascend to the summit", optCost: 26 },
    { name: "The Louvre Museum", desc: "The world's largest art museum, home to the Mona Lisa and Venus de Milo.", cat: "museum", free: false, must: true, score: 98, dur: 120, cost: 17, dlat: 0.008, dlon: 0.006 },
    { name: "Notre-Dame Cathedral", desc: "Medieval Gothic cathedral on the Île de la Cité, a masterpiece of French Gothic architecture.", cat: "architecture", free: true, must: true, score: 95, dur: 60, cost: 0, dlat: 0.004, dlon: 0.010 },
    { name: "Sacré-Cœur & Montmartre", desc: "The stunning white Sacré-Cœur Basilica crowns the bohemian hilltop of Montmartre.", cat: "viewpoint", free: true, must: true, score: 93, dur: 90, cost: 0, dlat: 0.025, dlon: 0.003 },
    { name: "Musée d'Orsay", desc: "Impressionist masterpieces by Monet, Renoir and Van Gogh in a magnificent railway station.", cat: "museum", free: false, must: true, score: 91, dur: 90, cost: 16, dlat: 0.001, dlon: -0.002 },
    { name: "Arc de Triomphe", desc: "Triumphal arch at the centre of Place Charles de Gaulle with sweeping boulevard views.", cat: "history", free: true, must: true, score: 90, dur: 45, cost: 0, dlat: 0.007, dlon: -0.020, optExp: "Rooftop panoramic terrace", optCost: 13 },
    { name: "Champs-Élysées", desc: "The world's most famous boulevard, lined with theatres, cafés and luxury boutiques.", cat: "photography", free: true, must: true, score: 89, dur: 60, cost: 0, dlat: 0.004, dlon: -0.016 },
    { name: "Centre Pompidou", desc: "Radical high-tech architecture housing Europe's largest museum of modern and contemporary art.", cat: "culture", free: false, must: false, score: 85, dur: 90, cost: 15, dlat: 0.009, dlon: 0.012 },
    { name: "Le Marais District", desc: "Historic neighbourhood filled with medieval lanes, trendy boutiques, galleries and the Place des Vosges.", cat: "history", free: true, must: false, score: 83, dur: 90, cost: 0, dlat: 0.006, dlon: 0.015 },
    { name: "Luxembourg Gardens", desc: "Elegant 17th-century French formal gardens at the heart of the Left Bank.", cat: "nature", free: true, must: false, score: 78, dur: 60, cost: 0, dlat: -0.005, dlon: 0.008 },
    { name: "Sainte-Chapelle", desc: "Royal Gothic chapel celebrated for its breathtaking 13th-century stained glass windows.", cat: "architecture", free: false, must: false, score: 80, dur: 45, cost: 11, dlat: 0.003, dlon: 0.009 },
    { name: "Palais Royal Gardens", desc: "Serene arcaded garden surrounding the Palais Royal, favourite of Parisians for a quiet stroll.", cat: "nature", free: true, must: false, score: 72, dur: 45, cost: 0, dlat: 0.008, dlon: 0.004 },
    { name: "Seine River Walk", desc: "Stroll the UNESCO-listed banks of the Seine past bridges, bookstalls and bistros.", cat: "relaxation", free: true, must: false, score: 75, dur: 60, cost: 0, dlat: 0.001, dlon: 0.004, optExp: "Bateaux Mouches river cruise", optCost: 15 },
    { name: "Musée de l'Orangerie", desc: "Monet's monumental Water Lilies series fills two oval rooms in this intimate museum.", cat: "museum", free: false, must: false, score: 76, dur: 75, cost: 12, dlat: 0.003, dlon: -0.003 },
    { name: "Père Lachaise Cemetery", desc: "Famous historic cemetery, the final resting place of Chopin, Proust, Piaf and Jim Morrison.", cat: "history", free: true, must: false, score: 70, dur: 60, cost: 0, dlat: 0.012, dlon: 0.022 },
  ];
  return templates.map((t, i) => buildPoi(`paris-${i + 1}`, t, lat, lon));
}

function getBarcelonaPois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Sagrada Família", desc: "Gaudí's unfinished masterpiece — an extraordinary and still-growing basilica started in 1882.", cat: "architecture", free: false, must: true, score: 100, dur: 90, cost: 26, dlat: 0.015, dlon: 0.010 },
    { name: "Park Güell", desc: "Gaudí's mosaic-tiled fantasy park with ceramic benches and panoramic views over Barcelona.", cat: "nature", free: false, must: true, score: 95, dur: 75, cost: 10, dlat: 0.022, dlon: 0.003 },
    { name: "Las Ramblas", desc: "Iconic tree-lined pedestrian boulevard, the social heart of Barcelona since the 18th century.", cat: "gastronomy", free: true, must: true, score: 90, dur: 60, cost: 0, dlat: -0.003, dlon: -0.006 },
    { name: "Gothic Quarter (Barri Gòtic)", desc: "Medieval warren of Roman ruins, Gothic churches, tapas bars and hidden courtyards.", cat: "history", free: true, must: true, score: 88, dur: 90, cost: 0, dlat: -0.002, dlon: -0.003 },
    { name: "Casa Batlló", desc: "Gaudí's dragon-inspired masterpiece on the Passeig de Gràcia — a UNESCO World Heritage Site.", cat: "architecture", free: false, must: true, score: 93, dur: 75, cost: 35, dlat: 0.006, dlon: -0.001 },
    { name: "Casa Milà – La Pedrera", desc: "Gaudí's undulating stone apartment building with its iconic iron balconies and rooftop warriors.", cat: "architecture", free: false, must: true, score: 89, dur: 60, cost: 25, dlat: 0.008, dlon: -0.002 },
    { name: "Barceloneta Beach", desc: "Popular urban beach with golden sand, beach bars and a vibrant Mediterranean atmosphere.", cat: "relaxation", free: true, must: false, score: 82, dur: 90, cost: 0, dlat: -0.010, dlon: 0.015 },
    { name: "Picasso Museum", desc: "Extensive early-career Picasso collection set in connected medieval palaces in El Born.", cat: "museum", free: false, must: false, score: 80, dur: 90, cost: 14, dlat: 0.000, dlon: 0.005 },
    { name: "Tibidabo Viewpoint", desc: "Stunning 360° panorama over all of Barcelona from the Collserola mountain ridge.", cat: "viewpoint", free: true, must: false, score: 77, dur: 60, cost: 0, dlat: 0.030, dlon: -0.015, optExp: "Tibidabo Amusement Park", optCost: 30 },
    { name: "Boqueria Market", desc: "Vibrant covered market on Las Ramblas overflowing with fresh produce, seafood and local delicacies.", cat: "gastronomy", free: true, must: false, score: 84, dur: 60, cost: 0, dlat: -0.001, dlon: -0.005 },
    { name: "Palau de la Música Catalana", desc: "UNESCO-listed modernista concert hall — an explosion of mosaics, stained glass and sculpted columns.", cat: "architecture", free: false, must: false, score: 85, dur: 45, cost: 18, dlat: 0.003, dlon: 0.002 },
    { name: "Montjuïc Castle", desc: "18th-century fortress atop Montjuïc hill with breathtaking views over the port and city.", cat: "history", free: false, must: false, score: 74, dur: 75, cost: 5, dlat: -0.012, dlon: -0.012 },
  ];
  return templates.map((t, i) => buildPoi(`bcn-${i + 1}`, t, lat, lon));
}

function getRomePois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Colosseum", desc: "The greatest amphitheatre of the ancient world, built in 70-80 AD — Rome's most iconic monument.", cat: "history", free: false, must: true, score: 100, dur: 90, cost: 16, dlat: 0.003, dlon: 0.008 },
    { name: "Vatican Museums & Sistine Chapel", desc: "Michelangelo's breathtaking ceiling frescoes and one of the world's greatest art collections.", cat: "museum", free: false, must: true, score: 99, dur: 150, cost: 20, dlat: 0.010, dlon: -0.020 },
    { name: "Trevi Fountain", desc: "The world's most celebrated fountain — throw a coin to ensure your return to Rome.", cat: "architecture", free: true, must: true, score: 97, dur: 30, cost: 0, dlat: 0.008, dlon: 0.005 },
    { name: "Roman Forum", desc: "The dramatic ruined heart of ancient Rome — temples, triumphal arches and the Sacred Way.", cat: "history", free: false, must: true, score: 93, dur: 75, cost: 16, dlat: 0.002, dlon: 0.007 },
    { name: "Pantheon", desc: "The best-preserved ancient Roman building — a perfect domed temple, now a church, built in 125 AD.", cat: "architecture", free: false, must: true, score: 95, dur: 45, cost: 5, dlat: 0.007, dlon: 0.002 },
    { name: "St. Peter's Basilica", desc: "The world's largest church, the spiritual heart of Catholicism, with Michelangelo's breathtaking dome.", cat: "architecture", free: true, must: true, score: 96, dur: 90, cost: 0, dlat: 0.011, dlon: -0.022, optExp: "Climb to the dome summit", optCost: 8 },
    { name: "Borghese Gallery", desc: "One of Europe's finest sculpture and painting collections housed in a stunning 17th-century villa.", cat: "culture", free: false, must: false, score: 83, dur: 120, cost: 13, dlat: 0.018, dlon: 0.004 },
    { name: "Trastevere District", desc: "Rome's most charming neighbourhood — cobblestone alleys, ivy-clad walls and authentic Roman trattorias.", cat: "gastronomy", free: true, must: false, score: 85, dur: 90, cost: 0, dlat: 0.000, dlon: -0.012 },
    { name: "Palatine Hill", desc: "The legendary hill where Rome was founded, with sweeping views over the Roman Forum.", cat: "viewpoint", free: false, must: false, score: 78, dur: 60, cost: 16, dlat: 0.001, dlon: 0.009 },
    { name: "Piazza Navona", desc: "Baroque masterpiece lined with fountains, including Bernini's magnificent Fountain of the Four Rivers.", cat: "architecture", free: true, must: false, score: 88, dur: 45, cost: 0, dlat: 0.005, dlon: -0.001 },
    { name: "Campo de' Fiori", desc: "Lively morning market and evening gathering spot in the heart of the historic centre.", cat: "gastronomy", free: true, must: false, score: 72, dur: 60, cost: 0, dlat: 0.003, dlon: 0.000 },
    { name: "Castel Sant'Angelo", desc: "Imposing cylindrical fortress on the Tiber, once a papal refuge, now a museum with panoramic views.", cat: "history", free: false, must: false, score: 82, dur: 75, cost: 15, dlat: 0.008, dlon: -0.018 },
  ];
  return templates.map((t, i) => buildPoi(`rome-${i + 1}`, t, lat, lon));
}

function getLondonPois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Tower of London", desc: "900-year-old fortress housing the Crown Jewels on the north bank of the Thames.", cat: "history", free: false, must: true, score: 98, dur: 120, cost: 30, dlat: 0.003, dlon: 0.018 },
    { name: "British Museum", desc: "The world's greatest treasure house — home to the Rosetta Stone and Elgin Marbles.", cat: "museum", free: true, must: true, score: 97, dur: 120, cost: 0, dlat: 0.010, dlon: -0.005 },
    { name: "Buckingham Palace", desc: "Official London residence of the monarch, with the iconic Changing of the Guard ceremony.", cat: "landmark", free: true, must: true, score: 96, dur: 60, cost: 0, dlat: -0.001, dlon: -0.014 },
    { name: "Westminster Abbey & Big Ben", desc: "UNESCO-listed Gothic abbey where monarchs are crowned, burial place of royalty and poets.", cat: "architecture", free: false, must: true, score: 95, dur: 90, cost: 27, dlat: 0.000, dlon: -0.010 },
    { name: "Tate Modern", desc: "Bankside's converted power station housing the UK's national collection of modern and contemporary art.", cat: "culture", free: true, must: false, score: 87, dur: 90, cost: 0, dlat: 0.002, dlon: 0.006 },
    { name: "National Gallery", desc: "Over 2,300 paintings spanning 700 years — including van Eyck, Botticelli, Turner and Vermeer.", cat: "museum", free: true, must: true, score: 92, dur: 90, cost: 0, dlat: 0.003, dlon: -0.008 },
    { name: "Hyde Park", desc: "350 hectares of open parkland, rowing boats on the Serpentine and the Diana Memorial Fountain.", cat: "nature", free: true, must: false, score: 82, dur: 75, cost: 0, dlat: 0.002, dlon: -0.022 },
    { name: "Shakespeare's Globe Theatre", desc: "Faithful reconstruction of the Elizabethan playhouse that first staged Hamlet and Othello.", cat: "culture", free: false, must: false, score: 80, dur: 75, cost: 20, dlat: 0.002, dlon: 0.005 },
    { name: "Borough Market", desc: "London's oldest and most celebrated food market, a feast of street food and artisan produce.", cat: "gastronomy", free: true, must: false, score: 83, dur: 75, cost: 0, dlat: 0.001, dlon: 0.004 },
    { name: "St Paul's Cathedral", desc: "Wren's magnificent dome dominates the City skyline — a masterpiece of English Baroque.", cat: "architecture", free: false, must: false, score: 85, dur: 60, cost: 20, dlat: 0.004, dlon: 0.006 },
    { name: "Tower Bridge", desc: "London's iconic Victorian bascule bridge over the Thames with a glass walkway and engine rooms.", cat: "landmark", free: true, must: true, score: 90, dur: 45, cost: 0, dlat: 0.002, dlon: 0.019 },
    { name: "Covent Garden", desc: "Lively piazza full of street performers, independent shops, cafés and the Royal Opera House.", cat: "gastronomy", free: true, must: false, score: 78, dur: 75, cost: 0, dlat: 0.006, dlon: -0.005 },
  ];
  return templates.map((t, i) => buildPoi(`london-${i + 1}`, t, lat, lon));
}

function getAmsterdamPois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Anne Frank House", desc: "The secret annex where Anne Frank wrote her diary during the Nazi occupation of the Netherlands.", cat: "history", free: false, must: true, score: 98, dur: 90, cost: 14, dlat: 0.010, dlon: -0.005 },
    { name: "Rijksmuseum", desc: "Dutch national museum housing Rembrandt's Night Watch and Vermeer's Milkmaid.", cat: "museum", free: false, must: true, score: 97, dur: 120, cost: 22, dlat: -0.005, dlon: 0.002 },
    { name: "Van Gogh Museum", desc: "The largest collection of Van Gogh's works in the world, including The Bedroom.", cat: "museum", free: false, must: true, score: 95, dur: 90, cost: 22, dlat: -0.004, dlon: 0.003 },
    { name: "Canal Ring (UNESCO)", desc: "17th-century concentric ring of canals — a UNESCO World Heritage site and Amsterdam's defining feature.", cat: "photography", free: true, must: true, score: 93, dur: 90, cost: 0, dlat: 0.003, dlon: 0.001 },
    { name: "Vondelpark", desc: "Amsterdam's beloved urban park with wide lawns, a rose garden and an open-air theatre.", cat: "nature", free: true, must: false, score: 80, dur: 60, cost: 0, dlat: -0.006, dlon: -0.003 },
    { name: "Stedelijk Museum", desc: "Leading modern and contemporary art museum with works by Mondrian, Malevich and De Kooning.", cat: "culture", free: false, must: false, score: 82, dur: 90, cost: 20, dlat: -0.004, dlon: 0.004 },
    { name: "Jordaan Neighbourhood", desc: "Charming historic district of narrow streets, independent boutiques and cosy brown cafés.", cat: "gastronomy", free: true, must: false, score: 85, dur: 75, cost: 0, dlat: 0.008, dlon: -0.008 },
    { name: "Heineken Experience", desc: "Interactive tour through the former Heineken brewery with tastings and a behind-the-scenes look.", cat: "entertainment", free: false, must: false, score: 72, dur: 90, cost: 21, dlat: -0.007, dlon: 0.006 },
  ];
  return templates.map((t, i) => buildPoi(`amsterdam-${i + 1}`, t, lat, lon));
}

function getViennaPois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Schönbrunn Palace & Gardens", desc: "Habsburg imperial summer palace with 1,441 rooms and Baroque formal gardens — a UNESCO masterpiece.", cat: "history", free: false, must: true, score: 99, dur: 120, cost: 18, dlat: -0.010, dlon: -0.018 },
    { name: "Kunsthistorisches Museum", desc: "One of the world's great art museums with Vermeer, Raphael, Rembrandt and the Habsburg collections.", cat: "museum", free: false, must: true, score: 96, dur: 120, cost: 21, dlat: 0.002, dlon: 0.000 },
    { name: "St. Stephen's Cathedral", desc: "Gothic masterpiece at the heart of Vienna — climb the South Tower for a panoramic cityscape.", cat: "architecture", free: true, must: true, score: 95, dur: 60, cost: 0, dlat: 0.005, dlon: 0.005, optExp: "South Tower panoramic climb", optCost: 6 },
    { name: "Belvedere Palace", desc: "Baroque palace complex housing Klimt's The Kiss — Vienna's most celebrated painting.", cat: "culture", free: false, must: true, score: 93, dur: 90, cost: 16, dlat: 0.012, dlon: 0.006 },
    { name: "Vienna Opera House", desc: "One of the world's leading opera houses, opened in 1869 — a jewel of Neo-Renaissance architecture.", cat: "culture", free: false, must: false, score: 88, dur: 90, cost: 15, dlat: 0.001, dlon: 0.002 },
    { name: "Prater & Riesenrad", desc: "Vienna's beloved public park featuring the iconic 1897 giant Ferris wheel with panoramic gondolas.", cat: "entertainment", free: true, must: false, score: 82, dur: 90, cost: 0, dlat: 0.010, dlon: 0.020, optExp: "Riesenrad gondola ride", optCost: 10 },
    { name: "Naschmarkt", desc: "Vienna's most famous outdoor market — 16th-century origins, stalls of Austrian and global produce.", cat: "gastronomy", free: true, must: false, score: 80, dur: 75, cost: 0, dlat: -0.001, dlon: -0.003 },
  ];
  return templates.map((t, i) => buildPoi(`vienna-${i + 1}`, t, lat, lon));
}

function getPraguePois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Prague Castle", desc: "The largest ancient castle complex in the world, dominating the skyline above the Vltava river.", cat: "history", free: false, must: true, score: 100, dur: 120, cost: 15, dlat: 0.010, dlon: -0.013 },
    { name: "Charles Bridge", desc: "14th-century stone bridge lined with 30 Baroque statues connecting the Old Town to Malá Strana.", cat: "architecture", free: true, must: true, score: 98, dur: 45, cost: 0, dlat: 0.003, dlon: -0.005 },
    { name: "Old Town Square & Astronomical Clock", desc: "Medieval heart of Prague featuring the Gothic Tyn Church and 15th-century Orloj clock.", cat: "landmark", free: true, must: true, score: 97, dur: 60, cost: 0, dlat: 0.004, dlon: 0.003 },
    { name: "Wenceslas Square", desc: "Prague's grand boulevard — the scene of the 1968 and 1989 revolutions, lined with Art Nouveau buildings.", cat: "history", free: true, must: false, score: 85, dur: 45, cost: 0, dlat: 0.002, dlon: 0.005 },
    { name: "Josefov (Jewish Quarter)", desc: "Europe's most complete historic Jewish ghetto with 6 synagogues and the poignant Old Jewish Cemetery.", cat: "history", free: false, must: true, score: 90, dur: 90, cost: 14, dlat: 0.006, dlon: 0.001 },
    { name: "Petřín Hill & Lookout Tower", desc: "Green hilltop park above Malá Strana with a miniature Eiffel Tower and views over the entire city.", cat: "viewpoint", free: true, must: false, score: 82, dur: 60, cost: 0, dlat: 0.001, dlon: -0.015, optExp: "Lookout Tower climb", optCost: 4 },
  ];
  return templates.map((t, i) => buildPoi(`prague-${i + 1}`, t, lat, lon));
}

function getBerlinPois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Brandenburg Gate", desc: "18th-century neoclassical triumphal arch — the enduring symbol of German reunification.", cat: "landmark", free: true, must: true, score: 100, dur: 30, cost: 0, dlat: 0.002, dlon: -0.001 },
    { name: "Holocaust Memorial", desc: "Peter Eisenman's haunting field of 2,711 concrete stelae commemorating murdered Jews of Europe.", cat: "history", free: true, must: true, score: 97, dur: 60, cost: 0, dlat: 0.000, dlon: 0.002 },
    { name: "Museum Island (Museumsinsel)", desc: "UNESCO World Heritage ensemble of 5 world-class museums on an island in the Spree — including the Pergamon.", cat: "museum", free: false, must: true, score: 96, dur: 180, cost: 18, dlat: 0.007, dlon: 0.008 },
    { name: "East Side Gallery", desc: "1.3 km of the Berlin Wall preserved as an open-air gallery with 105 murals by international artists.", cat: "culture", free: true, must: true, score: 92, dur: 60, cost: 0, dlat: 0.002, dlon: 0.018 },
    { name: "Checkpoint Charlie", desc: "Famous Cold War crossing point between East and West Berlin — now with a museum and historic exhibit.", cat: "history", free: true, must: false, score: 85, dur: 45, cost: 0, dlat: -0.002, dlon: 0.006 },
    { name: "Tiergarten Park", desc: "Berlin's central park — 210 hectares of woodland and meadows at the heart of the city.", cat: "nature", free: true, must: false, score: 78, dur: 75, cost: 0, dlat: 0.003, dlon: -0.010 },
    { name: "Berlin Cathedral (Berliner Dom)", desc: "Imposing Neo-Baroque cathedral on Museum Island — climb the dome for panoramic city views.", cat: "architecture", free: false, must: false, score: 82, dur: 60, cost: 7, dlat: 0.007, dlon: 0.006 },
    { name: "Hackescher Markt & Scheunenviertel", desc: "Lively courtyards and streets in Mitte filled with independent boutiques, galleries and restaurants.", cat: "gastronomy", free: true, must: false, score: 76, dur: 75, cost: 0, dlat: 0.006, dlon: 0.005 },
  ];
  return templates.map((t, i) => buildPoi(`berlin-${i + 1}`, t, lat, lon));
}

function getIstanbulPois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Hagia Sophia", desc: "Former Byzantine cathedral turned Ottoman mosque turned museum — 1,500 years of living history.", cat: "architecture", free: true, must: true, score: 100, dur: 90, cost: 0, dlat: 0.000, dlon: 0.001 },
    { name: "Blue Mosque (Sultan Ahmed)", desc: "Six-minareted Ottoman mosque decorated with 20,000 handmade Iznik tiles in brilliant blue.", cat: "architecture", free: true, must: true, score: 98, dur: 60, cost: 0, dlat: -0.001, dlon: 0.001 },
    { name: "Topkapi Palace", desc: "Ottoman imperial palace housing priceless treasures — the Topkapi dagger, Spoonmaker's Diamond and holy relics.", cat: "history", free: false, must: true, score: 97, dur: 120, cost: 12, dlat: 0.002, dlon: 0.003 },
    { name: "Grand Bazaar (Kapalıçarşı)", desc: "One of the world's oldest and largest covered markets — over 4,000 shops in 61 covered streets.", cat: "gastronomy", free: true, must: true, score: 90, dur: 90, cost: 0, dlat: -0.002, dlon: -0.003 },
    { name: "Spice Bazaar (Mısır Çarşısı)", desc: "Vibrant 17th-century covered bazaar filled with the aromas of spices, dried fruits and Turkish delights.", cat: "gastronomy", free: true, must: false, score: 87, dur: 60, cost: 0, dlat: -0.001, dlon: -0.001 },
    { name: "Galata Tower", desc: "Medieval stone tower with a breathtaking 360° panorama over the Bosphorus and Istanbul's skylines.", cat: "viewpoint", free: false, must: false, score: 88, dur: 60, cost: 12, dlat: 0.008, dlon: -0.005 },
    { name: "Bosphorus Cruise", desc: "A cruise along the Bosphorus strait past Ottoman yalı mansions, fortresses and two continents.", cat: "relaxation", free: false, must: false, score: 85, dur: 120, cost: 15, dlat: 0.005, dlon: 0.010 },
    { name: "Chora Church (Kariye Camii)", desc: "Byzantine church with stunning 14th-century mosaics and frescoes — one of Istanbul's hidden gems.", cat: "architecture", free: false, must: false, score: 78, dur: 60, cost: 5, dlat: 0.012, dlon: -0.015 },
  ];
  return templates.map((t, i) => buildPoi(`istanbul-${i + 1}`, t, lat, lon));
}

function getLisbonPois(lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: "Jerónimos Monastery", desc: "Portugal's greatest monument — a UNESCO-listed Manueline masterpiece built to celebrate Vasco da Gama.", cat: "architecture", free: false, must: true, score: 99, dur: 90, cost: 10, dlat: -0.008, dlon: -0.018 },
    { name: "Belém Tower", desc: "UNESCO-listed 16th-century fortified tower, once the gateway to Lisbon's Age of Discovery.", cat: "history", free: false, must: true, score: 97, dur: 60, cost: 6, dlat: -0.009, dlon: -0.022 },
    { name: "Alfama District & São Jorge Castle", desc: "Lisbon's oldest neighbourhood of Moorish lanes, miradouros and the medieval hilltop castle.", cat: "history", free: false, must: true, score: 95, dur: 90, cost: 10, dlat: 0.005, dlon: 0.007 },
    { name: "Tram 28 Route", desc: "Lisbon's iconic yellow tram winds through Alfama, Graça and Mouraria — a moving city tour.", cat: "photography", free: false, must: false, score: 88, dur: 45, cost: 3, dlat: 0.003, dlon: 0.002 },
    { name: "LX Factory", desc: "Former industrial complex turned creative village with restaurants, bookshops and vintage markets.", cat: "culture", free: true, must: false, score: 80, dur: 75, cost: 0, dlat: -0.005, dlon: -0.012 },
    { name: "Pastéis de Belém", desc: "The birthplace of the famous pastel de nata since 1837 — a Lisbon pilgrimage for any food lover.", cat: "gastronomy", free: false, must: false, score: 83, dur: 30, cost: 5, dlat: -0.008, dlon: -0.019 },
    { name: "Sintra National Palace", desc: "Fairy-tale UNESCO-listed town in the hills with extravagant 19th-century palaces and lush gardens.", cat: "history", free: false, must: false, score: 92, dur: 180, cost: 15, dlat: 0.025, dlon: -0.042 },
  ];
  return templates.map((t, i) => buildPoi(`lisbon-${i + 1}`, t, lat, lon));
}

function getGenericPois(city: string, lat: number, lon: number): Poi[] {
  const templates: PoiTemplate[] = [
    { name: `${city} Old Town`, desc: `The historic old town of ${city}, where centuries of architecture and culture meet.`, cat: "history", free: true, must: true, score: 88, dur: 90, cost: 0, dlat: 0.005, dlon: 0.003 },
    { name: `${city} Main Cathedral`, desc: `The magnificent central cathedral of ${city} — a showcase of the city's religious and artistic heritage.`, cat: "architecture", free: true, must: true, score: 85, dur: 45, cost: 0, dlat: -0.003, dlon: 0.007 },
    { name: `${city} City Viewpoint`, desc: `Panoramic hilltop viewpoint offering breathtaking vistas across the entire cityscape of ${city}.`, cat: "viewpoint", free: true, must: true, score: 86, dur: 30, cost: 0, dlat: 0.012, dlon: -0.006 },
    { name: `${city} History Museum`, desc: `The main historical museum of ${city}, tracing the city's fascinating story from ancient times to the present.`, cat: "museum", free: false, must: false, score: 75, dur: 90, cost: 12, dlat: 0.008, dlon: -0.004 },
    { name: `${city} Central Park`, desc: `A vast public park at the heart of ${city}, beloved by locals for picnics, walks and relaxation.`, cat: "nature", free: true, must: false, score: 72, dur: 60, cost: 0, dlat: -0.006, dlon: -0.002 },
    { name: `${city} Central Market`, desc: `The bustling central market of ${city} — a sensory feast of local produce, street food and crafts.`, cat: "gastronomy", free: true, must: false, score: 70, dur: 60, cost: 0, dlat: -0.001, dlon: 0.009 },
    { name: `${city} Art Gallery`, desc: `The city's premier contemporary art gallery, showcasing works by local and international artists.`, cat: "culture", free: false, must: false, score: 68, dur: 75, cost: 10, dlat: 0.004, dlon: 0.012 },
    { name: `${city} Botanical Garden`, desc: `Serene botanical gardens filled with exotic plants and indigenous flora from across the world.`, cat: "nature", free: true, must: false, score: 65, dur: 60, cost: 0, dlat: -0.009, dlon: 0.005 },
    { name: `${city} Waterfront Promenade`, desc: `A scenic waterfront promenade perfect for an evening stroll with views of the harbour and skyline.`, cat: "relaxation", free: true, must: false, score: 73, dur: 60, cost: 0, dlat: -0.012, dlon: 0.008 },
    { name: `${city} Castle`, desc: `A medieval fortress that once protected ${city} — now offering fascinating exhibits and panoramic views.`, cat: "history", free: false, must: false, score: 80, dur: 75, cost: 8, dlat: 0.015, dlon: -0.010 },
  ];
  return templates.map((t, i) => buildPoi(`${city.toLowerCase()}-${i + 1}`, t, lat, lon));
}
