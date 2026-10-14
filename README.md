# 🚌 API Rio Ônibus

Backend robusto e de alta performance desenvolvido em **Node.js, Express e TypeScript** para rastreamento de ônibus em tempo real e planejamento de rotas multimodais porta a porta no Rio de Janeiro, inspirado em aplicações como o **Moovit**.

O backend atua como orquestrador entre os dados em tempo real da **Mobilidade Rio**, a base estática oficial de transporte público (**GTFS**) e serviços de roteamento a pé (**OSRM**), entregando trajetos prontos para renderização em mapas no frontend Next.js.

---

## 📌 Principais Funcionalidades

* **🚶‍♂️🚌🚶‍♂️ Planejamento de Rotas Multimodal Porta a Porta (`/api/routes/plan`):**
  * Calcula a jornada completa: **Caminhada até o ponto $\rightarrow$ Trajeto no Ônibus $\rightarrow$ Caminhada até o destino**.
  * Retorna os trajetos padronizados em **Etapas (`legs`)**, facilitando o desenho no mapa (linhas pontilhadas para pedestre e sólidas para ônibus).
  * Inclui opção direta **100% a pé** para trajetos curtos ($\le 800\text{m}$) ou quando não há ônibus viável.
* **📍 Rastreamento de Ônibus em Tempo Real (`/api/buses`):**
  * Polling automatizado a cada 30 segundos consumindo dados de GPS oficiais de todos os ônibus e BRTs do Rio de Janeiro.
  * Normalização dos dados e filtros avançados por linha, modo (`onibus` ou `brt`) e área geográfica (*Bounding Box*).
  * Associação de veículos em circulação diretamente nas opções de rotas planejadas.
* **🗺️ Integração Completa com GTFS Estático:**
  * Leitura e indexação em memória de linhas (`routes.txt`), viagens (`trips.txt`), paradas (`stops.txt`), horários/sequências (`stop_times.txt`) e geometrias dos trajetos (`shapes.txt`).
  * Identificação automática do trajeto (*Shape*) percorrido por um ônibus em tempo real.
  * Corte inteligente e progressivo do traçado do ônibus entre o ponto de embarque e desembarque.
* **⚡ Alta Performance e Resiliência:**
  * **Pré-carregamento no Boot (`preloadGtfs`):** Índices pesados (incluindo 85MB de conexões) são carregados na inicialização do servidor, garantindo respostas rápidas já na primeira consulta.
  * **Filtro Espacial O(1) com Bounding Box:** Reduz o cálculo de distâncias trigonométricas em mais de 98% das paradas.
  * **Resiliência a Falhas Externas:** Fallback geodésico automático com estimativa de velocidade humana (~1.25 m/s) caso o serviço de caminhada externo falhe ou sofra *rate limit*.

---

## 🏗️ Arquitetura

O projeto adota uma arquitetura limpa em camadas com separação clara de responsabilidades:

```text
       Frontend Next.js (http://localhost:3000)
                         │
                         │ HTTP / JSON
                         ▼
             Backend Express (Porta 3001)
                         │
     ┌───────────────────┼───────────────────┐
     ▼                   ▼                   ▼
  Routes            Controllers           Services
(/api/routes)   (Validação HTTP)   (Regras de Negócio)
     │                   │                   │
     └───────────────────┴───────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   Cache GPS       Índices GTFS      Caminhada OSRM
  (Tempo Real)      (Memória)       (com Fallback)
```

### 📂 Estrutura de Pastas

