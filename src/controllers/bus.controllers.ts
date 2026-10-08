//Aqui meu Controller faz o GET para a api, e logo em seguida padronizo os dados para minha aplicação

import type { BusApiResponse } from "../types/bus-api.js";
import type { Bus, BusFilters } from "../types/bus.js";

const API_URL = "https://its.mobilidade.rio/v1/geolocalizacao/veiculos";

export async function getAllBuses(filter: BusFilters) {
  const url = new URL(API_URL);

  if (filter.minuto_utc) {
    url.searchParams.set("minuto_utc", filter.minuto_utc);
  }
  if (filter.servico) {
    url.searchParams.set("servico", filter.servico);
  }
  if (filter.sistema) {
    url.searchParams.set("sistema", filter.sistema);
  }
  if (filter.modo) {
    url.searchParams.set("modo", filter.modo);
  }

  console.log("url", url.toString());

  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`Erro na API: ${response.status}`);
  }

  const data: BusApiResponse = await response.json();

  const buses: Bus[] = data.data.map((bus) => ({
    id: bus.id_veiculo,
    line: bus.servico,
    latitude: bus.latitude,
    longitude: bus.longitude,
    speed: bus.velocidade,
    direction: bus.direcao,
    directionName: bus.sentido,
    datetime: bus.datetime,
  }));

  return buses;
}
