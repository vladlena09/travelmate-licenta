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
  if (
    tags.tourism === "museum" ||
    tags.amenity === "museum" ||
    tags.museum
  )
    return "museum";
  if (tags.tourism === "viewpoint" || tags.natural === "peak") return "viewpoint";
  if (
    tags.historic === "castle" ||
    tags.historic === "fort" ||
    tags.historic === "ruins" ||
    tags.historic === "monument" ||
    tags.historic === "memorial" ||
    tags.historic
  )
    return "history";
  if (
    tags.tourism === "artwork" ||
    tags.tourism === "gallery" ||
    tags.amenity === "arts_centre" ||
    tags.amenity === "theatre" ||
    tags.amenity === "cinema"
  )
    return "culture";
  if (
    tags.leisure === "park" ||
    tags.leisure === "garden" ||
    tags.natural === "wood" ||
    tags.landuse === "forest"
  )
    return "nature";
  if (
    tags.amenity === "restaurant" ||
    tags.amenity === "cafe" ||
    tags.amenity === "bar" ||
    tags.shop === "bakery" ||
    tags.amenity === "fast_food"
  )
    return "gastronomy";
  if (
    tags.amenity === "nightclub" ||
    tags.amenity === "pub" ||
    tags.amenity === "bar"
  )
    return "nightlife";
  if (
    tags["building:use"] === "church" ||
    tags.amenity === "place_of_worship" ||
    tags.religion
  )
    return "architecture";
  if (
    tags.tourism === "attraction" ||
    tags.tourism === "theme_park" ||
    tags.leisure === "amusement_arcade"
  )
    return "entertainment";
  if (tags.leisure === "sports_centre" || tags.leisure === "stadium")
    return "sports";
  if (tags.tourism === "hotel" || tags.tourism === "hostel")
    return "relaxation";
  if (tags.amenity === "spa" || tags.leisure === "spa") return "relaxation";
  if (tags.tourism === "zoo" || tags.tourism === "aquarium")
    return "entertainment";
  if (tags.tourism === "landmark" || tags.building === "landmark")
    return "landmark";
  return "landmark";
}

function isFreeFromTags(tags: OsmTags, category: string): boolean {
  if (tags.fee === "no" || tags.access === "public") return true;
  if (tags.fee === "yes") return false;
  const paidCategories = ["museum", "entertainment"];
  const freeCategories = ["viewpoint", "nature", "history", "gastronomy"];
  if (freeCategories.includes(category)) return true;
  if (paidCategories.includes(category)) return false;
  return true;
}

function estimateCost(isFree: boolean, category: string): number {
  if (isFree) return 0;
  const costs: Record<string, number> = {
    museum: 15,
    entertainment: 20,
    culture: 10,
    history: 8,
    viewpoint: 5,
    architecture: 5,
    sports: 12,
    relaxation: 20,
    nightlife: 15,
    gastronomy: 25,
    nature: 0,
    landmark: 0,
    photography: 0,
  };
  return costs[category] ?? 10;
}

function estimateDuration(category: string): number {
  const durations: Record<string, number> = {
    museum: 90,
    viewpoint: 30,
    history: 60,
    culture: 60,
    nature: 75,
    gastronomy: 75,
    nightlife: 120,
    architecture: 45,
    entertainment: 90,
    sports: 90,
    relaxation: 60,
    landmark: 45,
    photography: 45,
  };
  return durations[category] ?? 60;
}

function popularityScore(tags: OsmTags, category: string): number {
  let score = 40;
  if (tags.tourism === "attraction") score += 30;
  if (tags.tourism === "museum") score += 25;
  if (tags.tourism === "viewpoint") score += 20;
  if (tags.wikidata) score += 20;
  if (tags.wikipedia) score += 15;
  if (tags["name:en"]) score += 5;
  if (tags.historic) score += 10;
  if (category === "landmark" || category === "history") score += 10;
  return Math.min(score, 100);
}

function isMustSee(tags: OsmTags, score: number): boolean {
  if (score >= 80) return true;
  if (tags.wikidata && tags.tourism === "attraction") return true;
  if (tags.tourism === "viewpoint" && tags.wikidata) return true;
  return false;
}