```text
backend-gtfs/
├── src/
│   ├── controllers/
│   │   ├── bus.controllers.ts            # Manipulação de requisições de ônibus em tempo real e cache
│   │   ├── line.controllers.ts           # Consulta de sentidos e destinos por linha
│   │   └── route-planning.controllers.ts # Controlador de planejamento de rotas (/api/routes/plan)
│   │
│   ├── routes/
│   │   ├── bus.routes.ts                 # Definição das rotas /api/buses
│   │   ├── line.routes.ts                # Definição das rotas /api/lines
│   │   └── route-planning.routes.ts      # Definição das rotas /api/routes
│   │
│   ├── services/
│   │   ├── bus.services.ts               # Consumo da API externa de GPS (Mobilidade Rio com paginação)
│   │   ├── bus.cache.services.ts         # Cache em memória e estado dos ônibus ativos
│   │   ├── bus-route.services.ts         # Casamento da posição do ônibus com o shape GTFS
│   │   ├── gtfs.routes.services.ts       # Leitura e indexação de routes.txt e trips.txt
│   │   ├── gtfs.stop.services.ts         # Leitura e indexação de stops.txt
│   │   ├── gtfs.shapes.services.ts       # Indexação e fatiamento do shape do ônibus entre paradas
│   │   ├── gtfs.connections.services.ts  # Indexação das paradas por viagem (stop_times.txt)
│   │   ├── route-planning.services.ts    # Motor central de planejamento de viagem multimodal
│   │   └── walking-route.services.ts     # Roteamento de caminhada (OSRM com fallback local)
│   │
│   ├── types/
│   │   ├── bus.ts                        # Tipos internos de ônibus e filtros
│   │   └── bus-api.ts                    # Tipos brutos da API externa de GPS
│   │
│   ├── utils/
│   │   ├── geo.ts                        # Fórmulas geográficas (Haversine e ponto a segmento)
│   │   └── validate-date.ts              # Validações de data/hora UTC
│   │
│   ├── data/
│   │   └── gtfs/                         # Arquivos GTFS oficiais da cidade do Rio de Janeiro
│   │
│   └── server.ts                         # Setup do servidor Express, CORS, Preload e Timers
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📡 Endpoints da API

### 1. Planejamento de Rotas Multimodal
Calcula opções de trajeto para o usuário ir da sua coordenada de origem até a coordenada de destino.

```http
GET /api/routes/plan?originLat={lat}&originLon={lon}&destinationLat={lat}&destinationLon={lon}&radius={metros}
```

* **Parâmetros de Query:**
  * `originLat` *(obrigatório)*: Latitude de origem.
  * `originLon` *(obrigatório)*: Longitude de origem.
  * `destinationLat` *(obrigatório)*: Latitude de destino.
  * `destinationLon` *(obrigatório)*: Longitude de destino.
  * `radius` *(opcional, default: `500`)*: Raio máximo em metros para localizar paradas de embarque e desembarque (aceita de 100 a 3000m).

* **Exemplo de Requisição:**
```http
GET /api/routes/plan?originLat=-22.9068&originLon=-43.1729&destinationLat=-22.9671&destinationLon=-43.1812
```

* **Exemplo de Resposta:**
```json
{
  "origin": { "latitude": -22.9068, "longitude": -43.1729 },
  "destination": { "latitude": -22.9671, "longitude": -43.1812 },
  "totalOptions": 2,
  "totalLines": 2,
  "lines": ["415", "455"],
  "options": [
    {
      "line": "415",
      "destination": "Usina",
      "directionId": "0",
      "totalTrips": 1,
      "boardingStop": {
        "id": "100234",
        "name": "Ponto de Ônibus Central",
        "latitude": -22.9075,
        "longitude": -43.1735,
        "distanceMeters": 95
      },
      "alightingStop": {
        "id": "100892",
        "name": "Ponto de Ônibus Copacabana",
        "latitude": -22.9665,
        "longitude": -43.1808,
        "distanceMeters": 80
      },
      "totalWalkingDistanceMeters": 175,
      "totalWalkingDurationSeconds": 140,
      "realtimeBusesCount": 3,
      "legs": [
        {
          "type": "WALK",
          "instruction": "Caminhe até o ponto Ponto de Ônibus Central",
          "distanceMeters": 95,
          "durationSeconds": 76,
          "from": { "name": "Sua localização", "latitude": -22.9068, "longitude": -43.1729 },
          "to": { "name": "Ponto de Ônibus Central", "latitude": -22.9075, "longitude": -43.1735 },
          "path": [
            { "latitude": -22.9068, "longitude": -43.1729 },
            { "latitude": -22.9075, "longitude": -43.1735 }
          ]
        },
        {
          "type": "BUS",
          "instruction": "Embarque na linha 415 sentido Usina",
          "line": "415",
          "destination": "Usina",
          "directionId": "0",
          "from": { "id": "100234", "name": "Ponto de Ônibus Central", "latitude": -22.9075, "longitude": -43.1735 },
          "to": { "id": "100892", "name": "Ponto de Ônibus Copacabana", "latitude": -22.9665, "longitude": -43.1808 },
          "path": [
            { "latitude": -22.9075, "longitude": -43.1735 },
            { "latitude": -22.9350, "longitude": -43.1770 },
            { "latitude": -22.9665, "longitude": -43.1808 }
          ],
          "realtimeBuses": [
            {
              "id": "A29012",
              "speed": 34,
              "latitude": -22.9020,
              "longitude": -43.1715,
              "directionName": "Grajau -> Usina"
            }
          ]
        },
        {
          "type": "WALK",
          "instruction": "Desembarque em Ponto de Ônibus Copacabana e caminhe até o destino",
          "distanceMeters": 80,
          "durationSeconds": 64,
          "from": { "name": "Ponto de Ônibus Copacabana", "latitude": -22.9665, "longitude": -43.1808 },
          "to": { "name": "Destino", "latitude": -22.9671, "longitude": -43.1812 },
          "path": [
            { "latitude": -22.9665, "longitude": -43.1808 },
            { "latitude": -22.9671, "longitude": -43.1812 }
          ]
        }
      ]
    }
  ]
}
```

---

### 2. Ônibus em Tempo Real (GPS)
Consulta os veículos ativos no cache de memória, com suporte a filtros combinados.

```http
GET /api/buses
```

* **Filtros suportados:**
  * `servico`: Número/nome da linha (ex: `?servico=415`).
  * `modo`: Modo de transporte (`onibus` ou `brt`).
  * `minLat`, `maxLat`, `minLon`, `maxLon`: Filtro de área geográfica (*Bounding Box*).
  * `minuto_utc`: Filtrar por minuto específico (formato ISO/UTC).

---

### 3. Status do Cache
Informa a saúde do cache em memória e o total de veículos monitorados.

```http
GET /api/buses/status
```

* **Exemplo de Resposta:**
```json
{
  "status": "ready",
  "totalBuses": 2450,
  "lastUpdate": "2026-10-14T19:30:15.120Z"
}
```

---

### 4. Trajeto do Ônibus Específico
Retorna o traçado GTFS e a distância perpendicular do veículo em relação ao trajeto.

```http
GET /api/buses/:id/route
```

---

### 5. Sentidos e Destinos de uma Linha
Consulta os sentidos atendidos por uma linha pública no GTFS.

```http
GET /api/lines/:line/directions
```

* **Exemplo:** `GET /api/lines/415/directions`
* **Exemplo de Resposta:**
```json
[
  { "directionId": "0", "destination": "Usina", "shapeId": "O0415AAA0AIDU01" },
  { "directionId": "1", "destination": "Leblon", "shapeId": "O0415AAA0AVOL01" }
]
```

---

## 🛠️ Tecnologias Utilizadas

* **Runtime:** [Node.js](https://nodejs.org/) (ES Modules)
* **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
* **Framework:** [Express 5](https://expressjs.com/)
* **Execução & Watch:** [tsx](https://github.com/privatenumber/tsx)
* **Parser de Dados:** [csv-parse](https://csv.js.org/parse/)
* **Roteamento de Pedestres:** [OSRM (Open Source Routing Machine)](http://project-osrm.org/)
* **Fontes de Dados:**
  * Dados em Tempo Real: [API da Mobilidade Rio](https://dados.mobilidade.rio/)
  * Dados Estáticos de Transporte: Arquivos oficiais **GTFS** do Rio de Janeiro

---

## ▶️ Como Executar o Projeto Localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/marlinhoxz/back-end-api-rio.git
cd back-end-api-rio
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Garantir os arquivos GTFS
Certifique-se de que a pasta `src/data/gtfs/` contém os arquivos necessários:
* `routes.txt`
* `trips.txt`
* `stops.txt`
* `stop_times.txt`
* `shapes.txt`

### 4. Executar em modo desenvolvimento
```bash
npm run dev
```

O servidor iniciará em `http://localhost:3001`. No terminal, você verá os logs de inicialização e o pré-carregamento dos dados GTFS em memória.

