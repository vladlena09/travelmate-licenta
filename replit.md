# TravelMate Workspace

## Overview

pnpm workspace monorepo using TypeScript. TravelMate is a premium intelligent travel planning web application.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui
- **Routing**: Wouter
- **State management**: Zustand
- **Animations**: Framer Motion
- **Map**: Leaflet + react-leaflet (dark CartoDB tiles)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **HTTP client (backend)**: Axios
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (all backend routes)
│   │   └── src/lib/
│   │       ├── geocode.ts  # Nominatim geocoding + mock fallback
│   │       ├── pois.ts     # Overpass API fetching + mock POI data
│   │       └── itinerary.ts # Itinerary generation algorithm
│   ├── travelmate/         # React+Vite frontend (served at /)
│   │   └── src/
│   │       ├── pages/      # Landing.tsx, Planner.tsx (wizard + itinerary)
│   │       ├── components/ # Map.tsx, PoiCard.tsx + UI components
│   │       └── store/      # use-trip-store.ts (Zustand)
│   └── mockup-sandbox/     # Component prototyping sandbox
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
```

## API Endpoints

All endpoints are under `/api`:

- `GET /api/healthz` — Health check
- `GET /api/geocode?city=&country=` — Geocode a city via Nominatim (with mock fallback)
- `GET /api/pois?lat=&lon=&radius=` — Fetch POIs from Overpass (with mock fallback)
- `POST /api/itinerary/generate` — Generate full day-by-day itinerary

## Itinerary Generation Logic

1. Geocodes the city (Nominatim → mock fallback)
2. Fetches POIs from Overpass API (→ rich mock data per city as fallback)
3. Scores each POI against user preferences (interests, budget, profile, rhythm)
4. Sorts by score, prioritizes must-see attractions
5. Groups nearby attractions together (nearest-neighbor routing per day)
6. Distributes across days based on travel rhythm (relaxed=3/day, balanced=5, dynamic=7)
7. Returns structured itinerary with day themes and cost estimates

## UI Design

Dark violet twilight palette with glassmorphism cards:
- Background: deep dark violet (#0d0a1a range)
- Primary: vivid violet/purple (hsl 265 89% 65%)
- Accent: rose/pink (hsl 330 80% 60%)
- Cards: glass-panel and glass-card utilities with backdrop-blur
- Typography: Playfair Display (display) + Inter (body)
- Map: dark CartoDB tiles for dark mode immersion

## Screens

1. **Landing** — Cinematic hero with AI-generated background
2. **Planner Wizard** — 4-step form (destination → time/budget → style → interests)
3. **Itinerary View** — Day tabs + POI cards + full-height Leaflet map with routes

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- Always typecheck from the root: `pnpm run typecheck`
- Run codegen: `pnpm --filter @workspace/api-spec run codegen`
- Push DB schema: `pnpm --filter @workspace/db run push`