function getOptionalPaidInfo(
  tags: OsmTags,
  category: string,
  isFree: boolean
): { exp: string | null; cost: number | null } {
  if (!isFree) return { exp: null, cost: null };
  if (category === "viewpoint" && (tags.tower || tags.tourism === "tower")) {
    return { exp: "Climb to the top", cost: 15 };
  }
  if (category === "architecture" && tags.tourism === "attraction") {
    return { exp: "Guided interior tour", cost: 12 };
  }
  if (category === "history" && tags.historic === "castle") {
    return { exp: "Castle interior entry", cost: 10 };
  }
  return { exp: null, cost: null };
}

export async function fetchPoisFromOverpass(
  lat: number,
  lon: number,
  radius: number = 5000
): Promise<Poi[]> {
  const query = `
[out:json][timeout:25];
(
  node["tourism"~"attraction|museum|viewpoint|gallery|artwork|zoo|aquarium|theme_park"](around:${radius},${lat},${lon});
  node["historic"~"castle|monument|memorial|ruins|fort|archaeological_site"](around:${radius},${lat},${lon});
  node["leisure"~"park|garden"](around:${radius},${lat},${lon});
  node["amenity"~"theatre|cinema|arts_centre"](around:${radius},${lat},${lon});
  way["tourism"~"attraction|museum|viewpoint"](around:${radius},${lat},${lon});
  way["historic"~"castle|monument|memorial|ruins"](around:${radius},${lat},${lon});
  way["leisure"~"park|garden"](around:${radius},${lat},${lon});
);
out center 100;
`;

  try {
    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      `data=${encodeURIComponent(query)}`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 20000,
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

    const pois: Poi[] = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"] || "";
      if (!name || name.length < 2) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!elLat || !elLon) continue;

      const category = categoryFromTags(tags);
      const free = isFreeFromTags(tags, category);
      const cost = estimateCost(free, category);
      const duration = estimateDuration(category);
      const score = popularityScore(tags, category);
      const mustSee = isMustSee(tags, score);
      const { exp, cost: optCost } = getOptionalPaidInfo(tags, category, free);

      pois.push({
        id: `osm-${el.type}-${el.id}`,
        name,
        description:
          tags.description ||
          tags["description:en"] ||
          tags["name:en"] ||
          `A ${category} attraction in the city.`,
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
          ? `${tags["addr:street"]} ${tags["addr:housenumber"] || ""}`.trim()
          : null,
        openingHours: tags.opening_hours || null,
      });
    }

    return pois.sort((a, b) => b.popularityScore - a.popularityScore);
  } catch (error) {
    console.error("Overpass API error:", error);
    return [];
  }
}

export function getMockPois(
  city: string,
  lat: number,
  lon: number
): Poi[] {
  const cityLower = city.toLowerCase();

  const mockData: Record<string, Poi[]> = {
    paris: getParisPois(lat, lon),
    barcelona: getBarcelonaPois(lat, lon),
    rome: getRomePois(lat, lon),
  };

  const key = Object.keys(mockData).find((k) => cityLower.includes(k));
  if (key) return mockData[key];

  return getGenericPois(city, lat, lon);
}

