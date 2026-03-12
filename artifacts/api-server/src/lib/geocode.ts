import axios from "axios";

export interface GeocodedLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
  displayName: string;
}

/** Extract country name from Nominatim display_name string (last meaningful part) */
function extractCountryFromDisplayName(displayName: string): string {
  const parts = displayName.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || "";
}

export async function geocodeCity(
  city: string,
  country?: string
): Promise<GeocodedLocation | null> {
  const query = country ? `${city}, ${country}` : city;

  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: query,
          format: "json",
          limit: 1,
          addressdetails: 1,
          "accept-language": "en",
        },
        headers: {
          "User-Agent": "TravelMate/1.0 (bachelor-thesis@example.com)",
        },
        timeout: 8000,
      }
    );

    if (!response.data || response.data.length === 0) return null;

    const result = response.data[0];
    const address = result.address || {};
    const displayName: string = result.display_name || "";

    // Resolve city name: prefer English city/town/village from address
    const resolvedCity =
      address.city ||
      address.town ||
      address.municipality ||
      address.village ||
      address.county ||
      city;

    // Resolve country: address first, then from display_name last segment
    const resolvedCountry =
      address.country ||
      country ||
      extractCountryFromDisplayName(displayName) ||
      "";

    return {
      city: resolvedCity,
      country: resolvedCountry,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export function getMockGeocode(city: string): GeocodedLocation {
  const mockCities: Record<string, GeocodedLocation> = {
    paris:      { city: "Paris",      country: "France",         lat: 48.8566,  lon: 2.3522,   displayName: "Paris, Île-de-France, France" },
    barcelona:  { city: "Barcelona",  country: "Spain",          lat: 41.3851,  lon: 2.1734,   displayName: "Barcelona, Catalonia, Spain" },
    rome:       { city: "Rome",       country: "Italy",          lat: 41.9028,  lon: 12.4964,  displayName: "Rome, Lazio, Italy" },
    london:     { city: "London",     country: "United Kingdom", lat: 51.5074,  lon: -0.1278,  displayName: "London, Greater London, England" },
    amsterdam:  { city: "Amsterdam",  country: "Netherlands",    lat: 52.3676,  lon: 4.9041,   displayName: "Amsterdam, North Holland, Netherlands" },
    prague:     { city: "Prague",     country: "Czech Republic", lat: 50.0755,  lon: 14.4378,  displayName: "Prague, Bohemia, Czech Republic" },
    vienna:     { city: "Vienna",     country: "Austria",        lat: 48.2082,  lon: 16.3738,  displayName: "Vienna, Austria" },
    lisbon:     { city: "Lisbon",     country: "Portugal",       lat: 38.7169,  lon: -9.1399,  displayName: "Lisbon, Portugal" },
    berlin:     { city: "Berlin",     country: "Germany",        lat: 52.5200,  lon: 13.4050,  displayName: "Berlin, Germany" },
    istanbul:   { city: "Istanbul",   country: "Turkey",         lat: 41.0082,  lon: 28.9784,  displayName: "Istanbul, Turkey" },
    chisinau:   { city: "Chișinău",   country: "Moldova",        lat: 47.0105,  lon: 28.8638,  displayName: "Chișinău, Moldova" },
    budapest:   { city: "Budapest",   country: "Hungary",        lat: 47.4979,  lon: 19.0402,  displayName: "Budapest, Hungary" },
    madrid:     { city: "Madrid",     country: "Spain",          lat: 40.4168,  lon: -3.7038,  displayName: "Madrid, Spain" },
    athens:     { city: "Athens",     country: "Greece",         lat: 37.9838,  lon: 23.7275,  displayName: "Athens, Attica, Greece" },
    tokyo:      { city: "Tokyo",      country: "Japan",          lat: 35.6762,  lon: 139.6503, displayName: "Tokyo, Japan" },
    kyoto:      { city: "Kyoto",      country: "Japan",          lat: 35.0116,  lon: 135.7681, displayName: "Kyoto, Japan" },
    "new york": { city: "New York",   country: "United States",  lat: 40.7128,  lon: -74.0060, displayName: "New York City, New York, United States" },
    dubai:      { city: "Dubai",      country: "UAE",            lat: 25.2048,  lon: 55.2708,  displayName: "Dubai, United Arab Emirates" },
    singapore:  { city: "Singapore",  country: "Singapore",      lat: 1.3521,   lon: 103.8198, displayName: "Singapore" },
    bangkok:    { city: "Bangkok",    country: "Thailand",       lat: 13.7563,  lon: 100.5018, displayName: "Bangkok, Thailand" },
    bucharest:  { city: "Bucharest",  country: "Romania",        lat: 44.4268,  lon: 26.1025,  displayName: "Bucharest, Romania" },
    sofia:      { city: "Sofia",      country: "Bulgaria",       lat: 42.6977,  lon: 23.3219,  displayName: "Sofia, Bulgaria" },
    warsaw:     { city: "Warsaw",     country: "Poland",         lat: 52.2297,  lon: 21.0122,  displayName: "Warsaw, Poland" },
    krakow:     { city: "Kraków",     country: "Poland",         lat: 50.0647,  lon: 19.9450,  displayName: "Kraków, Poland" },
    tallinn:    { city: "Tallinn",    country: "Estonia",        lat: 59.4370,  lon: 24.7536,  displayName: "Tallinn, Estonia" },
    riga:       { city: "Riga",       country: "Latvia",         lat: 56.9496,  lon: 24.1052,  displayName: "Riga, Latvia" },
    vilnius:    { city: "Vilnius",    country: "Lithuania",      lat: 54.6872,  lon: 25.2797,  displayName: "Vilnius, Lithuania" },
  };

  const key = city.toLowerCase().trim();
  // Try exact match first, then partial match
  if (mockCities[key]) return mockCities[key];
  for (const [k, v] of Object.entries(mockCities)) {
    if (key.includes(k) || k.includes(key)) return v;
  }

  // Fallback: use city name + try to infer country from search (no "Unknown")
  return {
    city,
    country: "",
    lat: 48.8566 + (Math.random() - 0.5) * 10,
    lon: 2.3522 + (Math.random() - 0.5) * 10,
    displayName: city,
  };
}
