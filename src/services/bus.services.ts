import type { Request, Response } from "express";

import type { BusFilters, Modo } from "../types/bus.js";
import { getAllBuses } from "../controllers/bus.controllers.js";

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
    const { minuto_utc, servico, sistema, modo } = req.query;

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

    const filter: BusFilters = {};

    if (minutoUtc) {
      filter.minuto_utc = minutoUtc;
    }

    if (servicoValue) {
      filter.servico = servicoValue;
    }

    if (sistemaValue) {
      filter.sistema = sistemaValue;
    }

    if (modoValue) {
      filter.modo = modoValue;
    }

    const buses = await getAllBuses(filter);

    res.json(buses);
  } catch (error) {
    console.error(error);

    res.status(502).json({
      error: "Não foi possivel buscar os ônibus",
    });
  }
}
