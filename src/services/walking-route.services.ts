
import type { GeoPoint } from "../utils/geo.js";
import { distanceBetweenPoints } from "../utils/geo.js";

export type WalkingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  path: GeoPoint[];
};

type OsrmResponse = {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
  }>;
};

const WALKING_API_URL =
  process.env.WALKING_API_URL ??
  "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

const AVERAGE_WALKING_SPEED_METERS_PER_SEC = 1.25; // ~4.5 km/h

export function calculateFallbackWalkingRoute(
  origin: GeoPoint,
  destination: GeoPoint,
): WalkingRoute {
  const distance = distanceBetweenPoints(origin, destination);
  const duration = Math.max(30, Math.round(distance / AVERAGE_WALKING_SPEED_METERS_PER_SEC));

  return {
    distanceMeters: Math.round(distance),
    durationSeconds: duration,
    path: [
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ],
  };
}

const walkingRouteCache = new Map<string, WalkingRoute>();

function getWalkingRouteCacheKey(
  origin: GeoPoint,
  destination: GeoPoint,
): string {
  const pointKey = (point: GeoPoint) =>
    `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;

  return `${pointKey(origin)}>${pointKey(destination)}`;
}

export async function getWalkingRoute(
  origin: GeoPoint,
  destination: GeoPoint,
): Promise<WalkingRoute> {
  const cacheKey = getWalkingRouteCacheKey(origin, destination);
  const cachedRoute = walkingRouteCache.get(cacheKey);

  if (cachedRoute) {
    return cachedRoute;
  }

  const coordinates = [
    `${origin.longitude},${origin.latitude}`,
    `${destination.longitude},${destination.latitude}`,
  ].join(";");

  const url =
    `${WALKING_API_URL}/${coordinates}` +
    "?overview=full&geometries=geojson";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "rio-onibus-tracker/1.0",
      },
      signal: AbortSignal.timeout(3500),
    });

    if (!response.ok) {
      console.warn(
        `[WalkingRoute] OSRM retornou status HTTP ${response.status}. Usando rota estimada.`,
      );
      const fallback = calculateFallbackWalkingRoute(origin, destination);
      walkingRouteCache.set(cacheKey, fallback);
      return fallback;
    }

    const data = (await response.json()) as OsrmResponse;

    if (data.code !== "Ok" || !data.routes?.[0]) {
      console.warn(
        `[WalkingRoute] OSRM sem rota válida (${data.message}). Usando rota estimada.`,
      );
      const fallback = calculateFallbackWalkingRoute(origin, destination);
      walkingRouteCache.set(cacheKey, fallback);
      return fallback;
    }

    const route = data.routes[0];
    const walkingResult: WalkingRoute = {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      path: route.geometry.coordinates.map(
        ([longitude, latitude]) => ({
          latitude,
          longitude,
        }),
      ),
    };

    walkingRouteCache.set(cacheKey, walkingResult);
    return walkingResult;
  } catch (error) {
    console.warn(
      `[WalkingRoute] Falha ao consultar OSRM (${error instanceof Error ? error.message : error}). Usando rota estimada.`,
    );
    const fallback = calculateFallbackWalkingRoute(origin, destination);
    walkingRouteCache.set(cacheKey, fallback);
    return fallback;
  }
}