---

## 🎨 Dicas para Integração com o Frontend (Next.js)

Se estiver construindo a interface com **Next.js**, **Mapbox GL**, **Leaflet** ou **Google Maps**:

1. **Desenhando a Rota no Mapa:**
   * Basta iterar sobre o array `legs` de cada opção de rota:
   ```typescript
   legs.map((leg) => {
     if (leg.type === "WALK") {
       // Linha pontilhada azul/cinza para caminhada
       return <Polyline positions={leg.path} dashArray="6, 8" color="#64748b" />;
     }
     if (leg.type === "BUS") {
       // Linha contínua com a cor da linha para o ônibus
       return <Polyline positions={leg.path} weight={5} color="#2563eb" />;
     }
   });
   ```
2. **Cards de Instrução:**
   * Utilize o atributo `leg.instruction` diretamente para renderizar a lista de passos (ex: *"Caminhe até o ponto Central"* $\rightarrow$ *"Embarque na linha 415 sentido Usina"*).
3. **Ônibus em Tempo Real:**
   * O array `leg.realtimeBuses` já entrega a localização dos veículos ativos aproximando-se do ponto para você exibir ícones animados de ônibus no mapa.

---

## 🚧 Próximos Passos (Roadmap)

- [x] Consulta de GPS de veículos em tempo real com paginação e normalização.
- [x] Cache em memória com atualização automática em segundo plano.
- [x] Leitura e indexação completa de arquivos GTFS.
- [x] Algoritmo de roteamento multimodal porta a porta (Caminhada $\rightarrow$ Ônibus $\rightarrow$ Caminhada).
- [x] Pré-carregamento no boot e otimização geoespacial com Bounding Box.
- [x] Estrutura padronizada de `legs` para o mapa.
- [x] Rotas com baldeação/conexão (viagens com 2 ônibus).
- [ ] Estimativa de tempo de chegada (ETA) dinâmico baseado na velocidade real dos ônibus.
- [ ] Migração opcional da indexação do GTFS para SQLite embutido (`better-sqlite3`) para economia de memória RAM.

---

## 👨‍💻 Autor

**Marlon**

* GitHub: [@marlinhoxz](https://github.com/marlinhoxz)
* Repositório: [back-end-api-rio](https://github.com/marlinhoxz/back-end-api-rio)
* Repositório Referência: [rio-onibus-tracker](https://github.com/apps-rafa/rio-onibus-tracker)

