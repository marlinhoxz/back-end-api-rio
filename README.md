# 🚌 API Rio Ônibus

Backend desenvolvido em **Node.js, Express e TypeScript** para consultar, tratar e disponibilizar dados de ônibus do Rio de Janeiro.

O projeto faz parte de uma aplicação de acompanhamento de ônibus em tempo real, inspirada em aplicativos como o Moovit. O frontend será desenvolvido separadamente com Next.js e consumirá esta API através de requisições HTTP.

O backend atua como uma camada intermediária entre a aplicação e os serviços de mobilidade, centralizando a obtenção dos dados, a normalização, os filtros, o cache e a identificação dos trajetos utilizando dados GTFS.

> 🚧 **Projeto em desenvolvimento.**

---

## 📌 Objetivo

Construir uma API organizada e escalável que permita consultar a localização dos ônibus e identificar seus trajetos para exibição em um mapa.

O projeto busca evitar que o frontend dependa diretamente da API externa, mantendo as regras de negócio no backend.

Principais objetivos:

- Consultar as posições dos veículos.
- Normalizar os dados recebidos da API externa.
- Armazenar os dados dos ônibus em cache em memória.
- Disponibilizar filtros por linha e área geográfica.
- Identificar os trajetos dos ônibus utilizando GTFS.
- Retornar as coordenadas necessárias para desenhar as rotas no mapa.
- Preparar a API para integração com o frontend Next.js.

---

## 🏗️ Arquitetura

O projeto utiliza uma arquitetura organizada por responsabilidades.

```text
Frontend Next.js
       │
       │ HTTP
       ▼
Backend Express
       │
       ├── Routes
       │
       ├── Controllers
       │
       ├── Services
       │    ├── Consulta e normalização dos ônibus
       │    ├── Cache em memória
       │    ├── Leitura dos dados GTFS
       │    └── Identificação dos trajetos
       │
       ├── Types
       │
       └── Utils
            └── Cálculos geográficos
```

### Responsabilidades das camadas

**Routes**

Definem os endpoints disponíveis e encaminham as requisições para os controllers.

**Controllers**

Responsáveis pela camada HTTP: recebem as requisições, chamam os serviços e retornam respostas com os status e os dados apropriados.

**Services**

Concentram as regras de negócio, a consulta e normalização dos dados, o gerenciamento do cache e o processamento dos trajetos GTFS.

**Types**

Definem os formatos dos dados utilizados pela aplicação, incluindo ônibus, filtros e respostas da API externa.

**Utils**

Reúnem funções auxiliares reutilizáveis, como os cálculos de distância entre a posição de um ônibus e um trajeto.

---

## 📂 Estrutura do projeto

A estrutura abaixo representa os principais arquivos e diretórios utilizados atualmente. Novos módulos podem ser adicionados conforme o projeto evoluir.

