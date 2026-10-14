
import type { Request, Response } from "express";
import { findCompleteRoutes } from "../services/route-planning.services.js";

export async function planRoute(req: Request, res: Response) {
  const {
    originLat,
    originLon,
    destinationLat,
    destinationLon,
  } = req.query;

  const values = [
    originLat,
    originLon,
    destinationLat,
    destinationLon,
  ];

  if (
    values.some(
      (value) =>
        typeof value !== "string" || value.trim() === "",
    )
  ) {
    return res.status(400).json({
      error:
        "Informe originLat, originLon, destinationLat e destinationLon.",
    });
  }

  const originLatValue = Number(originLat);
  const originLonValue = Number(originLon);
  const destinationLatValue = Number(destinationLat);
  const destinationLonValue = Number(destinationLon);

  if (
    !Number.isFinite(originLatValue) ||
    !Number.isFinite(originLonValue) ||
    !Number.isFinite(destinationLatValue) ||
    !Number.isFinite(destinationLonValue) ||
    originLatValue < -90 ||
    originLatValue > 90 ||
    destinationLatValue < -90 ||
    destinationLatValue > 90 ||
    originLonValue < -180 ||
    originLonValue > 180 ||
    destinationLonValue < -180 ||
    destinationLonValue > 180
  ) {
    return res.status(400).json({
      error: "As coordenadas informadas são inválidas.",
    });
  }

  try {
    const origin = {
      latitude: originLatValue,
      longitude: originLonValue,
    };

    const destination = {
      latitude: destinationLatValue,
      longitude: destinationLonValue,
    };

    const radiusQuery = req.query.radius;
    let radiusValue = 500;
    if (typeof radiusQuery === "string" && Number.isFinite(Number(radiusQuery))) {
      const parsed = Number(radiusQuery);
      if (parsed >= 100 && parsed <= 3000) {
        radiusValue = parsed;
      }
    }

    const options = await findCompleteRoutes(
      origin,
      destination,
      radiusValue,
    );

    const directOptions = options.filter((option) => option.type === "DIRECT");
    const transferOptions = options.filter((option) => option.type === "TRANSFER");

    const lines = [
      ...new Set(options.map((option) => option.line)),
    ];

    return res.json({
      origin,
      destination,
      totalOptions: options.length,
      hasDirectRoutes: directOptions.length > 0,
      hasTransferRoutes: transferOptions.length > 0,
      totalLines: lines.length,
      lines,
      options,
    });

  } catch (error) {
    console.error("Erro ao planejar trajeto:", error);

    return res.status(500).json({
      error: "Não foi possível planejar o trajeto.",
    });
  }
}
