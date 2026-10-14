
import { readCsv } from "./gtfs.routes.services.js";
import type { GeoPoint } from "../utils/geo.js";

type ShapePoint = GeoPoint & {
  sequence: number;
};

type ShapeIndex = {
  shapeIdByTripId: Map<string, string>;
  pointsByShapeId: Map<string, ShapePoint[]>;
};

let shapeIndexPromise: Promise<ShapeIndex> | null = null;

async function buildShapeIndex(): Promise<ShapeIndex> {
  const [trips, shapeRows] = await Promise.all([
    readCsv("trips.txt", ["trip_id", "shape_id"]),
    readCsv("shapes.txt", [
      "shape_id",
      "shape_pt_lat",
      "shape_pt_lon",
      "shape_pt_sequence",
    ]),
  ]);

  const shapeIdByTripId = new Map<string, string>();

  for (const trip of trips) {
    if (trip.shape_id) {
      shapeIdByTripId.set(trip.trip_id, trip.shape_id);
    }
  }

  const pointsByShapeId = new Map<string, ShapePoint[]>();

  for (const row of shapeRows) {
    const latitude = Number(row.shape_pt_lat);
    const longitude = Number(row.shape_pt_lon);
    const sequence = Number(row.shape_pt_sequence);

    if (
      !row.shape_id ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(sequence)
    ) {
      continue;
    }

    const points = pointsByShapeId.get(row.shape_id) ?? [];

    points.push({
      latitude,
      longitude,
      sequence,
    });

    pointsByShapeId.set(row.shape_id, points);
  }

  for (const points of pointsByShapeId.values()) {
    points.sort((a, b) => a.sequence - b.sequence);
  }

  return {
    shapeIdByTripId,
    pointsByShapeId,
  };
}

async function getShapeIndex(): Promise<ShapeIndex> {
  shapeIndexPromise ??= buildShapeIndex().catch((error) => {
    shapeIndexPromise = null;
    throw error;
  });

  return shapeIndexPromise;
}

const EARTH_RADIUS_METERS = 6_371_000;

function distanceBetweenPoints(
  pointA: GeoPoint,
  pointB: GeoPoint,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const latitudeA = toRadians(pointA.latitude);
  const latitudeB = toRadians(pointB.latitude);
  const latitudeDifference = latitudeB - latitudeA;
  const longitudeDifference = toRadians(
    pointB.longitude - pointA.longitude,
  );

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.asin(Math.sqrt(Math.min(1, haversine)))
  );
}


function findNearestPointIndex(
  points: ShapePoint[],
  stop: GeoPoint,
  startIndex = 0,
): number {
  let nearestIndex = -1;
  let shortestDistance = Infinity;

  for (let index = startIndex; index < points.length; index++) {
    const point = points[index];

    if (point === undefined) {
      continue;
    }

    const distance = distanceBetweenPoints(point, stop);

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}


export async function getShapeSegmentForTrip(
  tripId: string,
  boardingStop: GeoPoint,
  alightingStop: GeoPoint,
): Promise<GeoPoint[]> {
  const index = await getShapeIndex();
  const shapeId = index.shapeIdByTripId.get(tripId);

  const fallbackSegment = [
    { latitude: boardingStop.latitude, longitude: boardingStop.longitude },
    { latitude: alightingStop.latitude, longitude: alightingStop.longitude },
  ];

  if (!shapeId) {
    return fallbackSegment;
  }

  const points = index.pointsByShapeId.get(shapeId);

  if (!points || points.length === 0) {
    return fallbackSegment;
  }

  const boardingIndex = findNearestPointIndex(points, boardingStop, 0);

  if (boardingIndex < 0) {
    return fallbackSegment;
  }

  // Busca a parada de desembarque a partir do índice de embarque para frente
  let alightingIndex = findNearestPointIndex(points, alightingStop, boardingIndex);

  // Se por algum motivo o índice à frente não for maior, tenta busca global
  if (alightingIndex <= boardingIndex) {
    const globalAlightingIndex = findNearestPointIndex(points, alightingStop, 0);
    if (globalAlightingIndex > boardingIndex) {
      alightingIndex = globalAlightingIndex;
    }
  }

  if (alightingIndex <= boardingIndex) {
    return fallbackSegment;
  }

  return points
    .slice(boardingIndex, alightingIndex + 1)
    .map(({ latitude, longitude }) => ({
      latitude,
      longitude,
    }));
}

