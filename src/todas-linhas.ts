import { getRouteDirections, readCsv } from "./services/gtfs.routes.services.js";

const routes = await readCsv("routes.txt", ["route_short_name"]);
const lines = [...new Set(routes.map((route) => route.route_short_name))];

for (const line of lines) {
  const directions = await getRouteDirections(line);
  const hasEmptyDestination = directions.some((d) => d.destination === "");

  if (directions.length !== 2 || hasEmptyDestination) {
    console.log(line, directions);
  }
}

console.log("Linhas verificadas:", lines.length);