function getParisPois(lat: number, lon: number): Poi[] {
  return [
    {
      id: "paris-1",
      name: "Eiffel Tower",
      description:
        "The iconic iron lattice tower on the Champ de Mars, symbol of Paris and France.",
      category: "landmark",
      lat: lat + 0.002,
      lon: lon - 0.012,
      estimatedDuration: 60,
      estimatedCost: 0,
      isMustSee: true,
      isFree: true,
      optionalPaidExperience: "Ascend to the summit",
      optionalPaidCost: 26,
      popularityScore: 100,
      imageUrl: null,
      address: "Champ de Mars, 5 Av. Anatole France",
      openingHours: "09:00-23:45",
    },
    {
      id: "paris-2",
      name: "The Louvre",
      description:
        "The world's largest art museum, home to the Mona Lisa and Venus de Milo.",
      category: "museum",
      lat: lat + 0.008,
      lon: lon + 0.006,
      estimatedDuration: 120,
      estimatedCost: 17,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 98,
      imageUrl: null,
      address: "Rue de Rivoli, 75001 Paris",
      openingHours: "09:00-18:00 (closed Tues)",
    },
    {
      id: "paris-3",
      name: "Notre-Dame Cathedral",
      description:
        "Medieval Gothic cathedral on the Île de la Cité, currently under restoration.",
      category: "architecture",
      lat: lat + 0.004,
      lon: lon + 0.01,
      estimatedDuration: 60,
      estimatedCost: 0,
      isMustSee: true,
      isFree: true,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 95,
      imageUrl: null,
      address: "6 Parvis Notre-Dame, Pl. Jean-Paul II",
      openingHours: "07:45-18:45",
    },
    {
      id: "paris-4",
      name: "Montmartre & Sacré-Cœur",
      description:
        "Bohemian hilltop neighbourhood with the stunning white Sacré-Cœur Basilica.",
      category: "viewpoint",
      lat: lat + 0.025,
      lon: lon + 0.003,
      estimatedDuration: 90,
      estimatedCost: 0,
      isMustSee: true,
      isFree: true,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 93,
      imageUrl: null,
      address: "35 Rue du Chevalier de la Barre",
      openingHours: "06:00-22:30",
    },
    {
      id: "paris-5",
      name: "Musée d'Orsay",
      description:
        "Impressionist and post-impressionist art in a magnificent former railway station.",
      category: "museum",
      lat: lat + 0.001,
      lon: lon - 0.002,
      estimatedDuration: 90,
      estimatedCost: 16,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 90,
      imageUrl: null,
      address: "1 Rue de la Légion d'Honneur",
      openingHours: "09:30-18:00 (closed Mon)",
    },
    {
      id: "paris-6",
      name: "Arc de Triomphe",
      description:
        "Iconic triumphal arch at the centre of Place Charles de Gaulle with panoramic views.",
      category: "history",
      lat: lat + 0.007,
      lon: lon - 0.02,
      estimatedDuration: 45,
      estimatedCost: 0,
      isMustSee: true,
      isFree: true,
      optionalPaidExperience: "Rooftop panoramic terrace",
      optionalPaidCost: 13,
      popularityScore: 92,
      imageUrl: null,
      address: "Place Charles de Gaulle",
      openingHours: "10:00-22:30",
    },
    {
      id: "paris-7",
      name: "Luxembourg Gardens",
      description:
        "Beautiful 17th-century public gardens perfect for a relaxing afternoon stroll.",
      category: "nature",
      lat: lat - 0.005,
      lon: lon + 0.008,
      estimatedDuration: 60,
      estimatedCost: 0,
      isMustSee: false,
      isFree: true,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 78,
      imageUrl: null,
      address: "75006 Paris",
      openingHours: "07:30-21:30",
    },
    {
      id: "paris-8",
      name: "Le Marais District",
      description:
        "Historic neighbourhood with trendy boutiques, galleries, falafel shops and cafés.",
      category: "gastronomy",
      lat: lat + 0.006,
      lon: lon + 0.015,
      estimatedDuration: 90,
      estimatedCost: 20,
      isMustSee: false,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 82,
      imageUrl: null,
      address: "Le Marais, 75004 Paris",
      openingHours: null,
    },
    {
      id: "paris-9",
      name: "Centre Pompidou",
      description:
        "Radical high-tech architecture housing Europe's largest museum of modern art.",
      category: "culture",
      lat: lat + 0.009,
      lon: lon + 0.012,
      estimatedDuration: 90,
      estimatedCost: 15,
      isMustSee: false,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 85,
      imageUrl: null,
      address: "Place Georges-Pompidou",
      openingHours: "11:00-21:00 (closed Tues)",
    },
    {
      id: "paris-10",
      name: "Champs-Élysées",
      description:
        "The world's most famous boulevard lined with theatres, cafés and luxury shops.",
      category: "photography",
      lat: lat + 0.004,
      lon: lon - 0.016,
      estimatedDuration: 60,
      estimatedCost: 0,
      isMustSee: true,
      isFree: true,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 89,
      imageUrl: null,
      address: "Avenue des Champs-Élysées",
      openingHours: null,
    },
    {
      id: "paris-11",
      name: "Sainte-Chapelle",
      description:
        "Gothic royal chapel renowned for its spectacular 13th-century stained glass windows.",
      category: "architecture",
      lat: lat + 0.003,
      lon: lon + 0.009,
      estimatedDuration: 45,
      estimatedCost: 11.5,
      isMustSee: false,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 80,
      imageUrl: null,
      address: "8 Bd du Palais, 75001 Paris",
      openingHours: "09:00-17:00",
    },
    {
      id: "paris-12",
      name: "Seine River Walk",
      description:
        "Stroll along the UNESCO-listed banks of the Seine passing bridges and bookstalls.",
      category: "relaxation",
      lat: lat + 0.001,
      lon: lon + 0.004,
      estimatedDuration: 60,
      estimatedCost: 0,
      isMustSee: false,
      isFree: true,
      optionalPaidExperience: "Bateaux Mouches river cruise",
      optionalPaidCost: 15,
      popularityScore: 75,
      imageUrl: null,
      address: "Quai d'Orsay, 75007 Paris",
      openingHours: null,
    },
  ];
}

