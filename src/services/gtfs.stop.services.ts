
import { readCsv } from "./gtfs.routes.services.js";

export type GtfsStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

async function buildStopsIndex(): Promise<Map<string, GtfsStop>> {
  const rows = await readCsv("stops.txt", [
    "stop_id",
    "stop_name",
    "stop_lat",
    "stop_lon",
  ]);

  const stops = new Map<string, GtfsStop>();

  for (const row of rows) {
    stops.set(row.stop_id, {
      id: row.stop_id,
      name: row.stop_name,
      latitude: Number(row.stop_lat),
      longitude: Number(row.stop_lon),
    });
  }

  return stops;
}

let stopsPromise: Promise<Map<string, GtfsStop>> | null = null;

export async function getStopById(
  stopId: string,
): Promise<GtfsStop | undefined> {
  stopsPromise ??= buildStopsIndex().catch((error) => {
    stopsPromise = null;
    throw error;
  });

  const stops = await stopsPromise;
  return stops.get(stopId);
}



export async function getAllStops(): Promise<GtfsStop[]> {
  stopsPromise ??= buildStopsIndex().catch((error) => {
    stopsPromise = null;
    throw error;
  });

  const stops = await stopsPromise;
  return [...stops.values()];
}