```text
back-end-api-rio/
│
├── src/
│   ├── controllers/
│   │   └── bus.controllers.ts
│   │
│   ├── routes/
│   │   └── bus.routes.ts
│   │
│   ├── services/
│   │   ├── bus.services.ts
│   │   ├── bus.cache.services.ts
│   │   ├── bus-route.services.ts
│   │   ├── gtfs.routes.services.ts
│   │   └── gtfs.services.ts
│   │
│   ├── types/
│   │   ├── bus.ts
│   │   └── bus-api.ts
│   │
│   ├── utils/
│   │   └── geo.ts
│   │
│   ├── data/
│   │   └── gtfs/
│   │       └── arquivos GTFS
│   │
│   └── server.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔌 API externa de mobilidade

O backend consulta o serviço de geolocalização de veículos da Mobilidade Rio.

Endpoint externo:

```text
https://its.mobilidade.rio/v1/geolocalizacao/veiculos
```

A API externa fornece informações sobre os veículos, como:

- Identificador do veículo.
- Serviço ou linha.
- Latitude e longitude.
- Velocidade.
- Direção.
- Data e hora dos registros.
- Identificadores relacionados à linha, viagem e trajeto, quando disponibilizados.

A consulta pode envolver paginação. O backend percorre as páginas disponíveis para reunir os veículos retornados pelo serviço externo.

Os dados são normalizados para o formato utilizado pela aplicação antes de serem disponibilizados ao frontend.

---

## ⚡ Cache em memória

O backend possui um serviço de cache para manter os dados dos ônibus disponíveis para consulta.

O cache armazena:

- Lista de ônibus.
- Estado da atualização.
- Data e hora da última atualização bem-sucedida.

Os estados utilizados são:

| Estado | Significado |
|---|---|
| `loading` | Dados ainda estão sendo carregados |
| `ready` | Cache disponível |
| `error` | Ocorreu um erro na atualização |

O cache permite que diferentes requisições consultem os dados já armazenados, evitando repetir a consulta externa em cada acesso comum ao endpoint.

O projeto também possui um endpoint para consultar o estado do cache.

> **Observação:** o cache é mantido em memória. Os dados são perdidos quando o processo do servidor é reiniciado e não são compartilhados automaticamente entre múltiplas instâncias do backend.

---

## 🧩 Tipagem com TypeScript

O projeto utiliza TypeScript para representar os dados e reduzir erros durante o desenvolvimento.

### `types/bus-api.ts`

Representa o formato dos dados recebidos da API externa.

### `types/bus.ts`

Representa o modelo normalizado de ônibus utilizado internamente pela aplicação.

O modelo inclui informações como:

```text
id
line
latitude
longitude
speed
direction
directionName
datetime
routeId
tripId
shapeId
```

Os campos relacionados ao GTFS permitem relacionar um veículo aos dados de linha, viagem e geometria do trajeto.

A separação entre o tipo externo e o tipo interno facilita alterações futuras na integração com a API de mobilidade.

---

## 🔎 Filtros disponíveis

O endpoint de ônibus aceita parâmetros de consulta.

| Parâmetro | Finalidade |
|---|---|
| `minuto_utc` | Consultar os dados referentes a um minuto UTC aceito pela API externa |
| `servico` | Filtrar por serviço ou linha |
| `sistema` | Filtrar pelo sistema de transporte |
| `modo` | Filtrar pelo modo aceito, como `onibus` ou `brt` |
| `minLat` | Latitude mínima da área |
| `maxLat` | Latitude máxima da área |
| `minLon` | Longitude mínima da área |
| `maxLon` | Longitude máxima da área |

Os filtros geográficos são utilizados para restringir os veículos a uma região delimitada por coordenadas.

Exemplo:

```http
GET /api/buses?servico=825
```

Exemplo com área geográfica:

```http
GET /api/buses?minLat=-23&maxLat=-22.8&minLon=-43.7&maxLon=-43.2
```

Os filtros que consultam diretamente a API externa podem seguir um fluxo diferente dos filtros aplicados aos dados já armazenados no cache.

---

## 🗺️ Integração com GTFS

O projeto utiliza arquivos GTFS para relacionar os ônibus às geometrias dos trajetos.

Entre os arquivos utilizados estão:

| Arquivo | Finalidade |
|---|---|
| `routes.txt` | Informações sobre as linhas e rotas |
| `trips.txt` | Informações sobre viagens e seus trajetos |
| `shapes.txt` | Coordenadas que representam a geometria dos trajetos |

Os dados GTFS são lidos e organizados em índices em memória para facilitar as consultas.

### Identificação do trajeto

O serviço de trajetos utiliza informações do ônibus, como `routeId` e `shapeId`, para encontrar uma geometria compatível.

Quando existe um `shapeId` fornecido pela API e ele corresponde a um trajeto encontrado no GTFS, esse identificador pode ser utilizado diretamente.

O serviço também calcula a distância entre a posição do veículo e os trajetos candidatos, permitindo comparar as opções encontradas.

### Coordenadas do trajeto

O endpoint de trajeto retorna um array chamado `path`, contendo os pontos ordenados da geometria GTFS.

Cada ponto possui:

```json
{
  "sequence": 0,
  "latitude": -22.90147,
  "longitude": -43.56074
}
```

Essas coordenadas poderão ser utilizadas pelo frontend para desenhar a linha do trajeto em um mapa.

---

## 📡 Endpoints disponíveis

A tabela apresenta os endpoints implementados no roteador de ônibus.

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/buses` | Consulta ônibus e permite aplicar filtros |
| `GET` | `/api/buses/status` | Consulta o estado do cache |
| `GET` | `/api/buses/:id/route` | Identifica o trajeto do ônibus e retorna suas coordenadas |

### 1. Buscar ônibus

```http
GET /api/buses
```

URL local:

```text
http://localhost:3001/api/buses
```

Para consultar uma linha específica:

```text
http://localhost:3001/api/buses?servico=825
```

A resposta contém os ônibus encontrados, com suas informações normalizadas.

### 2. Consultar o estado do cache

```http
GET /api/buses/status
```

URL local:

```text
http://localhost:3001/api/buses/status
```

Esse endpoint permite verificar o estado do cache, a quantidade de veículos armazenados e o horário da última atualização.

### 3. Buscar o trajeto de um ônibus

```http
GET /api/buses/:id/route
```

Exemplo:

```text
http://localhost:3001/api/buses/A2-005/route
```

Exemplo simplificado da resposta:

```json
{
  "busId": "A2-005",
  "line": "825",
  "shapeId": "O0825AAA0AIDU02",
  "distanceMeters": 0.93,
  "source": "api_shape",
  "path": [
    {
      "sequence": 0,
      "latitude": -22.90147,
      "longitude": -43.56074
    },
    {
      "sequence": 1,
      "latitude": -22.90075,
      "longitude": -43.56092
    }
  ]
}
```

