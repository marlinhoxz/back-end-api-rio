import type { Request, Response } from "express";

import type { BusFilters, Modo } from "../types/bus.js";

import { filterBusesByArea, getAllBuses } from "../services/bus.services.js";

import { getBusCache } from "../services/bus.cache.services.js";

function isValidMinutoUtc(value: string): boolean {
  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    (value.endsWith("Z") || value.endsWith("+00:00"))
  );
}

function isValidModo(value: string): value is Modo {
  return value === "onibus" || value === "brt";
}

export async function getBuses(req: Request, res: Response) {
  try {
    const {
      minuto_utc,
      servico,
      sistema,
      modo,
      minLat,
      maxLat,
      minLon,
      maxLon,
    } = req.query;

    const minutoUtc = typeof minuto_utc === "string" ? minuto_utc : undefined;

    const servicoValue = typeof servico === "string" ? servico : undefined;

    const sistemaValue = typeof sistema === "string" ? sistema : undefined;

    let modoValue: Modo | undefined;

    if (typeof modo === "string" && isValidModo(modo)) {
      modoValue = modo;
    } else if (typeof modo === "string") {
      return res.status(400).json({
        error: "modo deve ser onibus ou brt",
      });
    }

    if (minutoUtc && !isValidMinutoUtc(minutoUtc)) {
      return res.status(400).json({
        error: "minuto_utc deve ser uma data UTC válida",
      });
    }

    const minLatValue = typeof minLat === "string" ? Number(minLat) : undefined;

    const maxLatValue = typeof maxLat === "string" ? Number(maxLat) : undefined;

    const minLonValue = typeof minLon === "string" ? Number(minLon) : undefined;

    const maxLonValue = typeof maxLon === "string" ? Number(maxLon) : undefined;

    const hasAnyGeoFilter =
      minLatValue !== undefined ||
      maxLatValue !== undefined ||
      minLonValue !== undefined ||
      maxLonValue !== undefined;

    if (hasAnyGeoFilter) {
      const values = [minLatValue, maxLatValue, minLonValue, maxLonValue];

      const hasMissingOrInvalidValue = values.some(
        (value) => value === undefined || !Number.isFinite(value),
      );

      if (
        hasMissingOrInvalidValue ||
        minLatValue === undefined ||
        maxLatValue === undefined ||
        minLonValue === undefined ||
        maxLonValue === undefined ||
        minLatValue < -90 ||
        maxLatValue > 90 ||
        minLonValue < -180 ||
        maxLonValue > 180 ||
        minLatValue > maxLatValue ||
        minLonValue > maxLonValue
      ) {
        return res.status(400).json({
          error: "Informe limites geográficos válidos.",
        });
      }
    }

    if (minutoUtc || sistemaValue || modoValue) {
      const filter: BusFilters = {};

      if (minutoUtc) filter.minuto_utc = minutoUtc;
      if (servicoValue) filter.servico = servicoValue;
      if (sistemaValue) filter.sistema = sistemaValue;
      if (modoValue) filter.modo = modoValue;

      const buses = await getAllBuses(filter);

      let filteredBuses = buses;

      if (hasAnyGeoFilter) {
        filteredBuses = filterBusesByArea(filteredBuses, {
          minLat: minLatValue!,
          maxLat: maxLatValue!,
          minLon: minLonValue!,
          maxLon: maxLonValue!,
        });
      }

      return res.json(filteredBuses);
    }

    const cache = getBusCache();

    if (cache.lastUpdate === null) {
      return res.status(503).json({
        error: "Os dados dos ônibus ainda não estão disponíveis.",
      });
    }

    let buses = cache.buses;

    if (servicoValue) {
      buses = buses.filter((bus) => bus.line === servicoValue);
    }

    if (hasAnyGeoFilter) {
      buses = filterBusesByArea(buses, {
        minLat: minLatValue!,
        maxLat: maxLatValue!,
        minLon: minLonValue!,
        maxLon: maxLonValue!,
      });
    }

    return res.json(buses);
  } catch (error) {
    console.error("Erro ao buscar ônibus:", error);

    return res.status(502).json({
      error: "Não foi possível buscar os ônibus.",
    });
  }
}

export function getBusCacheStatus(req: Request, res: Response) {
  const cache = getBusCache();

  return res.json({
    status: cache.status,
    totalBuses: cache.buses.length,
    lastUpdate: cache.lastUpdate,
  });
}
