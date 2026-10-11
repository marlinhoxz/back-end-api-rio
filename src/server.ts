import express from "express";
import busRouter from "./routes/bus.routes.js";
import { refreshBusCache } from "./services/bus.services.js";
import lineRouter from "./routes/line.routes.js";


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



app.get("/", (req, res) => {
  res.send("API RIO ONIBUS FUNCIONADO");
});

app.use("/api/buses", busRouter);


app.use('/api/lines', lineRouter)


app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

void updateCacheSafely().catch(() => {});

setInterval(() => {
  void updateCacheSafely().catch(() => {});
}, CACHE_INTERVAL);
