# 🐾 Sistema Distribuído para Monitoramento e Rastreamento de Pets

**Universidade Federal do Maranhão (UFMA)**  
**Disciplina:** Sistemas Distribuídos  
**Projeto Prático:** Simulação e Monitoramento Distribuído de Dispositivos IoT (Sticks e Trackers)

---

## 1. 📌 Contexto e Objetivos

Este projeto adapta e simplifica um sistema real de rastreamento de pets (originalmente baseado em hardware embarcado, Laravel e Framework7), transformando-o em uma **solução distribuída autônoma, modular e escalável**.

Como os dispositivos físicos reais (coleiras com GPS/rádio e gateways Wi-Fi) não estão fisicamente disponíveis, desenvolveu-se uma **suíte de simulação em Python** que emula fielmente o ciclo de vida e a transmissão de pacotes dos equipamentos físicos.

O objetivo central transcende um simples CRUD: demonstra-se, na prática, a aplicação de conceitos clássicos de **Sistemas Distribuídos**, tais como:
- **Comunicação Assíncrona e Desacoplamento:** Padrão Publish/Subscribe via broker MQTT (Eclipse Mosquitto).
- **Detecção de Falhas e Presença:** Mecanismo de *Last Will and Testament* (LWT) do MQTT para atualização imediata do status de nós caídos.
- **Processamento Concorrente e Ingestão de Dados:** Servidor central assíncrono em Node.js (Fastify) que valida coordenadas geográficas, calcula deslocamento com fórmula de Haversine e converte telemetria de milivolts.
- **Atualização em Tempo Real (Event-Driven):** Barramento WebSocket que envia notificações em formato *push* para o painel administrativo, eliminando qualquer necessidade de polling HTTP contínuo.
- **Identificação Única e Associação Dinâmica:** Gerenciamento distribuído de identificadores de dispositivos (`tracker_ref` e `stick_ref`) associados a animais.

---

## 2. 🏛️ Arquitetura da Solução

A solução é composta por 5 subsistemas completamente desacoplados:

```
+-------------------------------------------------------------------------------+
|                       Simuladores de Dispositivos (Python)                    |
|   [Tracker TRK_DOG_01]     [Tracker TRK_DOG_02]     [Stick STICK_CCET_UFMA]   |
+-------------------------------------------------------------------------------+
                                      │
                         (MQTT Publish / Subscribe)
                                      ▼
+-------------------------------------------------------------------------------+
|                       Broker MQTT (Eclipse Mosquitto)                         |
|   Tópicos: pawsition/trackers/+/telemetry | pawsition/sticks/+/config         |
+-------------------------------------------------------------------------------+
                                      │
                         (MQTT Sub / Ingestão de Pacotes)
                                      ▼
+-------------------------------------------------------------------------------+
|                   Backend Central (Node.js + Fastify + TS)                    |
|  - Ingestão MQTT & Validação Haversine                                        |
|  - Persistência com Drizzle ORM                                               |
|  - Hub de WebSocket Push                                                      |
+-------------------+---------------------------------------+-------------------+
                    │                                       │
            (MySQL Protocol)                           (WebSocket)
                    ▼                                       ▼
+---------------------------------------+   +-----------------------------------+
|         Banco de Dados (MySQL)        |   |       Frontend Web (React + TS)   |
|  - pets, sticks, trackers             |   |  - Mapa Interativo (Leaflet)      |
|  - rastreios, pet_trackers, events    |   |  - Console Distribuído MQTT       |
+---------------------------------------+   +-----------------------------------+
```

### 2.1. Componentes

1. **Broker MQTT (Eclipse Mosquitto):**
   - Barramento de mensagens assíncrono operando na porta `1883` e WebSocket na porta `9001`.
   - Gerencia filas, tópicos e conexões de todos os nós emulados.

2. **Backend (Node.js + Fastify + TypeScript):**
   - API REST construída com Fastify em modo estrito TypeScript.
   - ORM Drizzle para mapeamento e consultas tipadas no MySQL.
   - Cliente MQTT residente com reconexão automática.
   - Servidor WebSocket integrado (`/ws`) para emissão de eventos em tempo real.

3. **Frontend (React + TypeScript + Vite + Tailwind CSS + Leaflet):**
   - Interface web moderna consumindo exclusivamente a nova API Fastify e o canal WebSocket.
   - Mapa dinâmico de alta fidelidade focado no Campus da UFMA (São Luís), mostrando o deslocamento ao vivo dos animais com rastro e indicadores de sinal/bateria.
   - Painel de auditoria do barramento MQTT (*Console Distribuído*).

