import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const gtfsDirectory = path.resolve(currentDirectory, "../data/gtfs");

export async function readCsv<Column extends string>(
  fileName: string,
  requiredColumns: Column[],
): Promise<Record<Column, string>[]> {
  const filePath = path.join(gtfsDirectory, fileName);
  const content = await readFile(filePath, "utf-8");

  const rows = parse(content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const firstRow = rows[0];

  if (firstRow !== undefined) {
    for (const column of requiredColumns) {
      if (!(column in firstRow)) {
        throw new Error(`Coluna "${column}" não encontrada em ${fileName}`);
      }
    }
  }

  return rows as Record<Column, string>[];
}

export type RouteDirection = {
  directionId: string;
  destination: string;
  shapeId: string;
};

type RouteIndexes = {
  byLine: Map<string, RouteDirection[]>;
  byRouteId: Map<string, RouteDirection[]>;
};

async function buildIndex(): Promise<RouteIndexes> {
  const routes = await readCsv("routes.txt", ["route_id", "route_short_name"]);

  const lineByRouteId = new Map<string, string>();

  for (const route of routes) {
    lineByRouteId.set(route.route_id, route.route_short_name);
  }

  const trips = await readCsv("trips.txt", [
    "route_id",
    "direction_id",
    "trip_headsign",
    "shape_id",
  ]);

  const byLine = new Map<string, RouteDirection[]>();
  const byRouteId = new Map<string, RouteDirection[]>();
  const seen = new Set<string>();

  for (const trip of trips) {
    const line = lineByRouteId.get(trip.route_id);

    if (line === undefined) continue;

    const key = `${trip.route_id}|${trip.direction_id}|${trip.shape_id}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const direction: RouteDirection = {
      directionId: trip.direction_id,
      destination: trip.trip_headsign,
      shapeId: trip.shape_id,
    };

    const lineDirections = byLine.get(line) ?? [];
    lineDirections.push(direction);
    byLine.set(line, lineDirections);

    const routeDirections = byRouteId.get(trip.route_id) ?? [];
    routeDirections.push(direction);
    byRouteId.set(trip.route_id, routeDirections);
  }

  return { byLine, byRouteId };
}

let indexPromise: Promise<RouteIndexes> | null = null;

export async function getRouteDirections(
  line: string,
): Promise<RouteDirection[]> {
  indexPromise ??= buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });

  const index = await indexPromise;
  return index.byLine.get(line) ?? [];
}

export async function getRouteDirectionsByRouteId(
  routeId: string,
): Promise<RouteDirection[]> {
  indexPromise ??= buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });

  const index = await indexPromise;
  return index.byRouteId.get(routeId) ?? [];
}