Os valores de `distanceMeters` e os pontos de `path` variam conforme os dados consultados. O exemplo apresenta apenas uma pequena parte da geometria real.

O campo `source` indica se o trajeto selecionado veio do identificador fornecido pela API (`api_shape`) ou de uma alternativa encontrada pelo serviço (`route_fallback`).

---

## ⚠️ Tratamento de erros HTTP

O backend utiliza códigos HTTP para representar diferentes situações.

| Código | Situação |
|---|---|
| `400` | Parâmetros inválidos |
| `404` | Ônibus ou trajeto não encontrado |
| `500` | Erro interno durante o processamento do trajeto |
| `502` | Falha ao consultar os dados externos |
| `503` | Dados do cache ainda indisponíveis |

As respostas de erro incluem uma mensagem em JSON para ajudar o cliente a identificar o problema.

---

## 🛠️ Tecnologias utilizadas

- Node.js
- Express
- TypeScript
- JavaScript ES Modules
- API Mobilidade Rio
- GTFS
- CSV para leitura dos arquivos de transporte

---

## ▶️ Como executar o projeto

### 1. Clonar o repositório

```bash
git clone https://github.com/marlinhoxz/back-end-api-rio.git
```

### 2. Entrar na pasta

```bash
cd back-end-api-rio
```

### 3. Instalar as dependências

```bash
npm install
```

### 4. Preparar os dados GTFS

Disponibilize os arquivos GTFS necessários no diretório de dados utilizado pelo projeto:

```text
src/data/gtfs/
```

Confirme que os arquivos esperados, especialmente `routes.txt`, `trips.txt` e `shapes.txt`, estão disponíveis.

### 5. Iniciar o servidor

```bash
npm run dev
```

O servidor utiliza a porta `3001` na configuração atual.

Base local:

```text
http://localhost:3001
```

Endpoints para teste:

```text
http://localhost:3001/api/buses
http://localhost:3001/api/buses/status
http://localhost:3001/api/buses/ID_DO_ONIBUS/route
```

Comandos de execução npm run dev.

---

## 🔄 Fluxo dos dados

O fluxo principal de consulta dos ônibus é:

```text
API Mobilidade Rio
        ↓
Busca das páginas disponíveis
        ↓
Normalização dos dados
        ↓
Cache em memória
        ↓
Requisição HTTP do frontend
        ↓
Routes
        ↓
Controller
        ↓
Services
        ↓
Resposta JSON
        ↓
Frontend Next.js
```

Para a identificação do trajeto:

```text
Identificador do ônibus
        ↓
Consulta ao cache
        ↓
Dados routeId / tripId / shapeId
        ↓
Consulta aos índices GTFS
        ↓
Seleção da geometria
        ↓
Cálculo da distância
        ↓
Retorno do path
        ↓
Frontend desenha o trajeto no mapa
```

---

## 🚧 Próximos passos

- [x] Criar a estrutura inicial do backend.
- [x] Integrar a consulta à API de mobilidade.
- [x] Normalizar os dados dos veículos.
- [x] Implementar filtros por parâmetros.
- [x] Implementar filtros por área geográfica.
- [x] Criar o cache em memória e o endpoint de status.
- [x] Ler e indexar os dados GTFS.
- [x] Identificar o trajeto de um ônibus.
- [x] Retornar as coordenadas do trajeto pelo endpoint.
- [ ] Revisar e documentar todos os parâmetros e respostas da API.
- [ ] Criar testes automatizados.
- [ ] Melhorar monitoramento e tratamento de falhas.
- [ ] Avaliar estratégias de atualização e persistência do cache.
- [ ] Criar o frontend em Next.js.
- [ ] Integrar o frontend ao backend.
- [ ] Exibir os ônibus no mapa.
- [ ] Desenhar os trajetos e acompanhar a movimentação dos veículos.
- [ ] Preparar a aplicação para produção.

---

## 📚 Status atual

O backend já possui consulta e normalização dos dados dos ônibus, cache em memória, filtros e integração com arquivos GTFS.

O endpoint de trajeto já retorna a geometria necessária para que o frontend desenhe uma linha no mapa.

A próxima fase será desenvolver o frontend em Next.js e conectá-lo à API existente.

O projeto continua em desenvolvimento, com foco em organização, TypeScript, separação de responsabilidades e evolução incremental.

---

## 👨‍💻 Autor

**Marlon**

GitHub: [@marlinhoxz](https://github.com/marlinhoxz)

Repositório: [back-end-api-rio](https://github.com/marlinhoxz/back-end-api-rio)


Repositório Referencia: [rio-onibus-tracker](https://github.com/apps-rafa/rio-onibus-tracker)
