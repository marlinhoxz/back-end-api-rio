import { getShapesPoints } from "./services/gtfs.services.js";

console.time("primeira");
const points = await getShapesPoints("labi");
console.timeEnd("primeira");

console.log("Total de pontos:", points.length);
console.log("Primeiro ponto:", points[0]);
console.log("Último ponto:", points.at(-1));

console.time("segunda");
await getShapesPoints("yyzu");
console.timeEnd("segunda");