function getBarcelonaPois(lat: number, lon: number): Poi[] {
  return [
    {
      id: "bcn-1",
      name: "Sagrada Família",
      description:
        "Gaudí's unfinished masterpiece — an extraordinary and still-growing basilica.",
      category: "architecture",
      lat: lat + 0.015,
      lon: lon + 0.01,
      estimatedDuration: 90,
      estimatedCost: 26,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 100,
      imageUrl: null,
      address: "Carrer de Mallorca, 401",
      openingHours: "09:00-18:00",
    },
    {
      id: "bcn-2",
      name: "Park Güell",
      description:
        "Gaudí's mosaic-tiled fantasy park with panoramic views over Barcelona.",
      category: "nature",
      lat: lat + 0.022,
      lon: lon + 0.003,
      estimatedDuration: 75,
      estimatedCost: 10,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 95,
      imageUrl: null,
      address: "08024 Barcelona",
      openingHours: "08:00-21:30",
    },
    {
      id: "bcn-3",
      name: "Las Ramblas",
      description:
        "Iconic tree-lined boulevard at the heart of Barcelona, buzzing day and night.",
      category: "gastronomy",
      lat: lat - 0.003,
      lon: lon - 0.006,
      estimatedDuration: 60,
      estimatedCost: 0,
      isMustSee: true,
      isFree: true,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 90,
      imageUrl: null,
      address: "La Rambla, Barcelona",
      openingHours: null,
    },
    {
      id: "bcn-4",
      name: "Gothic Quarter",
      description:
        "Medieval warren of lanes hiding Roman ruins, tapas bars and hidden courtyards.",
      category: "history",
      lat: lat - 0.002,
      lon: lon - 0.003,
      estimatedDuration: 90,
      estimatedCost: 0,
      isMustSee: true,
      isFree: true,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 88,
      imageUrl: null,
      address: "Barri Gòtic, Barcelona",
      openingHours: null,
    },
    {
      id: "bcn-5",
      name: "Casa Batlló",
      description:
        "Gaudí's dragon-inspired façade and surreal interior in the Eixample district.",
      category: "architecture",
      lat: lat + 0.006,
      lon: lon - 0.001,
      estimatedDuration: 75,
      estimatedCost: 35,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 93,
      imageUrl: null,
      address: "Passeig de Gràcia, 43",
      openingHours: "09:00-20:00",
    },
    {
      id: "bcn-6",
      name: "Barceloneta Beach",
      description:
        "Popular urban beach with golden sand, beach bars and a vibrant summer atmosphere.",
      category: "relaxation",
      lat: lat - 0.01,
      lon: lon + 0.015,
      estimatedDuration: 90,
      estimatedCost: 0,
      isMustSee: false,
      isFree: true,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 82,
      imageUrl: null,
      address: "Barceloneta Beach",
      openingHours: null,
    },
    {
      id: "bcn-7",
      name: "Picasso Museum",
      description:
        "Extensive collection of early works by Pablo Picasso set in medieval palaces.",
      category: "museum",
      lat: lat + 0.0,
      lon: lon + 0.005,
      estimatedDuration: 90,
      estimatedCost: 14,
      isMustSee: false,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 80,
      imageUrl: null,
      address: "Carrer Montcada, 15-23",
      openingHours: "10:00-19:00 (closed Mon)",
    },
    {
      id: "bcn-8",
      name: "Tibidabo Viewpoint",
      description:
        "Spectacular panoramic views over all of Barcelona from the Collserola mountain.",
      category: "viewpoint",
      lat: lat + 0.03,
      lon: lon - 0.015,
      estimatedDuration: 60,
      estimatedCost: 0,
      isMustSee: false,
      isFree: true,
      optionalPaidExperience: "Tibidabo Amusement Park",
      optionalPaidCost: 30,
      popularityScore: 77,
      imageUrl: null,
      address: "Tibidabo Hill, Barcelona",
      openingHours: "11:00-19:00",
    },
  ];
}

