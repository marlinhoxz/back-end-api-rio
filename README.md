# 🚌 API Rio Ônibus

Backend responsável por fornecer uma API própria para consulta e tratamento de dados de ônibus do Rio de Janeiro.

O projeto faz parte de uma aplicação maior, na qual o **frontend será desenvolvido separadamente em Next.js** e consumirá esta API através de HTTP.

Atualmente, o backend funciona como uma camada intermediária entre o frontend e a API externa de mobilidade do Rio, permitindo centralizar regras de negócio, filtros, tipagem e normalização dos dados.

> 🚧 **Projeto em desenvolvimento**

---

## 📌 Objetivo

O objetivo deste projeto é construir uma API backend organizada e escalável para trabalhar com informações de ônibus do Rio de Janeiro.

A ideia é evitar que o frontend consuma diretamente a API externa.

O fluxo planejado é:

```text
Frontend Next.js
       ↓
HTTP Request
       ↓
Backend Express
       ↓
Routes
       ↓
Controllers
       ↓
Services
       ↓
API Mobilidade Rio
       ↓
Normalização dos dados
       ↓
JSON
       ↓
Frontend
```

Dessa forma, o frontend não precisa conhecer detalhes da API externa.

---

# 🏗️ Arquitetura

O backend utiliza uma arquitetura dividida em responsabilidades.

```text
src/
│
├── controllers/
│   └── bus.controllers.ts
│
├── routes/
│   └── bus.routes.ts
│
├── services/
│   └── bus.services.ts
│
├── types/
│   ├── bus.ts
│   └── bus-api.ts
│
└── server.ts
```

### Responsabilidade de cada camada

### `server.ts`

É o ponto de entrada da aplicação.

Responsável por:

- criar a aplicação Express;
- configurar o servidor;
- registrar as rotas;
- definir a porta utilizada pela aplicação.

Atualmente o servidor utiliza a porta:

```text
3001
```

---

### `routes/`

Define os endpoints disponíveis na API.

Arquivo atual:

```text
src/routes/bus.routes.ts
```

A rota principal atualmente é:

```http
GET /api/buses
```

A responsabilidade da rota é encaminhar a requisição para o controller.

---

### `controllers/`

Arquivo:

```text
src/controllers/bus.controllers.ts
```

O controller é responsável pela camada HTTP.

Ele:

- recebe `Request`;
- recebe `Response`;
- interpreta os parâmetros da requisição;
- chama o service;
- trata erros relacionados à requisição;
- retorna a resposta HTTP.

A ideia é evitar colocar regras de negócio diretamente dentro da rota.

Fluxo:

```text
Request
   ↓
Controller
   ↓
Service
   ↓
Controller
   ↓
Response
```

---

### `services/`

Arquivo:

```text
src/services/bus.services.ts
```

O service concentra a lógica relacionada aos ônibus.

É nele que acontece a comunicação com a API externa:

```text
/v1/geolocalizacao/veiculos
```

O service também é responsável por:

- buscar os dados externos;
- aplicar filtros;
- normalizar os dados;
- transformar a resposta externa em um formato próprio da aplicação.

Isso mantém o controller mais simples e facilita futuras alterações.

---

# 🔌 API Externa

Atualmente o backend consulta a API de mobilidade do Rio de Janeiro para obter informações de veículos.

Endpoint utilizado:

```text
/v1/geolocalizacao/veiculos
```

O backend não expõe diretamente o formato da API externa.

Os dados são transformados para um formato próprio antes de serem enviados ao frontend.

Isso cria uma camada de abstração:

```text
API Mobilidade Rio
       ↓
bus-api.ts
       ↓
Service
       ↓
Bus
       ↓
Frontend
```

Assim, caso o formato da API externa seja alterado futuramente, a alteração pode ficar concentrada principalmente no backend.

---

# 🧩 Tipagem

O projeto utiliza **TypeScript** para garantir maior segurança durante o desenvolvimento.

Existem dois conjuntos principais de tipos.

## `types/bus-api.ts`

Representa os dados recebidos da API externa.

```text
API externa
    ↓
BusApi
```

Esses tipos representam o formato original dos dados.

---

## `types/bus.ts`

Representa o formato utilizado pela nossa própria aplicação.

```text
Bus
```

Essa separação é importante porque o formato da API externa não precisa ser necessariamente o mesmo formato utilizado pelo frontend.

---

# 🔎 Filtros

O endpoint de ônibus possui filtros através de query parameters.

Atualmente são trabalhados:

```text
minuto_utc
servico
sistema
modo
```

Exemplo:

```http
GET /api/buses?servico=123
```

Os filtros são representados pelo tipo:

