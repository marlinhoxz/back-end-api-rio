import express from "express";
import busRouter from './routes/bus.routes.js'

const app = express();
const PORT = 3001;

app.get("/", (req, res) => {
  res.send("API RIO ONIBUS FUNCIONADO");
});

app.use("/api/buses", busRouter )


app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
