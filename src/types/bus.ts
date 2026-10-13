//Estou transformando os dados que recebo da Api externa e transformando ela em apenas 1 veiculo
//Evitando qualquer problema futuro caso a api mude o dado ja fica padronizado na aplicação

//Aicionado tambem um objeto para filtrar os parametros, se não seria necessário criar uma função com 9 parametros.

export type Bus = {
    id: string
    line: string
    latitude: number
    longitude: number
    speed: number
    direction: number
    directionName: string
    datetime: string
    routeId: string
    tripId: string
    shapeId: string
}

export type Modo = 'onibus' | 'brt'

export type BusFilters = {
  minuto_utc?: string;
  servico?: string;
  sistema?: string
  modo?: Modo
  minLat?: number
  maxLat?: number
  minLon?: number
  maxLon?: number
};