# Run TravelMate locally

## Backend

PORT=3001 pnpm --filter @workspace/api-server dev

## Frontend

PORT=5173 BASE_PATH=/ pnpm --filter @workspace/travelmate dev

## Open

http://localhost:5173