import type { BusApiResponse } from "../types/bus-api.ts";
import type { Bus, BusFilters } from "../types/bus.ts";
import {
  getBusCache,
  setBusCacheError,
  updateBusCache,
} from "./bus.cache.services.js";

const API_URL = "https://its.mobilidade.rio/v1/geolocalizacao/veiculos";

export async function getAllBuses(filter: BusFilters): Promise<Bus[]> {
  const url = new URL(API_URL);

  if (filter.minuto_utc) {
    url.searchParams.set("minuto_utc", filter.minuto_utc);
  }

  if (filter.servico) {
    url.searchParams.set("servico", filter.servico);
  }

  if (filter.sistema) {
    url.searchParams.set("sistema", filter.sistema);
  }

  if (filter.modo) {
    url.searchParams.set("modo", filter.modo);
  }

  const allBuses: Bus[] = [];
  const seenCursors = new Set<string>();

  let cursor: string | null = null;

  while (true) {
    if (cursor !== null) {
      if (seenCursors.has(cursor)) {
        throw new Error("A API retornou um cursor repetido");
      }

      seenCursors.add(cursor);
      url.searchParams.set("cursor", cursor);
    } else {
      url.searchParams.delete("cursor");
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data: BusApiResponse = await response.json();

    const buses: Bus[] = data.data.map((bus) => ({
      id: bus.id_veiculo,
      line: bus.servico,
      latitude: bus.latitude,
      longitude: bus.longitude,
      speed: bus.velocidade,
      direction: bus.direcao,
      directionName: bus.sentido,
      datetime: bus.datetime,
    }));

    allBuses.push(...buses);

    cursor = data.next_cursor;

    if (cursor === null) {
      break;
    }
  }

  return allBuses;
}

export async function refreshBusCache(): Promise<void> {
  try {
    const buses = await getAllBuses({});

    updateBusCache(buses);
    console.log("Cache de ônibus atualizado com sucesso.");
  } catch (error) {
    const cache = getBusCache();
    if (cache.lastUpdate === null) {
      setBusCacheError();
    }
    console.error("Erro ao atualizar o cache:", error);
    throw error;
  }
}


export function filterBusesByArea(buses: Bus[], filters: BusFilters): Bus[] {

  const {minLat, maxLat, minLon, maxLon} = filters

  if(
    minLat === undefined ||
    maxLat === undefined ||
    minLon === undefined ||
    maxLon === undefined
  ) {
    return buses
  }

  return buses.filter((bus) => {
    return (
      bus.latitude >= minLat &&
      bus.latitude <= maxLat &&
      bus.longitude >= minLon &&
      bus.longitude <= maxLon
    )
  })

}