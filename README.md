# 🐾 Pet Tracker - Sistema Distribuído para Monitoramento e Rastreamento de Pets

**Universidade Federal do Maranhão (UFMA)**  
**Disciplina:** Sistemas Distribuídos  
**Projeto Prático:** Sistema IoT Distribuído com Middleware InterSCity, Balanceamento de Carga Nginx e Teste de Carga para 500 Pets Virtuais

---

## 1. 📌 Contexto e Objetivos

O **Pet Tracker** é uma solução distribuída para rastreamento inteligente de pets em escala universitária/urbana.

Originalmente estruturado sobre um backend monolítico, o sistema foi refatorado e expandido para adotar padrões avançados da computação distribuída e Internet das Coisas (IoT):
- **Middleware para Cidades Inteligentes (InterSCity):** A ingestão de telemetria massiva foi desacoplada do backend de aplicação e delegada ao **InterSCity Data Collector** (`/collector/resources/{uuid}/data`), com catálogo centralizado no **Resource Catalog** (`/catalog/resources`).
- **Escalabilidade Horizontal (Cluster Backend):** O backend Node.js (Fastify) opera agora sem porta estática e com suporte a múltiplas réplicas concorrentes (`--scale backend=N`).
- **Balanceamento de Carga (Load Balancer Nginx):** Um proxy reverso Nginx distribui as requisições HTTP e as conexões bidirecionais persistentes **WebSocket (RFC 6455)** usando o algoritmo **Round Robin**.
- **Teste de Carga com 500 Pets Virtuais:** Um orquestrador em Python instancia e simula 500 coleiras rastreadoras (`TRK_VIRTUAL_001` a `TRK_VIRTUAL_500`), gerando uma vazão contínua de telemetria enviada via HTTP POST para o InterSCity.
- **Sincronização em Tempo Real (Push vs Polling):** O cluster Fastify executa rotinas otimizadas de consulta ao InterSCity (`GET /collector/resources/{uuid}/data/last`) e propaga as coordenadas geográficas diretamente aos navegadores via WebSocket.

---

## 2. 🏛️ Arquitetura da Solução Distribuída

```
+---------------------------------------------------------------------------------------------------+
|                            NÓS DE BORDA (IoT) - TESTE DE CARGA                                    |
|   500 Simuladores Python de Pets Virtuais (TRK_VIRTUAL_001 a 500) + Gateways Sticks               |
+---------------------------------------------------------------------------------------------------+
                                            │
                               HTTP POST Telemetria (/collector/resources/{uuid}/data)
                                            ▼
+---------------------------------------------------------------------------------------------------+
|                                 MIDDLEWARE INTERSCITY                                             |
|  - Resource Catalog: Cadastro e metadados dos 500 recursos IoT (/catalog/resources)               |
|  - Data Collector: Ingestão de telemetria e consulta da última medição (.../data/last)           |
+---------------------------------------------------------------------------------------------------+
                                            │
                               HTTP GET Polling Otimizado (.../data/last)
                                            ▼
+---------------------------------------------------------------------------------------------------+
|                                LOAD BALANCER NGINX                                                |
|  - Algoritmo Round Robin (balanceamento de requisições HTTP)                                      |
|  - Suporte a WebSocket (Upgrade de conexão, proxy_read_timeout 3600s)                             |
+---------------------------------------------------------------------------------------------------+
                                   │                   │
                     HTTP REST / WS│                   │HTTP REST / WS
                                   ▼                   ▼
                     +-----------------------+   +-----------------------+
                     |   Backend Instância 1 |   |   Backend Instância 2 |  ... (Escala Horizontal)
                     |   (Node.js + Fastify) |   |   (Node.js + Fastify) |
                     +-----------+-----------+   +-----------+-----------+
                                 │                           │
                                 +-------------+-------------+
                                               │
                                 WebSocket Push (/ws) & HTTP
                                               ▼
+---------------------------------------------------------------------------------------------------+
|                                     CLIENTES FRONTEND                                             |
|  Painel Administrativo React + Leaflet (Mapa dinâmico com 500 pets ao vivo)                       |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. ⚙️ Componentes do Sistema

1. **Middleware InterSCity (Porta 8000):**
   - **Resource Catalog (`/catalog/resources`):** Provê cadastro e metadados (capacidades: localização, bateria, rssi, velocidade).
   - **Data Collector (`/collector/resources/{uuid}/data`):** Ponto único de ingestão de telemetria IoT.
   - **Consulta de Último Dado (`/collector/resources/{uuid}/data/last`):** Permite recuperação otimizada de estado sem consultas complexas a bancos de séries temporais.

2. **Load Balancer Nginx (Porta 3000):**
   - Atua como gateway de entrada único para clientes e frontend.
   - Distribui o tráfego de forma equitativa (Round Robin) entre as instâncias do cluster Fastify.
   - Realiza upgrade transparente de protocolo para conexões **WebSocket**, mantendo canais persistentes ativos com timeouts estendidos.

3. **Backend Node.js + Fastify + TypeScript:**
   - Stateless e preparado para replicação horizontal (`--scale backend=3`).
   - Rotina modular de sincronização assíncrona com o InterSCity.
   - Hub de WebSocket com broadcast de eventos de localização e alertas de bateria crítica (< 15%).

4. **Simuladores de Dispositivos (Python 3):**
   - Suíte de teste de carga capaz de instanciar 500 coleiras com movimentação física simulada no campus da UFMA (São Luís).
   - Envio HTTP concorrente com reaproveitamento de conexões TCP via `requests.Session`.

5. **Painel Web (React + TypeScript + Vite + Tailwind + Leaflet - Porta 80 / 5173):**
   - Mapa dinâmico mostrando as posições dos animais e telemetria em tempo real.
   - Comunicação 100% orientada a eventos através do canal WebSocket.

---

## 4. 🚀 Como Executar o Projeto

### Pré-requisitos
- **Docker** e **Docker Compose** instalados (ou Python 3.10+ e Node.js v20+ para execução local).

---

### Opção 1: Execução com a Plataforma Oficial InterSCity (Microsserviços Oficiais)

Para rodar a **stack oficial completa da Plataforma InterSCity** (Kong API Gateway, Resource Cataloguer, Data Collector, MongoDB, PostgreSQL e RabbitMQ):

```bash
cd Distribuidos

