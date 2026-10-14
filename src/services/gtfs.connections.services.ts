
import { readCsv } from "./gtfs.routes.services.js";

export type StopConnection = {
  routeId: string;
  tripId: string;
  stopSequence: number;
};

type ConnectionsIndex = {
  byStopId: Map<string, StopConnection[]>;
  byRouteId: Map<string, Set<string>>;
};

async function buildConnectionsIndex(): Promise<ConnectionsIndex> {
  const trips = await readCsv("trips.txt", [
    "trip_id",
    "route_id",
  ]);

  const routeByTripId = new Map<string, string>();

  for (const trip of trips) {
    routeByTripId.set(trip.trip_id, trip.route_id);
  }

  const stopTimes = await readCsv("stop_times.txt", [
    "trip_id",
    "stop_id",
    "stop_sequence",
  ]);

  const byStopId = new Map<string, StopConnection[]>();
  const byRouteId = new Map<string, Set<string>>();

  for (const stopTime of stopTimes) {
    const routeId = routeByTripId.get(stopTime.trip_id);

    if (routeId === undefined) continue;

    const stopConnection: StopConnection = {
      routeId,
      tripId: stopTime.trip_id,
      stopSequence: Number(stopTime.stop_sequence),
    };

    const stopConnections = byStopId.get(stopTime.stop_id) ?? [];
    stopConnections.push(stopConnection);
    byStopId.set(stopTime.stop_id, stopConnections);

    const routeStops = byRouteId.get(routeId) ?? new Set<string>();
    routeStops.add(stopTime.stop_id);
    byRouteId.set(routeId, routeStops);
  }

  return { byStopId, byRouteId };
}

let connectionsPromise: Promise<ConnectionsIndex> | null = null;

async function getConnectionsIndex(): Promise<ConnectionsIndex> {
  connectionsPromise ??= buildConnectionsIndex().catch((error) => {
    connectionsPromise = null;
    throw error;
  });

  return connectionsPromise;
}

export async function getConnectionsByStopId(
  stopId: string,
): Promise<StopConnection[]> {
  const connections = await getConnectionsIndex();
  return connections.byStopId.get(stopId) ?? [];
}

export async function getStopsByRouteId(
  routeId: string,
): Promise<string[]> {
  const connections = await getConnectionsIndex();
  return [...(connections.byRouteId.get(routeId) ?? [])];
}


export async function getSharedStopsBetweenRoutes(
  firstRouteId: string,
  secondRouteId: string,
): Promise<string[]> {
  const connections = await getConnectionsIndex();

  const firstStops = connections.byRouteId.get(firstRouteId);
  const secondStops = connections.byRouteId.get(secondRouteId);

  if (!firstStops || !secondStops) {
    return [];
  }

  const sharedStops: string[] = [];

  for (const stopId of firstStops) {
    if (secondStops.has(stopId)) {
      sharedStops.push(stopId);
    }
  }

  return sharedStops;
}

export async function preloadGtfsConnections(): Promise<void> {
  await getConnectionsIndex();
}
