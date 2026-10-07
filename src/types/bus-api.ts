// AQUI SÃO OS DADOS QUE ESTOU RECEBENDO DIRETO DA API

export type BusApi = {
  id_veiculo: string;
  fornecedor: string;
  sistema: string;
  modo: string;
  servico: string;
  sentido: string;
  latitude: number;
  longitude: number;
  velocidade: number;
  direcao: number;
  route_id: string;
  trip_id: string;
  shape_id: string;
  datetime: string;
  datetime_servidor: string;
  id_equipamento: string | null;
  sequencial_equipamento: number | null;
  fonte_posicao: string | null;
  fonte_velocidade: string | null;
  qualidade_sinal: string | null;
  altitude: number | null;
  quantidade_satelites: number | null;
  hdop: number | null;
  vdop: number | null;
  pdop: number | null;
  id_registro: string | null;
  datetime_envio: string | null;
  id_viagem_planejada: string | null;
  direction_id: number | null;
};



export type BusApiResponse = {
  minuto_utc: string;
  data: BusApi[];
  next_cursor: string | null;
  providers_status: Record<string, string>;
}