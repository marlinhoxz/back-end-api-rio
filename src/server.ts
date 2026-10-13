import express from "express";
import busRouter from "./routes/bus.routes.js";
import { refreshBusCache } from "./services/bus.services.js";
import lineRouter from "./routes/line.routes.js";
import { getRouteDirections } from "./services/gtfs.routes.services.js";
import { getShapesPoints } from "./services/gtfs.services.js";


const app = express();
const PORT = 3001;
const CACHE_INTERVAL = 30_000;
let isRefreshing = false;

async function updateCacheSafely() {
  if (isRefreshing) {
    console.log("Atualizção já em andamento. Ignorando..");
    return;
  }
  isRefreshing = true;

try {
  await refreshBusCache();
} catch (err) {
  console.error("Falha na atualização do Cache", err);
} finally {
  isRefreshing = false;
}
}

// Resolve o problema do primeiro usuario ter que esperar mais tempo para ter acesso aos dados.
async function preloadGtfs() {
  
  try {
    await Promise.all(([getRouteDirections(''), getShapesPoints('')]))
    console.log('GTFS carregado em memória')
  } catch (error) {
    console.error("Falha ao pré-carregar o GTFS", error)
  }
}




app.get("/", (req, res) => {
  res.send("API RIO ONIBUS FUNCIONADO");
});

app.use("/api/buses", busRouter);


app.use('/api/lines', lineRouter)


app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

void updateCacheSafely().catch(() => {});

void preloadGtfs()

setInterval(() => {
  void updateCacheSafely().catch(() => {});
}, CACHE_INTERVAL);
