# 🗺️ Fluxogramas e Diagramas de Arquitetura — Pet Tracker Distribuído

> **Universidade Federal do Maranhão (UFMA)**  
> **Disciplina:** Sistemas Distribuídos  
> **Projeto:** Sistema Distribuído de Rastreamento de Pets em Tempo Real  
> **Autora:** Kauane  

Este documento apresenta a especificação visual e arquitetural completa do sistema, estruturada em diagramas **Mermaid**. O projeto demonstra conceitos fundamentais de computação distribuída: **escalabilidade horizontal, balanceamento de carga Round-Robin, tolerância a falhas, desacoplamento assíncrono via mensageria MQTT e consistência eventual de dados**.

---

## 📌 Sumário
1. [Visão Geral da Arquitetura End-to-End](#1-visão-geral-da-arquitetura-end-to-end)
2. [Fluxo de Ingestão de Telemetria e Notificação em Tempo Real](#2-fluxo-de-ingestão-de-telemetria-e-notificação-em-tempo-real)
3. [Topologia de Balanceamento de Carga e Teste de 1 Milhão de Requisições](#3-topologia-de-balanceamento-de-carga-e-teste-de-1-milhão-de-requisições)
4. [Ciclo de Vida e Máquina de Estados da Coleira IoT](#4-ciclo-de-vida-e-máquina-de-estados-da-coleira-iot)
5. [Topologia de Rede Docker e Isolamento](#5-topologia-de-rede-docker-e-isolamento)

---

## 1. Visão Geral da Arquitetura End-to-End

O diagrama abaixo descreve a interação entre as 4 camadas do sistema distribuído:
- **Camada Edge/IoT:** Dispositivos coleira e simuladores emulando telemetria em alta frequência.
- **Camada de Middleware & Ingestão:** InterSCity Platform e Broker Eclipse Mosquitto.
- **Camada de Aplicação & Cluster:** Nginx (Proxy Reverso / Load Balancer) distribuindo carga entre 3 réplicas Fastify (Node.js).
- **Camada de Persistência & Frontend:** Banco de Dados Relacional MySQL e Single Page Application React.

```mermaid
flowchart TD
    subgraph EDGE["Camada Edge & IoT (Dispositivos)"]
        D1["Coleira IoT 1 (GPS, Batimentos, Bateria)"]
        D2["Coleira IoT 2 (GPS, Batimentos, Bateria)"]
        DN["Coleira IoT N (Simuladores em Lote)"]
    end

    subgraph BROKER["Middleware & Mensageria Pub/Sub"]
        MQTT["Broker MQTT (Eclipse Mosquitto)<br/>Porta: 1883 / 9001 (WS)"]
        INTER["InterSCity Middleware<br/>Porta: 8000 (Resource Adaptor)"]
    end

    subgraph LOADBALANCER["Ingresso & Balanceamento"]
        NGINX["Nginx Load Balancer<br/>Porta: 3000<br/>Algoritmo: Round-Robin com KeepAlive"]
    end

    subgraph CLUSTER["Cluster de Aplicação (Backend Fastify)"]
        B1["Backend Réplica 1<br/>Porta: 3001 | IP: 172.28.0.x"]
        B2["Backend Réplica 2<br/>Porta: 3001 | IP: 172.28.0.y"]
        B3["Backend Réplica 3<br/>Porta: 3001 | IP: 172.28.0.z"]
    end

    subgraph STORAGE["Camada de Dados Compartilhada"]
        MYSQL[("MySQL 8.0 Cluster Storage<br/>Porta: 3306<br/>Pets, Logs, Alertas, Benchmark")]
    end

    subgraph CLIENTS["Camada de Apresentação & Usuário"]
        SPA["Frontend SPA (React + Vite + Leaflet)<br/>Porta: 80 / 5173"]
        ADM["Painel de Monitoramento do Cluster<br/>(Visualização de Carga em Tempo Real)"]
    end

    %% Relações Edge
    D1 -->|"Publica coordenadas e vitais"| MQTT
    D2 -->|"Publica coordenadas e vitais"| MQTT
    DN -->|"Telemetria simulada (/sensor/data)"| INTER
    INTER -->|"Encaminha eventos"| MQTT

    %% Relações MQTT -> Cluster
    MQTT <-->|"Subscrição WebSocket & MQTT Topics"| B1
    MQTT <-->|"Subscrição WebSocket & MQTT Topics"| B2
    MQTT <-->|"Subscrição WebSocket & MQTT Topics"| B3
    MQTT -.->|"Streaming direto via WS"| SPA

    %% Relações HTTP Clients -> Load Balancer
    SPA -->|"Requisições REST API & Gestão"| NGINX
    ADM -->|"Disparo de Carga (1M Req) & Polling"| NGINX

    %% Relações Load Balancer -> Cluster
    NGINX -->|"1/3 das requisições (Round-Robin)"| B1
    NGINX -->|"1/3 das requisições (Round-Robin)"| B2
    NGINX -->|"1/3 das requisições (Round-Robin)"| B3

    %% Relações Cluster -> Storage
    B1 -->|"Pool de Conexões"| MYSQL
    B2 -->|"Pool de Conexões"| MYSQL
    B3 -->|"Pool de Conexões"| MYSQL
```

---

## 2. Fluxo de Ingestão de Telemetria e Notificação em Tempo Real

Este diagrama de sequência detalha o ciclo de vida de uma leitura de telemetria emitida por uma coleira até a sua persistência e exibição no mapa interativo:

```mermaid
sequenceDiagram
    autonumber
    actor Pet as Coleira IoT (Pet)
    participant Broker as Eclipse Mosquitto (MQTT)
    participant Backend as Cluster Backend (Fastify)
    participant DB as MySQL Database
    participant UI as Painel Web (React/Leaflet)

    Pet->>Broker: PUBLISH topic: `pets/{petId}/telemetry`<br/>{lat, lng, heart_rate, battery, timestamp}
    Note over Broker: Desacoplamento assíncrono:<br/>Broker recebe e roteia mensagem
    Broker-->>Backend: Mensagem entregue às réplicas inscritas
    
    activate Backend
    Backend->>Backend: Valida integridade e limites de geofence (cerca virtual)
    Backend->>DB: INSERT INTO pet_telemetry / UPDATE pets SET last_seen
    
    alt Pet saiu da cerca ou vitais anormais
        Backend->>DB: INSERT INTO alerts (pet_id, type, severity)
        Backend->>Broker: PUBLISH topic: `pets/{petId}/alerts`
        Broker-->>UI: Notificação Push WebSocket
    end
    
    Backend->>Broker: PUBLISH topic: `pets/{petId}/positions` (atualização filtrada)
    deactivate Backend
    
    Broker-->>UI: WebSocket Broadcast (atualiza marcador no mapa Leaflet)
    UI->>UI: Renderiza deslocamento do pet sem refresh de página
```

---

## 3. Topologia de Balanceamento de Carga e Teste de 1 Milhão de Requisições

Demonstração do funcionamento do Nginx como ponto único de entrada (**Reverse Proxy / Load Balancer**) aplicando o algoritmo **Round-Robin** com pool de conexões persistentes (`keepalive 128`), permitindo a vazão de até 1.000.000 de requisições distribuídas homogeneamente:

```mermaid
flowchart LR
    subgraph CLIENT["Geradores de Carga"]
        UI_TEST["Interface Web<br/>(Botão 1.000.000 req)"]
        CLI_TEST["Benchmark CLI<br/>(Node.js / Python async worker)"]
    end

    subgraph LB["Nginx (Load Balancer - Porta 3000)"]
        UPSTREAM{"Upstream Cluster Pool<br/>Round-Robin"}
    end

    subgraph BACKENDS["Réplicas do Cluster Fastify"]
        REP1["Réplica 1<br/>Porta 3001<br/>Header: X-Served-By: 172.28.0.x<br/><b>333.334 req (~33,3%)</b>"]
        REP2["Réplica 2<br/>Porta 3001<br/>Header: X-Served-By: 172.28.0.y<br/><b>333.333 req (~33,3%)</b>"]
        REP3["Réplica 3<br/>Porta 3001<br/>Header: X-Served-By: 172.28.0.z<br/><b>333.333 req (~33,3%)</b>"]
    end

    subgraph SYNC["Sincronização de Estado Compartilhado"]
        STATE_TABLE[("Tabela MySQL:<br/>cluster_benchmark<br/>(Progresso, Métricas e Contadores)")]
    end

    UI_TEST -->|"POST /api/cluster/benchmark/start"| LB
    CLI_TEST -->|"Requisições HTTP simultâneas"| LB

    LB --> UPSTREAM
    UPSTREAM -->|"Req 1, 4, 7... 3N+1"| REP1
    UPSTREAM -->|"Req 2, 5, 8... 3N+2"| REP2
    UPSTREAM -->|"Req 3, 6, 9... 3N+3"| REP3

    REP1 -->|"Atualiza contadores"| STATE_TABLE
    REP2 -->|"Atualiza contadores"| STATE_TABLE
    REP3 -->|"Atualiza contadores"| STATE_TABLE

    UI_TEST -.->|"GET /api/cluster/benchmark/status (Polling)"| LB
    LB -.->|"Qualquer réplica lê o estado unificado"| STATE_TABLE
```

---

## 4. Ciclo de Vida e Máquina de Estados da Coleira IoT

Cada dispositivo rastreador transita entre diferentes estados conforme as condições de conectividade, bateria e limites geográficos:

```mermaid
stateDiagram-v2
    [*] --> Desconectado: Dispositivo desligado

    Desconectado --> Conectando: Ativação / Boot da Coleira
    Conectando --> Online_Normal: Conexão MQTT estabelecida & Bateria > 20%
    Conectando --> Desconectado: Timeout de conexão (3 tentativas)

    state Online_Normal {
        [*] --> RastreamentoPadrao
        RastreamentoPadrao --> TransmissaoPeriodica: Intervalo atingido (a cada 5s)
        TransmissaoPeriodica --> RastreamentoPadrao: ACK recebido
    }

    Online_Normal --> Bateria_Baixa: Nível de Bateria <= 20%
    Online_Normal --> Alerta_Cerca_Violada: Coordenada fora do polígono seguro
    Online_Normal --> Alerta_Saude: Frequência cardíaca crítica

    state Bateria_Baixa {
        [*] --> ModoEconomia
        ModoEconomia --> TransmissaoReduzida: Intervalo espaçado (a cada 30s)
        TransmissaoReduzida --> ModoEconomia
    }

    Alerta_Cerca_Violada --> Online_Normal: Retorno à área autorizada
    Alerta_Saude --> Online_Normal: Frequência normalizada
    Bateria_Baixa --> Online_Normal: Conectado ao carregador (> 50%)

    Online_Normal --> Desconectado: Perda de sinal / Bateria esgotada
    Bateria_Baixa --> Desconectado: Bateria = 0%
    Alerta_Cerca_Violada --> Desconectado: Perda de sinal
```

---

## 5. Topologia de Rede Docker e Isolamento

O ambiente é orquestrado através do Docker Compose com uma rede bridge isolada (`pet-tracker-net`), garantindo comunicação por DNS interno e expondo estritamente as portas necessárias ao host:

```mermaid
flowchart TB
    subgraph HOST["Ambiente Host (Máquina Física / Navegador)"]
        BROWSER["Navegador Web / Cliente API"]
        TERMINAL["Terminal do Administrador (CLI)"]
    end

    subgraph DOCKER_NET["Rede Docker Bridge Privada: `pet-tracker-net` (Subrede 172.28.0.0/16)"]
        subgraph FRONTEND_SVC["Serviço Web"]
            NGINX_FRONT["pet-tracker-frontend<br/>Porta interna: 80"]
        end

        subgraph GATEWAY_SVC["Gateway & Load Balancer"]
            NGINX_LB["pet-tracker-loadbalancer<br/>Porta interna: 3000"]
        end

        subgraph BACKEND_SVC["Cluster Escalável"]
            B_REP1["distribuidos-backend-1:3001"]
            B_REP2["distribuidos-backend-2:3001"]
            B_REP3["distribuidos-backend-3:3001"]
        end

        subgraph IOT_SVC["Camada IoT"]
            MOSQ["pet-tracker-mosquitto:1883 / 9001"]
            INTER["pet-tracker-interscity:8000"]
            SIMS["pet-tracker-simulators (Processo em background)"]
        end

        subgraph DATA_SVC["Persistência"]
            DB_NODE["pet-tracker-mysql:3306<br/>(Volume persistente montado)"]
        end
    end

    %% Mapeamentos de porta Host -> Docker
    BROWSER -->|"http://localhost:80"| NGINX_FRONT
    BROWSER -->|"http://localhost:3000"| NGINX_LB
    TERMINAL -->|"./start.sh status / benchmark"| NGINX_LB
    BROWSER -.->|"ws://localhost:9001"| MOSQ

    %% Comunicação interna
    NGINX_FRONT -->|"Proxy /api"| NGINX_LB
    NGINX_LB -->|"HTTP Round-Robin"| B_REP1
    NGINX_LB -->|"HTTP Round-Robin"| B_REP2
    NGINX_LB -->|"HTTP Round-Robin"| B_REP3

    B_REP1 -->|"TCP MySQL 3306"| DB_NODE
    B_REP2 -->|"TCP MySQL 3306"| DB_NODE
    B_REP3 -->|"TCP MySQL 3306"| DB_NODE

    SIMS -->|"Publica telemetria"| MOSQ
    SIMS -->|"Envia dados sensores"| INTER
    INTER --> MOSQ
    B_REP1 <-->|"MQTT Client"| MOSQ
    B_REP2 <-->|"MQTT Client"| MOSQ
    B_REP3 <-->|"MQTT Client"| MOSQ
```

---

## 🔬 Conceitos de Sistemas Distribuídos Aplicados

| Conceito | Implementação Prática no Projeto |
| :--- | :--- |
| **Escalabilidade Horizontal** | O backend possui 3 instâncias equivalentes (`--scale backend=3`) que podem ser aumentadas dinamicamente sem interrupção de serviço. |
| **Balanceamento de Carga** | O Nginx distribui as requisições via algoritmo **Round-Robin**, inserindo nos cabeçalhos HTTP o metadado `X-Served-By` com o IP e porta da réplica que processou o payload. |
| **Desacoplamento Temporal e Espacial** | A comunicação entre coleiras IoT e o backend é assíncrona, mediada pelo Broker MQTT (Eclipse Mosquitto) no padrão Publish/Subscribe. |
| **Consistência Compartilhada** | O estado do teste de estresse de 1 milhão de requisições é unificado em uma tabela do MySQL (`cluster_benchmark`), garantindo que qualquer réplica consultada responda com o mesmo progresso em tempo real. |
| **Tolerância a Falhas** | Se uma réplica do backend for interrompida (`docker stop distribuidos-backend-2`), o Nginx redireciona as requisições para as réplicas remanescentes sem indisponibilidade para o usuário. |