function getRomePois(lat: number, lon: number): Poi[] {
  return [
    {
      id: "rome-1",
      name: "Colosseum",
      description:
        "The greatest amphitheatre of the ancient world, built in 70-80 AD.",
      category: "history",
      lat: lat + 0.003,
      lon: lon + 0.008,
      estimatedDuration: 90,
      estimatedCost: 16,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 100,
      imageUrl: null,
      address: "Piazza del Colosseo, 1",
      openingHours: "09:00-19:00",
    },
    {
      id: "rome-2",
      name: "Vatican Museums & Sistine Chapel",
      description:
        "Michelangelo's breathtaking ceiling and one of the world's greatest art collections.",
      category: "museum",
      lat: lat + 0.01,
      lon: lon - 0.02,
      estimatedDuration: 150,
      estimatedCost: 20,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 99,
      imageUrl: null,
      address: "00120 Vatican City",
      openingHours: "09:00-18:00 (closed Sun)",
    },
    {
      id: "rome-3",
      name: "Trevi Fountain",
      description:
        "The world's most famous fountain — throw a coin to ensure your return to Rome.",
      category: "architecture",
      lat: lat + 0.008,
      lon: lon + 0.005,
      estimatedDuration: 30,
      estimatedCost: 0,
      isMustSee: true,
      isFree: true,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 97,
      imageUrl: null,
      address: "Piazza di Trevi",
      openingHours: null,
    },
    {
      id: "rome-4",
      name: "Roman Forum",
      description:
        "The ancient heart of Rome — a dramatic ruin-scape of temples and basilicas.",
      category: "history",
      lat: lat + 0.002,
      lon: lon + 0.007,
      estimatedDuration: 75,
      estimatedCost: 16,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 93,
      imageUrl: null,
      address: "Via Sacra",
      openingHours: "09:00-19:00",
    },
    {
      id: "rome-5",
      name: "Pantheon",
      description:
        "The best-preserved ancient Roman temple, now a church, with a perfect domed ceiling.",
      category: "architecture",
      lat: lat + 0.007,
      lon: lon + 0.002,
      estimatedDuration: 45,
      estimatedCost: 5,
      isMustSee: true,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 95,
      imageUrl: null,
      address: "Piazza della Rotonda",
      openingHours: "09:00-18:00",
    },
    {
      id: "rome-6",
      name: "Borghese Gallery",
      description:
        "One of Europe's finest art collections in a stunning villa amid lush gardens.",
      category: "culture",
      lat: lat + 0.018,
      lon: lon + 0.004,
      estimatedDuration: 120,
      estimatedCost: 13,
      isMustSee: false,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 83,
      imageUrl: null,
      address: "Piazzale Scipione Borghese, 5",
      openingHours: "09:00-19:00 (closed Mon)",
    },
    {
      id: "rome-7",
      name: "Trastevere District",
      description:
        "Rome's most charming neighbourhood — cobblestone streets, trattorias and nightlife.",
      category: "gastronomy",
      lat: lat + 0.0,
      lon: lon - 0.012,
      estimatedDuration: 90,
      estimatedCost: 30,
      isMustSee: false,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 85,
      imageUrl: null,
      address: "Trastevere, Rome",
      openingHours: null,
    },
    {
      id: "rome-8",
      name: "Palatine Hill",
      description:
        "Legendary hill overlooking the Forum with panoramic views of ancient Rome.",
      category: "viewpoint",
      lat: lat + 0.001,
      lon: lon + 0.009,
      estimatedDuration: 60,
      estimatedCost: 16,
      isMustSee: false,
      isFree: false,
      optionalPaidExperience: null,
      optionalPaidCost: null,
      popularityScore: 78,
      imageUrl: null,
      address: "Via Sacra",
      openingHours: "09:00-19:00",
    },
  ];
}

