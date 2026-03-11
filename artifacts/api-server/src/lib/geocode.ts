import axios from "axios";

export interface GeocodedLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
  displayName: string;
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
        },
        headers: {
          "User-Agent": "TravelMate/1.0 (bachelor-thesis@example.com)",
        },
        timeout: 8000,
      }
    );

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const result = response.data[0];
    const address = result.address || {};

    return {
      city:
        address.city ||
        address.town ||
        address.village ||
        address.county ||
        city,
      country: address.country || country || "",
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export function getMockGeocode(city: string): GeocodedLocation {
  const mockCities: Record<string, GeocodedLocation> = {
    paris: {
      city: "Paris",
      country: "France",
      lat: 48.8566,
      lon: 2.3522,
      displayName: "Paris, Île-de-France, France",
    },
    barcelona: {
      city: "Barcelona",
      country: "Spain",
      lat: 41.3851,
      lon: 2.1734,
      displayName: "Barcelona, Catalonia, Spain",
    },
    rome: {
      city: "Rome",
      country: "Italy",
      lat: 41.9028,
      lon: 12.4964,
      displayName: "Rome, Lazio, Italy",
    },
    london: {
      city: "London",
      country: "United Kingdom",
      lat: 51.5074,
      lon: -0.1278,
      displayName: "London, Greater London, England, United Kingdom",
    },
    amsterdam: {
      city: "Amsterdam",
      country: "Netherlands",
      lat: 52.3676,
      lon: 4.9041,
      displayName: "Amsterdam, North Holland, Netherlands",
    },
    prague: {
      city: "Prague",
      country: "Czech Republic",
      lat: 50.0755,
      lon: 14.4378,
      displayName: "Prague, Bohemia, Czech Republic",
    },
    vienna: {
      city: "Vienna",
      country: "Austria",
      lat: 48.2082,
      lon: 16.3738,
      displayName: "Vienna, Austria",
    },
    lisbon: {
      city: "Lisbon",
      country: "Portugal",
      lat: 38.7169,
      lon: -9.1399,
      displayName: "Lisbon, Portugal",
    },
    berlin: {
      city: "Berlin",
      country: "Germany",
      lat: 52.52,
      lon: 13.405,
      displayName: "Berlin, Germany",
    },
    istanbul: {
      city: "Istanbul",
      country: "Turkey",
      lat: 41.0082,
      lon: 28.9784,
      displayName: "Istanbul, Turkey",
    },
  };

  const key = city.toLowerCase().trim();
  return (
    mockCities[key] || {
      city,
      country: "Unknown",
      lat: 48.8566 + (Math.random() - 0.5) * 10,
      lon: 2.3522 + (Math.random() - 0.5) * 10,
      displayName: city,
    }
  );
}
