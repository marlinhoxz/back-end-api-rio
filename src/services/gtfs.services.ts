import { readCsv } from "./gtfs.routes.services.js";

export type ShapePoint = {
  latitude: number;
  longitude: number;
  sequence: number;
};

async function buildShapesIndex(): Promise<Map<string, ShapePoint[]>> {
  const rows = await readCsv("shapes.txt", [
    "shape_id",
    "shape_pt_sequence",
    "shape_pt_lat",
    "shape_pt_lon",
  ]);

  const index = new Map<string, ShapePoint[]>();

  for (const row of rows) {
    const points = index.get(row.shape_id) ?? [];

    points.push({
      sequence: Number(row.shape_pt_sequence),
      latitude: Number(row.shape_pt_lat),
      longitude: Number(row.shape_pt_lon),
    });

    index.set(row.shape_id, points);
  }

  for (const points of index.values()) {
    points.sort((a, b) => a.sequence - b.sequence);
  }

  return index;
}

let shapesPromise: Promise<Map<string, ShapePoint[]>> | null = null;

export async function getShapesPoints(shapeId: string): Promise<ShapePoint[]> {
  shapesPromise ??= buildShapesIndex().catch((error) => {
    shapesPromise = null;
    throw error;
  });

  const shapes = await shapesPromise;
  return shapes.get(shapeId) ?? [];
}