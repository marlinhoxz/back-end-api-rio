
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const gtfsDirectory = path.resolve(currentDirectory, "../data/gtfs");

// Lê um arquivo CSV do GTFS e verifica suas colunas obrigatórias.
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
        throw new Error(
          `Coluna "${column}" não encontrada em ${fileName}`,
        );
      }
    }
  }

  return rows as Record<Column, string>[];
}

// Representa um sentido/direção de uma linha.
export type RouteDirection = {
  directionId: string;
  destination: string;
  shapeId: string;
};

// Representa uma viagem específica do arquivo trips.txt.
export type GtfsTrip = {
  tripId: string;
  routeId: string;
  directionId: string;
  destination: string;
  shapeId: string;
};

// Índices em memória para evitar pesquisas repetidas nos arquivos.
type RouteIndexes = {
  byLine: Map<string, RouteDirection[]>;
  byRouteId: Map<string, RouteDirection[]>;
  shortNameByRouteId: Map<string, string>;
  byTripId: Map<string, GtfsTrip>;
};

// Lê o GTFS e constrói os índices.
async function buildIndex(): Promise<RouteIndexes> {
  const routes = await readCsv("routes.txt", [
    "route_id",
    "route_short_name",
  ]);

  const lineByRouteId = new Map<string, string>();

  for (const route of routes) {
    lineByRouteId.set(route.route_id, route.route_short_name);
  }

  const trips = await readCsv("trips.txt", [
    "trip_id",
    "route_id",
    "direction_id",
    "trip_headsign",
    "shape_id",
  ]);

  const byLine = new Map<string, RouteDirection[]>();
  const byRouteId = new Map<string, RouteDirection[]>();
  const shortNameByRouteId = new Map(lineByRouteId);
  const byTripId = new Map<string, GtfsTrip>();
  const seen = new Set<string>();

  for (const trip of trips) {
    const line = lineByRouteId.get(trip.route_id);

    if (line === undefined) continue;

    // Guarda os dados de cada viagem individualmente.
    byTripId.set(trip.trip_id, {
      tripId: trip.trip_id,
      routeId: trip.route_id,
      directionId: trip.direction_id,
      destination: trip.trip_headsign,
      shapeId: trip.shape_id,
    });

    // Evita repetir a mesma combinação de linha, sentido e trajeto.
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

  return {
    byLine,
    byRouteId,
    shortNameByRouteId,
    byTripId,
  };
}

// Compartilha a mesma inicialização entre todas as consultas.
let indexPromise: Promise<RouteIndexes> | null = null;

function getIndexes(): Promise<RouteIndexes> {
  indexPromise ??= buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });

  return indexPromise;
}

// Busca os sentidos e destinos de uma linha.
export async function getRouteDirections(
  line: string,
): Promise<RouteDirection[]> {
  const index = await getIndexes();
  return index.byLine.get(line) ?? [];
}

// Busca os sentidos e destinos pelo ID interno da linha no GTFS.
export async function getRouteDirectionsByRouteId(
  routeId: string,
): Promise<RouteDirection[]> {
  const index = await getIndexes();
  return index.byRouteId.get(routeId) ?? [];
}

// Retorna todas as linhas com seus respectivos sentidos.
export async function getAllRouteDirections(): Promise<
  Map<string, RouteDirection[]>
> {
  const index = await getIndexes();
  return index.byLine;
}

// Descobre o número público da linha pelo ID interno do GTFS.
export async function getRouteShortNameById(
  routeId: string,
): Promise<string | undefined> {
  const index = await getIndexes();
  return index.shortNameByRouteId.get(routeId);
}

// Busca uma viagem específica pelo trip_id.
export async function getTripById(
  tripId: string,
): Promise<GtfsTrip | undefined> {
  const index = await getIndexes();
  return index.byTripId.get(tripId);
}