4. **Simuladores de Dispositivos (Python 3):**
   - Processos independentes que representam as coleiras rastreadoras (*Trackers*) e os gateways (*Sticks*).
   - Gerador de trajetórias realistas (caminhada, corrida e paradas) no Campus do Bacanga da UFMA.
   - Emulação de decaimento de bateria em milivolts e oscilações de sinal RSSI.

5. **Banco de Dados (MySQL 8.0):**
   - Armazenamento das entidades e do histórico cronológico de coordenadas geográficas.

---

## 3. 📡 Especificação de Tópicos MQTT e Protocolos

### 3.1. Tópicos MQTT

| Tópico | Origem | Destino | Função |
| :--- | :--- | :--- | :--- |
| `pawsition/trackers/{tracker_ref}/telemetry` | Tracker | Broker / Backend | Envio periódico de coordenadas GPS, bateria e RSSI |
| `pawsition/trackers/{tracker_ref}/status` | Tracker (LWT) | Broker / Backend | Notificação de presença (`online` / `offline`) |
| `pawsition/sticks/{stick_ref}/telemetry` | Stick | Broker / Backend | Status do gateway, Wi-Fi conectado e uptime |
| `pawsition/sticks/{stick_ref}/status` | Stick (LWT) | Broker / Backend | Notificação de presença do gateway |
| `pawsition/sticks/{stick_ref}/config` | Backend | Stick | Envio de comandos de reconfiguração de Wi-Fi |
| `pawsition/trackers/{tracker_ref}/command` | Backend | Tracker | Envio de comandos operacionais (ex: intervalo) |

### 3.2. Exemplo de Payload de Telemetria (Tracker -> Broker)

```json
{
  "t_id": "TRK_DOG_01",
  "s_id": "STICK_CCET_UFMA",
  "lat": -2.557462,
  "lon": -44.311145,
  "bat": 2570,
  "sbat": 2720,
  "lr_rssi": 78.5,
  "speed": 1.4,
  "timestamp": 1730598000000
}
```

---

## 4. 📂 Estrutura do Projeto

```text
/home/yuri/Documentos/UFMA/Kauane/Distribuidos/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── pets/          # Rotas e controladores de pets e vínculos
│   │   │   ├── sticks/        # Rotas e comandos MQTT para gateways
│   │   │   ├── trackers/      # Rotas de coleiras e telemetria
│   │   │   ├── locations/     # Consulta de histórico e geolocalização
│   │   │   ├── events/        # Consulta do log de eventos do barramento
│   │   │   └── dashboard/     # Métricas consolidadas do sistema
│   │   ├── infrastructure/
│   │   │   ├── database/      # Conexão MySQL, schema Drizzle e seed inicial
│   │   │   ├── mqtt/          # Cliente MQTT, subscrições e helpers
│   │   │   └── websocket/     # Hub de broadcast WebSocket em tempo real
│   │   └── server.ts          # Ponto de entrada do servidor Fastify
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Navbar, Sidebar e banners de alertas
│   │   ├── features/
│   │   │   ├── dashboard/     # Painel principal de indicadores
│   │   │   ├── map/           # Mapa em tempo real (Leaflet)
│   │   │   ├── pets/          # CRUD de pets e associação de coleiras
│   │   │   ├── trackers/      # Gerenciamento de trackers
│   │   │   ├── sticks/        # Gerenciamento de sticks e config Wi-Fi
│   │   │   ├── history/       # Consulta e playback de rotas
│   │   │   └── events/        # Console de inspeção de mensagens MQTT
│   │   ├── services/          # Clientes HTTP (Fetch) e WebSocket
│   │   └── types/             # Tipagem estrita TypeScript
│   ├── Dockerfile
│   └── package.json
├── simulators/
│   ├── common/
│   │   ├── geo.py             # Gerador de coordenadas com base na UFMA
│   │   ├── battery.py         # Emulador de consumo de energia
│   │   └── mqtt_client.py     # Cliente MQTT com LWT
│   ├── tracker/
│   │   └── tracker_sim.py     # Lógica da coleira rastreadora
│   ├── stick/
│   │   └── stick_sim.py       # Lógica do gateway base
│   ├── main.py                # Orquestrador CLI multi-dispositivos
│   ├── Dockerfile
│   └── requirements.txt
├── infrastructure/
│   └── mosquitto/
│       └── mosquitto.conf     # Configuração do broker MQTT
├── docker-compose.yml         # Orquestrador completo dos serviços
├── start.sh                   # Script de inicialização facilitada
└── README.md
```