# Sobe os microsserviços oficiais do InterSCity e o cluster Pet Tracker:
./start.sh official
```

Ou gerenciando os containers manualmente:
```bash
# 1. Inicia a stack oficial do InterSCity
docker compose -f docker-compose.interscity.yml up -d

# 2. Inicia o cluster do Pet Tracker escalado com 3 réplicas
docker compose up --build --scale backend=3
```

---

### Opção 2: Execução com Escalabilidade Horizontal via Docker (Modo Integrado)

O script unificado `start.sh` facilita a execução e orquestração do cluster:

```bash
# 1. Entre no diretório do projeto
cd Distribuidos

# 2. Inicie o sistema com 3 réplicas do backend balanceadas pelo Nginx:
./start.sh scale 3
```

Caso prefira usar o Docker Compose diretamente:
```bash
docker compose up --build --scale backend=3
```

Ao finalizar a inicialização:
- **Painel Administrativo Web:** [http://localhost](http://localhost) (ou [http://localhost:5173](http://localhost:5173))
- **Load Balancer Nginx:** [http://localhost:3000](http://localhost:3000)
- **Middleware InterSCity:** [http://localhost:8000](http://localhost:8000)
- **Status do Cluster e InterSCity:** [http://localhost:3000/health](http://localhost:3000/health)

---

### Opção 3: Execução do Teste de Carga com 500 Pets

O teste de carga pode ser executado em duas etapas simples:

#### Passo 1: Registrar os 500 Recursos no InterSCity Catalog
```bash
./start.sh seed
# ou: python3 simulators/seed_interscity.py
```
*O script registra os 500 trackers (`TRK_VIRTUAL_001` a `TRK_VIRTUAL_500`) no catálogo do InterSCity e grava o mapeamento de UUIDs em `simulators/interscity_resources.json` e `backend/data/interscity_resources.json`.*

#### Passo 2: Iniciar a Transmissão dos 500 Simuladores
```bash
./start.sh sim
# ou: python3 simulators/main.py --count 500 --interval 3.0
```
*Você verá a taxa de requisições por segundo (~166 req/s) e a telemetria sendo entregue com sucesso ao InterSCity.*

---

## 5. 🧪 Roteiro para Apresentação Acadêmica

Para demonstrar os conceitos de **Sistemas Distribuídos** aos professores e avaliadores:

1. **Demonstração do Balanceamento de Carga (Nginx):**
   - Execute `./start.sh scale 3` para levantar 3 instâncias do backend.
   - Acesse [http://localhost:3000/health](http://localhost:3000/health) repetidas vezes e mostre no campo `cluster.node_pid` a alternância entre os processos (demonstrando o algoritmo Round Robin).
   - Mostre no arquivo `infrastructure/nginx/nginx.conf` a diretiva `upstream backend_cluster` e as regras de proxy para WebSocket (`Upgrade` e `Connection`).

2. **Demonstração do Middleware InterSCity:**
   - Acesse [http://localhost:8000/catalog/resources](http://localhost:8000/catalog/resources) e mostre os recursos cadastrados com suas capacidades (`location`, `battery`, `rssi`).
   - Acesse [http://localhost:8000/collector/resources/data/last](http://localhost:8000/collector/resources/data/last) e mostre os dados em tempo real coletados pelo middleware.

3. **Demonstração do Teste de Carga com 500 Pets:**
   - No terminal, mostre os logs de `main.py` exibindo 500 telemetrias transmitidas por ciclo com alta vazão e concorrência no pool de threads.
   - Abra o painel web no navegador e mostre as atualizações contínuas de telemetria recebidas via WebSocket.
