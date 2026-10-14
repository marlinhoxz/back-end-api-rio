
import type { GeoPoint } from "../utils/geo.js";
import {
  getConnectionsByStopId,
  getSharedStopsBetweenRoutes,
} from "./gtfs.connections.services.js";
import {
  getRouteShortNameById,
  getTripById,
} from "./gtfs.routes.services.js";
import { getShapeSegmentForTrip } from "./gtfs.shapes.services.js";
import {
  getAllStops,
  getStopById,
  type GtfsStop,
} from "./gtfs.stop.services.js";
import { getWalkingRoute } from "./walking-route.services.js";
import { getBusCache } from "./bus.cache.services.js";


type NearbyStop = GtfsStop & {
  distanceMeters: number;
};



type DirectTrip = {
  tripId: string;
  routeId: string;
  line: string;
  destination: string;
  directionId: string;
  busPath: GeoPoint[];

  boardingStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
  };

  alightingStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
  };
};


type DirectTripOption = {
  line: string;
  destination: string;
  directionId: string;
  totalTrips: number;
  busPath: GeoPoint[];

  boardingStop: DirectTrip["boardingStop"];
  alightingStop: DirectTrip["alightingStop"];

  totalWalkingDistanceMeters: number;
};


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

export async function findNearbyStops(
  point: GeoPoint,
  radiusMeters = 500,
): Promise<NearbyStop[]> {
  const stops = await getAllStops();

  // Bounding box rápido para descartar paradas distantes sem trigonometria pesada
  const latDelta = radiusMeters / 111_320;
  const cosLat = Math.cos((point.latitude * Math.PI) / 180);
  const lonDelta = radiusMeters / (111_320 * (Math.abs(cosLat) < 0.01 ? 1 : Math.abs(cosLat)));

  const minLat = point.latitude - latDelta;
  const maxLat = point.latitude + latDelta;
  const minLon = point.longitude - lonDelta;
  const maxLon = point.longitude + lonDelta;

  const candidateStops = stops.filter(
    (stop) =>
      stop.latitude >= minLat &&
      stop.latitude <= maxLat &&
      stop.longitude >= minLon &&
      stop.longitude <= maxLon,
  );

  return candidateStops
    .map((stop) => ({
      ...stop,
      distanceMeters: distanceBetweenPoints(point, stop),
    }))
    .filter((stop) => stop.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}


export async function findRouteIdsNearPoint(
  point: GeoPoint,
  radiusMeters = 500,
): Promise<string[]> {
  const stops = await findNearbyStops(point, radiusMeters);
  const routeIds = new Set<string>();

  for (const stop of stops) {
    const connections = await getConnectionsByStopId(stop.id);

    for (const connection of connections) {
      routeIds.add(connection.routeId);
    }
  }

  return [...routeIds];
}

export async function findLinesNearPoint(
  point: GeoPoint,
  radiusMeters = 500,
): Promise<string[]> {
  const routeIds = await findRouteIdsNearPoint(point, radiusMeters);

  const lineNames = await Promise.all(
    routeIds.map((routeId) => getRouteShortNameById(routeId)),
  );

  return [
    ...new Set(
      lineNames.filter(
        (line): line is string => line !== undefined,
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

export async function findDirectLines(
  origin: GeoPoint,
  destination: GeoPoint,
  radiusMeters = 500,
): Promise<string[]> {
  const originLines = await findLinesNearPoint(origin, radiusMeters);
  const destinationLines = await findLinesNearPoint(
    destination,
    radiusMeters,
  );

  const destinationSet = new Set(destinationLines);

  return originLines.filter((line) => destinationSet.has(line));
}

export async function findDirectRouteIds(
  origin: GeoPoint,
  destination: GeoPoint,
  radiusMeters = 500,
): Promise<string[]> {
  const originRouteIds = await findRouteIdsNearPoint(
    origin,
    radiusMeters,
  );

  const destinationRouteIds = new Set(
    await findRouteIdsNearPoint(destination, radiusMeters),
  );

  return originRouteIds.filter((routeId) =>
    destinationRouteIds.has(routeId),
  );
}


export async function findDirectTrips(
  origin: GeoPoint,
  destination: GeoPoint,
  radiusMeters = 500,
): Promise<DirectTrip[]> {
  const originStops = await findNearbyStops(origin, radiusMeters);
  const destinationStops = await findNearbyStops(
    destination,
    radiusMeters,
  );

  // Guarda a parada de embarque escolhida para cada viagem.
  const tripsByOrigin = new Map<
    string,
    {
      routeId: string;
      stopSequence: number;
      boardingStop: DirectTrip["boardingStop"];
    }
  >();

  for (const stop of originStops) {
    const connections = await getConnectionsByStopId(stop.id);

    for (const connection of connections) {
      const existing = tripsByOrigin.get(connection.tripId);

      if (
        existing === undefined ||
        connection.stopSequence < existing.stopSequence
      ) {
        tripsByOrigin.set(connection.tripId, {
          routeId: connection.routeId,
          stopSequence: connection.stopSequence,
          boardingStop: {
            id: stop.id,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            distanceMeters: stop.distanceMeters,
          },
        });
      }
    }
  }

  // Guarda cada viagem válida e sua primeira parada
  // de desembarque acessível depois do embarque.
  const validTrips = new Map<
    string,
    DirectTrip & { destinationSequence: number }
  >();

  for (const stop of destinationStops) {
    const connections = await getConnectionsByStopId(stop.id);

    for (const connection of connections) {
      const originTrip = tripsByOrigin.get(connection.tripId);

      if (
        originTrip === undefined ||
        originTrip.routeId !== connection.routeId ||
        originTrip.stopSequence >= connection.stopSequence
      ) {
        continue;
      }

      const [trip, line] = await Promise.all([
        getTripById(connection.tripId),
        getRouteShortNameById(connection.routeId),
      ]);

      if (trip === undefined || line === undefined) {
        continue;
      }

      const busPath = await getShapeSegmentForTrip(
  connection.tripId,
  originTrip.boardingStop,
  stop,
);

      const existing = validTrips.get(connection.tripId);

      if (
        existing === undefined ||
        connection.stopSequence < existing.destinationSequence
      ) {
        validTrips.set(connection.tripId, {
          tripId: connection.tripId,
          routeId: connection.routeId,
          line,
          destination: trip.destination,
          directionId: trip.directionId,

          boardingStop: originTrip.boardingStop,

          alightingStop: {
            id: stop.id,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            distanceMeters: stop.distanceMeters,
          },

          destinationSequence: connection.stopSequence,
          busPath,
        });
      }
    }
  }

 return [...validTrips.values()].map(
  ({
    tripId,
    routeId,
    line,
    destination,
    directionId,
    boardingStop,
    alightingStop,
    busPath,
  }) => ({
    tripId,
    routeId,
    line,
    destination,
    directionId,
    boardingStop,
    alightingStop,
    busPath,
  }),
);
}


export function groupDirectTrips(
  trips: DirectTrip[],
): DirectTripOption[] {
  const options = new Map<string, DirectTripOption>();

  for (const trip of trips) {
    // Agrupa apenas viagens com a mesma linha,
    // destino, sentido e paradas de embarque/desembarque.
    const key = [
      trip.line,
      trip.destination,
      trip.directionId,
      trip.boardingStop.id,
      trip.alightingStop.id,
    ].join("-");

    const totalWalkingDistanceMeters =
      trip.boardingStop.distanceMeters +
      trip.alightingStop.distanceMeters;

    const existing = options.get(key);

    if (existing) {
      existing.totalTrips += 1;
    } else {
      options.set(key, {
        line: trip.line,
        destination: trip.destination,
        directionId: trip.directionId,
        totalTrips: 1,
        boardingStop: trip.boardingStop,
        alightingStop: trip.alightingStop,
        totalWalkingDistanceMeters,
        busPath: trip.busPath,
      });
    }
  }

  return [...options.values()].sort(
    (a, b) =>
      a.totalWalkingDistanceMeters - b.totalWalkingDistanceMeters,
  );
}


export type RouteLeg =
  | {
      type: "WALK";
      instruction: string;
      distanceMeters: number;
      durationSeconds: number;
      path: GeoPoint[];
      from: { name: string; latitude: number; longitude: number };
      to: { name: string; latitude: number; longitude: number };
    }
  | {
      type: "BUS";
      instruction: string;
      line: string;
      destination: string;
      directionId: string;
      from: { id: string; name: string; latitude: number; longitude: number };
      to: { id: string; name: string; latitude: number; longitude: number };
      path: GeoPoint[];
      realtimeBuses?: Array<{
        id: string;
        speed: number;
        latitude: number;
        longitude: number;
        directionName: string;
      }>;
    };

export type CompleteRouteOption = DirectTripOption & {
  type: "DIRECT" | "TRANSFER" | "WALK";
  transfers: number;
  origin: GeoPoint;
  destinationPoint: GeoPoint;

  transferStop?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };

  secondLine?: {
    line: string;
    destination: string;
    directionId: string;
  };

  walkingToBoarding: {
    distanceMeters: number;
    durationSeconds: number;
    path: GeoPoint[];
  };

  walkingFromAlighting: {
    distanceMeters: number;
    durationSeconds: number;
    path: GeoPoint[];
  };

  totalWalkingDistanceMeters: number;
  totalWalkingDurationSeconds: number;

  legs: RouteLeg[];
  realtimeBusesCount?: number;
};



export async function findCompleteDirectRoutes(
  origin: GeoPoint,
  destination: GeoPoint,
  radiusMeters = 500,
): Promise<CompleteRouteOption[]> {
  const directDistance = distanceBetweenPoints(origin, destination);

  const trips = await findDirectTrips(
    origin,
    destination,
    radiusMeters,
  );

  const options = groupDirectTrips(trips);

  // Limita o cálculo completo de caminhada às melhores opções para evitar gargalo de rede
  const selectedOptions = options.slice(0, 6);

  const busCache = getBusCache();

  // Executa todas as opções e trechos de caminhada em paralelo
  const completeRoutes: CompleteRouteOption[] = await Promise.all(
    selectedOptions.map(async (option) => {
      const [walkingToBoarding, walkingFromAlighting] = await Promise.all([
        getWalkingRoute(origin, {
          latitude: option.boardingStop.latitude,
          longitude: option.boardingStop.longitude,
        }),
        getWalkingRoute(
          {
            latitude: option.alightingStop.latitude,
            longitude: option.alightingStop.longitude,
          },
          destination,
        ),
      ]);

      // Ônibus em tempo real ativos nessa linha
      const matchingBuses = busCache.buses.filter(
        (b) => b.line.toLowerCase() === option.line.toLowerCase(),
      );

      const realtimeBuses = matchingBuses.slice(0, 3).map((b) => ({
        id: b.id,
        speed: b.speed,
        latitude: b.latitude,
        longitude: b.longitude,
        directionName: b.directionName,
      }));

      const legs: RouteLeg[] = [
        {
          type: "WALK",
          instruction: `Caminhe até o ponto ${option.boardingStop.name}`,
          distanceMeters: walkingToBoarding.distanceMeters,
          durationSeconds: walkingToBoarding.durationSeconds,
          from: { name: "Sua localização", ...origin },
          to: {
            name: option.boardingStop.name,
            latitude: option.boardingStop.latitude,
            longitude: option.boardingStop.longitude,
          },
          path: walkingToBoarding.path,
        },
        {
          type: "BUS",
          instruction: `Embarque na linha ${option.line} sentido ${option.destination}`,
          line: option.line,
          destination: option.destination,
          directionId: option.directionId,
          from: option.boardingStop,
          to: option.alightingStop,
          path: option.busPath,
          realtimeBuses,
        },
        {
          type: "WALK",
          instruction: `Desembarque em ${option.alightingStop.name} e caminhe até o destino`,
          distanceMeters: walkingFromAlighting.distanceMeters,
          durationSeconds: walkingFromAlighting.durationSeconds,
          from: {
            name: option.alightingStop.name,
            latitude: option.alightingStop.latitude,
            longitude: option.alightingStop.longitude,
          },
          to: { name: "Destino", ...destination },
          path: walkingFromAlighting.path,
        },
      ];

      return {
        ...option,
        type: "DIRECT",
        transfers: 0,
        origin,
        destinationPoint: destination,
        walkingToBoarding,
        walkingFromAlighting,
        totalWalkingDistanceMeters:
          walkingToBoarding.distanceMeters +
          walkingFromAlighting.distanceMeters,
        totalWalkingDurationSeconds:
          walkingToBoarding.durationSeconds +
          walkingFromAlighting.durationSeconds,
        legs,
        realtimeBusesCount: matchingBuses.length,
      };
    }),
  );

  // Se o trajeto total for curto (até 800m) ou se não encontrou nenhum ônibus direto mas a distância a pé é viável (< 1500m)
  if (directDistance <= 800 || (completeRoutes.length === 0 && directDistance <= 1500)) {
    const directWalk = await getWalkingRoute(origin, destination);
    const walkOnlyOption: CompleteRouteOption = {
      type: "WALK",
      transfers: 0,
      line: "A pé",
      destination: "Destino final",
      directionId: "0",
      totalTrips: 0,
      boardingStop: {
        id: "origem",
        name: "Sua localização",
        latitude: origin.latitude,
        longitude: origin.longitude,
        distanceMeters: 0,
      },
      alightingStop: {
        id: "destino",
        name: "Destino final",
        latitude: destination.latitude,
        longitude: destination.longitude,
        distanceMeters: 0,
      },
      busPath: [],
      totalWalkingDistanceMeters: directWalk.distanceMeters,
      totalWalkingDurationSeconds: directWalk.durationSeconds,
      origin,
      destinationPoint: destination,
      walkingToBoarding: directWalk,
      walkingFromAlighting: {
        distanceMeters: 0,
        durationSeconds: 0,
        path: [],
      },
      legs: [
        {
          type: "WALK",
          instruction: "Caminhe diretamente até o destino",
          distanceMeters: directWalk.distanceMeters,
          durationSeconds: directWalk.durationSeconds,
          from: { name: "Sua localização", ...origin },
          to: { name: "Destino final", ...destination },
          path: directWalk.path,
        },
      ],
      realtimeBusesCount: 0,
    };

    if (directDistance <= 800) {
      completeRoutes.unshift(walkOnlyOption);
    } else {
      completeRoutes.push(walkOnlyOption);
    }
  }

  return completeRoutes.sort(
    (a, b) =>
      a.totalWalkingDistanceMeters -
      b.totalWalkingDistanceMeters,
  );
}

export type TransferTripOption = {
  firstLine: string;
  firstDestination: string;
  firstDirectionId: string;
  firstBusPath: GeoPoint[];
  boardingStop: DirectTrip["boardingStop"];

  transferStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };

  secondLine: string;
  secondDestination: string;
  secondDirectionId: string;
  secondBusPath: GeoPoint[];
  alightingStop: DirectTrip["alightingStop"];

  totalWalkingDistanceMeters: number;
};

export async function findTransferTrips(
  origin: GeoPoint,
  destination: GeoPoint,
  radiusMeters = 500,
): Promise<TransferTripOption[]> {
  const originStops = await findNearbyStops(origin, radiusMeters);
  const destinationStops = await findNearbyStops(destination, radiusMeters);

  if (originStops.length === 0 || destinationStops.length === 0) {
    return [];
  }

  const tripsByOrigin = new Map<
    string,
    {
      routeId: string;
      stopSequence: number;
      boardingStop: DirectTrip["boardingStop"];
    }
  >();
  const originRoutes = new Set<string>();

  for (const stop of originStops) {
    const connections = await getConnectionsByStopId(stop.id);
    for (const connection of connections) {
      originRoutes.add(connection.routeId);
      const existing = tripsByOrigin.get(connection.tripId);
      if (existing === undefined || connection.stopSequence < existing.stopSequence) {
        tripsByOrigin.set(connection.tripId, {
          routeId: connection.routeId,
          stopSequence: connection.stopSequence,
          boardingStop: {
            id: stop.id,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            distanceMeters: stop.distanceMeters,
          },
        });
      }
    }
  }

  const tripsByDestination = new Map<
    string,
    {
      routeId: string;
      stopSequence: number;
      alightingStop: DirectTrip["alightingStop"];
    }
  >();
  const destinationRoutes = new Set<string>();

  for (const stop of destinationStops) {
    const connections = await getConnectionsByStopId(stop.id);
    for (const connection of connections) {
      destinationRoutes.add(connection.routeId);
      const existing = tripsByDestination.get(connection.tripId);
      if (existing === undefined || connection.stopSequence > existing.stopSequence) {
        tripsByDestination.set(connection.tripId, {
          routeId: connection.routeId,
          stopSequence: connection.stopSequence,
          alightingStop: {
            id: stop.id,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            distanceMeters: stop.distanceMeters,
          },
        });
      }
    }
  }

  const directDistance = distanceBetweenPoints(origin, destination);
  const transferOptionsMap = new Map<string, TransferTripOption>();

  const originRouteList = [...originRoutes].slice(0, 15);
  const destRouteList = [...destinationRoutes].slice(0, 15);

  for (const r1 of originRouteList) {
    for (const r2 of destRouteList) {
      if (r1 === r2) continue;

      const sharedStopIds = await getSharedStopsBetweenRoutes(r1, r2);
      if (sharedStopIds.length === 0) continue;

      let bestSharedStop: GtfsStop | null = null;
      let minDetour = Infinity;

      for (const stopId of sharedStopIds) {
        const stop = await getStopById(stopId);
        if (!stop) continue;

        const distToDest = distanceBetweenPoints(stop, destination);
        if (distToDest > directDistance * 1.25 && distToDest > 2000) {
          continue;
        }

        const detour = distanceBetweenPoints(origin, stop) + distToDest;
        if (detour < minDetour) {
          minDetour = detour;
          bestSharedStop = stop;
        }
      }

      if (!bestSharedStop) continue;

      const transferConnections = await getConnectionsByStopId(bestSharedStop.id);

      let validTrip1: { tripId: string; boardingStop: DirectTrip["boardingStop"] } | null = null;
      for (const conn of transferConnections) {
        if (conn.routeId !== r1) continue;
        const originTrip = tripsByOrigin.get(conn.tripId);
        if (originTrip && originTrip.stopSequence < conn.stopSequence) {
          validTrip1 = {
            tripId: conn.tripId,
            boardingStop: originTrip.boardingStop,
          };
          break;
        }
      }

      if (!validTrip1) continue;

      let validTrip2: { tripId: string; alightingStop: DirectTrip["alightingStop"] } | null = null;
      for (const conn of transferConnections) {
        if (conn.routeId !== r2) continue;
        const destTrip = tripsByDestination.get(conn.tripId);
        if (destTrip && conn.stopSequence < destTrip.stopSequence) {
          validTrip2 = {
            tripId: conn.tripId,
            alightingStop: destTrip.alightingStop,
          };
          break;
        }
      }

      if (!validTrip2) continue;

      const [tripObj1, line1, tripObj2, line2] = await Promise.all([
        getTripById(validTrip1.tripId),
        getRouteShortNameById(r1),
        getTripById(validTrip2.tripId),
        getRouteShortNameById(r2),
      ]);

      if (!tripObj1 || !line1 || !tripObj2 || !line2) continue;

      const key = `${line1}-${tripObj1.destination}-${line2}-${tripObj2.destination}-${bestSharedStop.id}`;
      if (transferOptionsMap.has(key)) continue;

      const [firstBusPath, secondBusPath] = await Promise.all([
        getShapeSegmentForTrip(validTrip1.tripId, validTrip1.boardingStop, bestSharedStop),
        getShapeSegmentForTrip(validTrip2.tripId, bestSharedStop, validTrip2.alightingStop),
      ]);

      transferOptionsMap.set(key, {
        firstLine: line1,
        firstDestination: tripObj1.destination,
        firstDirectionId: tripObj1.directionId,
        firstBusPath,
        boardingStop: validTrip1.boardingStop,
        transferStop: {
          id: bestSharedStop.id,
          name: bestSharedStop.name,
          latitude: bestSharedStop.latitude,
          longitude: bestSharedStop.longitude,
        },
        secondLine: line2,
        secondDestination: tripObj2.destination,
        secondDirectionId: tripObj2.directionId,
        secondBusPath,
        alightingStop: validTrip2.alightingStop,
        totalWalkingDistanceMeters:
          validTrip1.boardingStop.distanceMeters + validTrip2.alightingStop.distanceMeters,
      });

      if (transferOptionsMap.size >= 5) {
        break;
      }
    }

    if (transferOptionsMap.size >= 5) {
      break;
    }
  }

  return [...transferOptionsMap.values()].sort(
    (a, b) => a.totalWalkingDistanceMeters - b.totalWalkingDistanceMeters,
  );
}

export async function findCompleteRoutes(
  origin: GeoPoint,
  destination: GeoPoint,
  radiusMeters = 500,
): Promise<CompleteRouteOption[]> {
  const directRoutes = await findCompleteDirectRoutes(
    origin,
    destination,
    radiusMeters,
  );

  const directBusRoutes = directRoutes.filter((r) => r.type === "DIRECT");

  // Se já temos rotas diretas suficientes (3 ou mais), retornamos as diretas imediatamente
  if (directBusRoutes.length >= 3) {
    return directRoutes;
  }

  // Caso contrário, buscamos rotas com baldeação para complementar ou preencher
  const transferTrips = await findTransferTrips(
    origin,
    destination,
    radiusMeters,
  );

  const busCache = getBusCache();

  const transferRoutes: CompleteRouteOption[] = await Promise.all(
    transferTrips.slice(0, 4).map(async (option) => {
      const [walkingToBoarding, walkingFromAlighting] = await Promise.all([
        getWalkingRoute(origin, {
          latitude: option.boardingStop.latitude,
          longitude: option.boardingStop.longitude,
        }),
        getWalkingRoute(
          {
            latitude: option.alightingStop.latitude,
            longitude: option.alightingStop.longitude,
          },
          destination,
        ),
      ]);

      const buses1 = busCache.buses.filter(
        (b) => b.line.toLowerCase() === option.firstLine.toLowerCase(),
      );
      const buses2 = busCache.buses.filter(
        (b) => b.line.toLowerCase() === option.secondLine.toLowerCase(),
      );

      const realtimeBuses1 = buses1.slice(0, 2).map((b) => ({
        id: b.id,
        speed: b.speed,
        latitude: b.latitude,
        longitude: b.longitude,
        directionName: b.directionName,
      }));

      const realtimeBuses2 = buses2.slice(0, 2).map((b) => ({
        id: b.id,
        speed: b.speed,
        latitude: b.latitude,
        longitude: b.longitude,
        directionName: b.directionName,
      }));

      const legs: RouteLeg[] = [
        {
          type: "WALK",
          instruction: `Caminhe até o ponto ${option.boardingStop.name}`,
          distanceMeters: walkingToBoarding.distanceMeters,
          durationSeconds: walkingToBoarding.durationSeconds,
          from: { name: "Sua localização", ...origin },
          to: {
            name: option.boardingStop.name,
            latitude: option.boardingStop.latitude,
            longitude: option.boardingStop.longitude,
          },
          path: walkingToBoarding.path,
        },
        {
          type: "BUS",
          instruction: `Embarque na linha ${option.firstLine} sentido ${option.firstDestination}`,
          line: option.firstLine,
          destination: option.firstDestination,
          directionId: option.firstDirectionId,
          from: option.boardingStop,
          to: option.transferStop,
          path: option.firstBusPath,
          realtimeBuses: realtimeBuses1,
        },
        {
          type: "WALK",
          instruction: `Desembarque em ${option.transferStop.name} e aguarde a linha ${option.secondLine}`,
          distanceMeters: 0,
          durationSeconds: 180,
          from: { ...option.transferStop },
          to: { ...option.transferStop },
          path: [option.transferStop],
        },
        {
          type: "BUS",
          instruction: `Embarque na linha ${option.secondLine} sentido ${option.secondDestination}`,
          line: option.secondLine,
          destination: option.secondDestination,
          directionId: option.secondDirectionId,
          from: option.transferStop,
          to: option.alightingStop,
          path: option.secondBusPath,
          realtimeBuses: realtimeBuses2,
        },
        {
          type: "WALK",
          instruction: `Desembarque em ${option.alightingStop.name} e caminhe até o destino`,
          distanceMeters: walkingFromAlighting.distanceMeters,
          durationSeconds: walkingFromAlighting.durationSeconds,
          from: {
            name: option.alightingStop.name,
            latitude: option.alightingStop.latitude,
            longitude: option.alightingStop.longitude,
          },
          to: { name: "Destino", ...destination },
          path: walkingFromAlighting.path,
        },
      ];

      return {
        type: "TRANSFER",
        transfers: 1,
        line: `${option.firstLine} + ${option.secondLine}`,
        destination: option.secondDestination,
        directionId: option.firstDirectionId,
        totalTrips: 1,
        boardingStop: option.boardingStop,
        alightingStop: option.alightingStop,
        transferStop: option.transferStop,
        secondLine: {
          line: option.secondLine,
          destination: option.secondDestination,
          directionId: option.secondDirectionId,
        },
        busPath: [...option.firstBusPath, ...option.secondBusPath],
        origin,
        destinationPoint: destination,
        walkingToBoarding,
        walkingFromAlighting,
        totalWalkingDistanceMeters:
          walkingToBoarding.distanceMeters + walkingFromAlighting.distanceMeters,
        totalWalkingDurationSeconds:
          walkingToBoarding.durationSeconds + 180 + walkingFromAlighting.durationSeconds,
        legs,
        realtimeBusesCount: buses1.length + buses2.length,
      };
    }),
  );

  const allRoutes = [...directRoutes, ...transferRoutes];

  return allRoutes.sort((a, b) => {
    if (a.transfers !== b.transfers) {
      return a.transfers - b.transfers;
    }
    return a.totalWalkingDistanceMeters - b.totalWalkingDistanceMeters;
  });
}


