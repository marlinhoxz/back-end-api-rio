import type { Request, Response } from "express";
import { getRouteDirections } from "../services/gtfs.routes.services.js";

export async function getLineDirections(req: Request, res: Response) {
  try {
    const rawLine = req.params.line;
    const line = typeof rawLine === "string" ? rawLine.trim() : "";

    if (!line) {
      return res.status(400).json({
        error: "Informe o n-umero da linha",
      });
    }

    const direction = await getRouteDirections(line);

    if (direction.length === 0) {
      return res.status(404).json({
        error: `Linha ${line} não encontrada`,
      });
    }

    return res.json(direction);
  } catch (error) {
    console.error("Error ao buscar sentido da linha.", error);

    return res.status(500).json({
      error: "Não foi possivel buscar sentido da linha",
    });
  }
}
