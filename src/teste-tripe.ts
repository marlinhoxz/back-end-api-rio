
import { readFile } from "node:fs/promises";

const content = await readFile(
  new URL("./data/gtfs/trips.txt", import.meta.url),
  "utf-8",
);

const [header, ...rows] = content.trim().split(/\r?\n/);

const columns = header.split(",");

const routeIndex = columns.indexOf("route_id");
const tripIndex = columns.indexOf("trip_id");
const headsignIndex = columns.indexOf("trip_headsign");
const directionIndex = columns.indexOf("direction_id");
const shapeIndex = columns.indexOf("shape_id");

const trips = rows
  .map((row) => {
    const values = row.split(",");

    return {
      routeId: values[routeIndex],
      tripId: values[tripIndex],
      headsign: values[headsignIndex],
      directionId: values[directionIndex],
      shapeId: values[shapeIndex],
    };
  })
  .filter((trip) => trip.routeId === "O0485AAA0A");

console.table(trips.slice(0, 30));

console.log(
  "Sentidos encontrados:",
  [...new Set(trips.map((trip) => trip.directionId))],
);

console.log(
  "Trajetos encontrados:",
  [...new Set(trips.map((trip) => trip.shapeId))],
);