```text
BusFilters
```

Isso evita trabalhar com parâmetros sem tipagem dentro da aplicação.

---

# 🚌 Modo

Também foi criado o tipo:

```text
Modo
```

Ele representa os modos de transporte aceitos pela aplicação.

A utilização de tipos específicos evita que qualquer string seja aceita sem validação.

---

# ⚠️ Tratamento de erros

O backend também possui tratamento de erros HTTP.

### Erro de requisição

Quando os parâmetros enviados pelo cliente são inválidos, a API pode retornar:

```http
400 Bad Request
```

### Erro na API externa

Quando existe algum problema na comunicação com a API externa, o backend pode retornar:

```http
502 Bad Gateway
```

Isso representa que o nosso servidor está funcionando, mas houve um problema ao obter os dados do serviço externo.

---

# 📡 Endpoint atual

## Buscar ônibus

```http
GET /api/buses
```

Exemplo:

```bash
GET http://localhost:3001/api/buses
```

Também é possível utilizar os filtros disponíveis através de query parameters.

Exemplo:

```bash
GET http://localhost:3001/api/buses?servico=123
```

---

# 🛠️ Tecnologias

- Node.js
- Express
- TypeScript
- JavaScript ES Modules
- API Mobilidade Rio

---

# 📦 Estrutura do projeto

```text
back-end-api-rio/
│
├── src/
│   │
│   ├── controllers/
│   │   └── bus.controllers.ts
│   │
│   ├── routes/
│   │   └── bus.routes.ts
│   │
│   ├── services/
│   │   └── bus.services.ts
│   │
│   ├── types/
│   │   ├── bus.ts
│   │   └── bus-api.ts
│   │
│   └── server.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

---

# ▶️ Executando o projeto

Clone o repositório:

```bash
git clone https://github.com/marlinhoxz/back-end-api-rio.git
```

Entre na pasta:

```bash
cd back-end-api-rio
```

Instale as dependências:

```bash
npm install
```

Execute o projeto em desenvolvimento:

```bash
npm run dev
```

O servidor ficará disponível em:

```text
http://localhost:3001
```

Endpoint:

```text
http://localhost:3001/api/buses
```

---

# 🔄 Fluxo de uma requisição

Quando o frontend fizer:

```http
GET /api/buses
```

o fluxo será:

```text
1. Next.js
      ↓
2. Express
      ↓
3. bus.routes.ts
      ↓
4. bus.controllers.ts
      ↓
5. bus.services.ts
      ↓
6. API Mobilidade Rio
      ↓
7. Dados dos ônibus
      ↓
8. Normalização
      ↓
9. Controller
      ↓
10. JSON
      ↓
11. Next.js
```

Cada camada possui uma responsabilidade específica.

---

# 🎯 Por que essa arquitetura?

A separação entre **routes, controllers, services e types** permite que o projeto cresça sem colocar toda a lógica em um único arquivo.

### Routes

Responsáveis por definir **qual URL chama qual controller**.

### Controllers

Responsáveis pela comunicação HTTP.

### Services

Responsáveis pelas regras de negócio e comunicação com serviços externos.

### Types

Responsáveis pela definição dos formatos dos dados.

Essa separação facilita:

- manutenção;
- testes;
- reutilização;
- organização;
- evolução do projeto;
- substituição da API externa;
- integração com o frontend.

---

# 🚧 Próximos passos

O projeto ainda está em desenvolvimento.

Algumas evoluções previstas são:

- [ ] Melhorar a normalização dos dados dos ônibus
- [ ] Expandir os filtros
- [ ] Trabalhar com linhas
- [ ] Trabalhar com paradas
- [ ] Explorar dados GTFS
- [ ] Criar recursos relacionados à localização
- [ ] Integrar o backend definitivamente ao frontend Next.js
- [ ] Melhorar tratamento de erros
- [ ] Criar validações mais robustas
- [ ] Criar testes
- [ ] Documentar completamente os endpoints
- [ ] Preparar o backend para produção

---

# 📚 Status atual

Atualmente o projeto já possui a base arquitetural do backend:

```text
Express
   │
   ├── Routes
   │
   ├── Controllers
   │
   ├── Services
   │
   └── Types
```

E já existe comunicação com a API de mobilidade do Rio para obtenção dos dados de veículos.

O projeto está sendo desenvolvido com foco em **organização, separação de responsabilidades, TypeScript e uma arquitetura que possa crescer conforme novas funcionalidades forem adicionadas**.

---

## 👨‍💻 Autor

**Marlon**

GitHub:

```text
https://github.com/marlinhoxz
```

Repositório:

```text
https://github.com/marlinhoxz/back-end-api-rio
```
