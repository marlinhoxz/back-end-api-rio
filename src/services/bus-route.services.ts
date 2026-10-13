import type { Bus } from "../types/bus.js";
import { getRouteDirectionsByRouteId } from "./gtfs.routes.services.js";
import { getShapesPoints, type ShapePoint } from "./gtfs.services.js";
import { distanceToPathMeters } from "../utils/geo.js";

type MatchedRoute = {
  shapeId: string;
  distanceMeters: number;
  source: "api_shape" | "route_fallback";
  path: ShapePoint[];
};

export async function findBestShapeForBus(
  bus: Bus,
): Promise<MatchedRoute | null> {
  const directions = await getRouteDirectionsByRouteId(bus.routeId);

  const candidateShapeIds = new Set(
    directions.map((direction) => direction.shapeId),
  );

  if (bus.shapeId) {
    candidateShapeIds.add(bus.shapeId);
  }

  let bestMatch: MatchedRoute | null = null;

  for (const shapeId of candidateShapeIds) {
    const shapePoints = await getShapesPoints(shapeId);

    if (shapePoints.length === 0) continue;

    const distanceMeters = distanceToPathMeters(
      {
        latitude: bus.latitude,
        longitude: bus.longitude,
      },

      shapePoints,
    );

    if (bestMatch === null || distanceMeters < bestMatch.distanceMeters) {
      bestMatch = {
        shapeId,
        distanceMeters,
        source: shapeId === bus.shapeId ? "api_shape" : "route_fallback",
        path: shapePoints,
      };
    }
  }

  return bestMatch;
}
