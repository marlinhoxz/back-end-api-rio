import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const shapesPath = path.resolve(currentDirectory, "../data/gtfs/shapes.txt");

export type ShapePoint = {
  latitude: number;
  longitude: number;
  sequence: number;
};

export async function getShapesPoints(shapdeID: string): Promise<ShapePoint[]> {
  const content = await readFile(shapesPath, "utf-8");

  const rows = content.trim().split(/\r?\n/);
  const [, ...dateRows] = rows;

  const points: ShapePoint[] = [];

  for (const row of dateRows) {
    const [currentShapeID, sequence, latitude, longitude] = row.split(",");

    if (currentShapeID !== shapdeID) {
      continue;
    }
    points.push({
      sequence: Number(sequence),
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
  }

  return points.sort((a, b) => a.sequence - b.sequence);
}