function getGenericPois(city: string, lat: number, lon: number): Poi[] {
  const offsets = [
    { lat: 0.005, lon: 0.003 },
    { lat: -0.003, lon: 0.007 },
    { lat: 0.008, lon: -0.004 },
    { lat: -0.006, lon: -0.002 },
    { lat: 0.012, lon: 0.008 },
    { lat: 0.002, lon: -0.01 },
    { lat: -0.009, lon: 0.005 },
    { lat: 0.015, lon: -0.006 },
  ];

  const templates = [
    {
      name: `${city} Old Town`,
      desc: `Historic old town district of ${city} with charming architecture.`,
      cat: "history",
      free: true,
      must: true,
      score: 88,
      dur: 90,
      cost: 0,
    },
    {
      name: `${city} Cathedral`,
      desc: `The main cathedral of ${city}, a beautiful example of religious architecture.`,
      cat: "architecture",
      free: true,
      must: true,
      score: 82,
      dur: 45,
      cost: 0,
    },
    {
      name: `${city} Central Park`,
      desc: `A large public park in the heart of the city, perfect for relaxation.`,
      cat: "nature",
      free: true,
      must: false,
      score: 72,
      dur: 60,
      cost: 0,
    },
    {
      name: `${city} History Museum`,
      desc: `The main historical museum of ${city} with fascinating local exhibitions.`,
      cat: "museum",
      free: false,
      must: false,
      score: 75,
      dur: 90,
      cost: 12,
    },
    {
      name: `${city} Main Market`,
      desc: `The bustling central market — a feast for the senses with local food and crafts.`,
      cat: "gastronomy",
      free: false,
      must: false,
      score: 70,
      dur: 60,
      cost: 15,
    },
    {
      name: `${city} Viewpoint`,
      desc: `Panoramic hilltop viewpoint offering stunning vistas over the whole city.`,
      cat: "viewpoint",
      free: true,
      must: true,
      score: 86,
      dur: 30,
      cost: 0,
    },
    {
      name: `${city} Art Gallery`,
      desc: `Contemporary art gallery showcasing works by local and international artists.`,
      cat: "culture",
      free: false,
      must: false,
      score: 68,
      dur: 75,
      cost: 10,
    },
    {
      name: `${city} Botanical Garden`,
      desc: `Peaceful botanical gardens filled with exotic plants from around the world.`,
      cat: "nature",
      free: true,
      must: false,
      score: 65,
      dur: 60,
      cost: 0,
    },
  ];

  return templates.map((t, i) => ({
    id: `${city.toLowerCase()}-${i + 1}`,
    name: t.name,
    description: t.desc,
    category: t.cat,
    lat: lat + offsets[i].lat,
    lon: lon + offsets[i].lon,
    estimatedDuration: t.dur,
    estimatedCost: t.cost,
    isMustSee: t.must,
    isFree: t.free,
    optionalPaidExperience: null,
    optionalPaidCost: null,
    popularityScore: t.score,
    imageUrl: null,
    address: null,
    openingHours: null,
  }));
}
