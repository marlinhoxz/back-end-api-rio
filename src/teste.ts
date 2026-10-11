
import { getShapesPoints } from "./services/gtfs.services.js";

const points = await getShapesPoints("labi");

console.log("Total de pontos:", points.length);
console.log("Primeiro ponto:", points[0]);
console.log("Último ponto:", points.at(-1));
