import { getRouteDirections } from "./services/gtfs.routes.services.js";

await Promise.all([getRouteDirections("485"), getRouteDirections("635")]);