---

## 5. 🚀 Como Executar o Projeto

Você pode executar o sistema de duas maneiras: **com Docker Compose** (recomendado para integração completa) ou **em modo de desenvolvimento local**.

### Pré-requisitos
- **Docker** e **Docker Compose** instalados (ou Node.js v20+, Python 3.10+, MySQL e Mosquitto locais).

---

### Opção 1: Execução com Docker Compose (Tudo Integrado)

Para subir todos os 5 serviços automaticamente (Banco MySQL, Broker MQTT, Backend Node.js, Frontend React e Simuladores Python):

```bash
cd /home/yuri/Documentos/UFMA/Kauane/Distribuidos

# Constrói as imagens e inicia os containers
docker compose up --build
```

Ao finalizar o carregamento dos containers:
- **Painel Administrativo Web:** Acesse [http://localhost](http://localhost) (ou [http://localhost:5173](http://localhost:5173))
- **API REST Fastify:** Acesse [http://localhost:3000](http://localhost:3000)
- **Broker MQTT:** Porta `1883`

---

### Opção 2: Execução em Modo de Desenvolvimento Local

Caso prefira rodar os serviços individualmente no seu terminal:

#### 1. Iniciar Banco de Dados e Broker MQTT
```bash
cd /home/yuri/Documentos/UFMA/Kauane/Distribuidos
docker compose up -d mysql mosquitto
```

#### 2. Iniciar o Backend
```bash
cd /home/yuri/Documentos/UFMA/Kauane/Distribuidos/backend
npm install
npm run dev
```
*O backend criará o banco `pet_tracker_db`, aplicará as tabelas e fará o seed com dados da UFMA automaticamente.*

#### 3. Iniciar o Frontend
```bash
cd /home/yuri/Documentos/UFMA/Kauane/Distribuidos/frontend
npm install
npm run dev
```
*Acesse no navegador: [http://localhost:5173](http://localhost:5173)*

#### 4. Iniciar os Simuladores de Dispositivos (Python)
Em um novo terminal:
```bash
cd /home/yuri/Documentos/UFMA/Kauane/Distribuidos
simulators/.venv/bin/python simulators/main.py --interval 3
```

Você verá os logs dos dispositivos no terminal e os animais se deslocando em tempo real na tela do mapa!

---

## 6. 🧪 Roteiro Sugerido para Apresentação Acadêmica

Para demonstrar os conceitos de **Sistemas Distribuídos** perante o professor ou avaliadores:

1. **Abertura do Painel Web:**
   - Abra [http://localhost:5173](http://localhost:5173).
   - Mostre os badges no cabeçalho superior: **MQTT: ONLINE** e **WebSocket: SYNC ATIVO**.

2. **Demonstração de Telemetria e Push em Tempo Real:**
   - Acesse a aba **Mapa em Tempo Real**.
   - Mostre os marcadores dos pets (ex: *Rex*, *Luna*, *Mimi*) se movendo no mapa do campus da UFMA sem nenhuma atualização de página (F5) ou consulta periódica HTTP, graças ao fluxo:
     `Simulador Python -> MQTT Publish -> Mosquitto -> Backend Fastify -> WebSocket Broadcast -> React UI`.

3. **Demonstração do Console de Mensageria Distribuída:**
   - Acesse a aba **Console MQTT**.
   - Mostre os pacotes chegando em tempo real com o tópico exato, timestamp e payload serializado em JSON.
   - Demonstre a inspeção de campos como bateria (`bat`), coordenadas (`lat`, `lon`) e força do sinal (`lr_rssi`).

4. **Demonstração de Comunicação Bidirecional (Configuração de Wi-Fi):**
   - Acesse a aba **Sticks (Gateways)** e clique no botão **Configurar** no gateway `STICK_CCET_UFMA`.
   - Altere o nome da rede Wi-Fi (ex: `UFMA_LAB_DISTRIBUIDOS`) e clique em **Publicar via MQTT**.
   - No terminal onde o simulador Python está rodando, mostre a mensagem recebida:  
     `[STICK_CCET_UFMA] ⚙️ Nova configuração recebida via MQTT: {'wf1': 'UFMA_LAB_DISTRIBUIDOS'}`.

5. **Demonstração de Tolerância a Falhas e Last Will & Testament (LWT):**
   - Interrompa bruscamente o simulador (Ctrl+C no terminal).
   - Observe como o broker MQTT publica automaticamente a mensagem de última vontade (*LWT*), atualizando o status dos dispositivos no frontend para **OFFLINE** em tempo real.
