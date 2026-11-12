# 🗺️ Diagramas de Atividade e Arquitetura — Pet Tracker Distribuído

> **Universidade Federal do Maranhão (UFMA)**  
> **Disciplina:** Sistemas Distribuídos  
> **Projeto:** Sistema Distribuído de Rastreamento de Pets em Tempo Real  
> **Autora:** Kauane  
> **Padrão dos Diagramas:** [PlantUML Activity Diagram (Beta Syntax)](https://plantuml.com/activity-diagram-beta) + [Mermaid](https://mermaid.js.org/)

Este documento apresenta a especificação comportamental e arquitetural completa do sistema, estruturada através de **Diagramas de Atividade PlantUML (sintaxe nova / beta com swimlanes, condicionais, forks paralelos e repetições)** e diagramas **Mermaid**.

---

## 📌 Sumário
1. [PlantUML: Fluxo de Atividade Geral do Sistema (Swimlanes)](#-1-plantuml-fluxo-de-atividade-geral-do-sistema-com-swimlanes)
2. [PlantUML: Ingestão de Telemetria, Vitais e Cerca Virtual (Geofence)](#-2-plantuml-ingestão-de-telemetria-vitais-e-cerca-virtual)
3. [PlantUML: Balanceamento Round-Robin e Teste de 1 Milhão de Requisições](#-3-plantuml-balanceamento-round-robin-e-teste-de-1-milhão-de-requisições)
4. [PlantUML: Ciclo de Vida da Coleira IoT e Economia de Bateria](#-4-plantuml-ciclo-de-vida-da-coleira-iot-e-economia-de-bateria)
5. [Mermaid: Visão Geral da Arquitetura de Componentes](#-5-mermaid-visão-geral-da-arquitetura-de-componentes)
6. [Mermaid: Topologia de Rede Docker e Portas](#-6-mermaid-topologia-de-rede-docker-e-portas)

---

## 🚀 1. PlantUML: Fluxo de Atividade Geral do Sistema (com Swimlanes)

Este diagrama modela a sequência operacional de ponta a ponta, dividida nas raias (*swimlanes*) dos componentes distribuídos: **Coleira IoT**, **Broker MQTT**, **Load Balancer Nginx**, **Cluster Fastify**, **MySQL** e **Frontend Web**.

```plantuml
@startuml
title Fluxo de Atividade Geral do Sistema Distribuído - Pet Tracker
skinparam ActivityFontSize 12
skinparam ActivityDiamondFontSize 11
skinparam defaultFontName sans-serif

|Coleira IoT (Edge)|
start
:Ligar dispositivo / simulador;
:Capturar coordenadas GPS e sensores vitais\n(latitude, longitude, BPM, bateria);
:Empacotar payload JSON de telemetria;
:Publicar no tópico MQTT 'pets/{id}/telemetry';

|Broker MQTT (Mosquitto)|
:Receber pacote de telemetria via TCP/IP (1883);
:Verificar clientes inscritos no tópico;
fork
    :Rotear para réplicas do Backend (Cluster);
fork again
    :Disparar streaming WebSocket para navegadores conectados (9001);
end fork

|Nginx (Load Balancer)|
:Receber conexões e requisições HTTP da API;
if (Instâncias ativas no pool upstream?) then (sim)
    :Aplicar algoritmo Round-Robin;
    :Encaminhar requisição para Réplica disponível (3001);
else (não)
    :Retornar HTTP 502 Bad Gateway; <<#Pink>>
    stop
endif

|Cluster Fastify (Réplica N)|
:Receber payload e validar integridade;
:Executar checagem de regras de negócio:\n1. Bateria <= 20%?\n2. Frequência cardíaca fora do padrão?\n3. Coordenada fora do polígono de segurança?;

|MySQL Database|
:Gravar histórico em 'pet_telemetry';
:Atualizar última localização e status em 'pets';

|Cluster Fastify (Réplica N)|
if (Violação de regras detectada?) then (sim)
    |MySQL Database|
    :Inserir registro em 'alerts';
    |Cluster Fastify (Réplica N)|
    :Publicar evento no tópico 'pets/{id}/alerts';
    |Broker MQTT (Mosquitto)|
    :Entregar alerta via WebSocket;
    |Frontend Web (React/Leaflet)|
    :Exibir notificação visual de alerta de fuga/saúde; <<#Yellow>>
else (não)
    |Frontend Web (React/Leaflet)|
    :Atualizar posição do marcador no mapa sem refresh; <<#LightGreen>>
endif

|Frontend Web (React/Leaflet)|
:Renderizar trajeto do pet e painel de telemetria;
stop
@enduml
```

---

## ⚡ 2. PlantUML: Ingestão de Telemetria, Vitais e Cerca Virtual

Foco no algoritmo interno executado para cada medição, demonstrando decisões, ramificações e persistência condicional.

```plantuml
@startuml
title Algoritmo de Processamento de Telemetria e Detecção de Violação (Geofence)
skinparam conditionStyle inside
skinparam defaultFontName sans-serif

start
:Receber pacote de telemetria;
note right
Payload:
{
  pet_id: string,
  lat: float,
  lng: float,
  heart_rate: int,
  battery: int,
  timestamp: string
}
end note

:Sanitizar dados e validar coordenadas (-90 a 90, -180 a 180);

if (Coordenadas válidas?) then (sim)
    :Carregar dados da cerca virtual do pet (Geofence);
    
    if (Ponto (lat, lng) está contido no polígono seguro?) then (sim)
        :Manter status do pet como 'SAFE';
    else (não)
        :Marcar status como 'OUT_OF_BOUNDS'; <<#Pink>>
        :Criar objeto de Alerta de Fuga (Severidade Alta);
        :Disparar notificação de alarme;
    endif
    
    if (heart_rate < 50 ou heart_rate > 160) then (sim)
        :Criar objeto de Alerta de Saúde (BPM Anômalo); <<#Orange>>
        :Disparar notificação de saúde crítica;
    else (não)
        :Vitais estáveis;
    endif

    if (battery <= 20) then (sim)
        :Criar Alerta de Bateria Fraca; <<#Yellow>>
    endif

    :Persistir telemetria e alertas no banco relacional;
    :Emitir evento de atualização no canal em tempo real;
    :Concluir processamento com sucesso (ACK); <<#LightGreen>>
    stop
else (não)
    :Descartar payload corrompido; <<#Pink>>
    :Registrar log de aviso no logger;
    end
endif
@enduml
```

---

## ⚖️ 3. PlantUML: Balanceamento Round-Robin e Teste de 1 Milhão de Requisições

Demonstração do fluxo de estresse distribuído e da sincronização de contadores compartilhados através de conexões persistentes (*keep-alive*).

```plantuml
@startuml
title Fluxo de Balanceamento de Carga e Teste de Estresse de 1.000.000 de Requisições
skinparam defaultFontName sans-serif

start
:Usuário clica em 'Iniciar Teste de 1 Milhão' na Interface Web;
:Disparar POST /api/cluster/benchmark/start;

|Nginx Load Balancer|
:Receber requisição de início;
:Roteador encaminha para o Backend via Round-Robin;

|Cluster Backend Fastify|
:Inicializar registro de benchmark no MySQL:
- total_requests = 1.000.000
- completed_requests = 0
- status = 'RUNNING';

:Iniciar rotina assíncrona com pool HTTP Keep-Alive (128 conexões concorrentes);

repeat
    :Disparar lote de requisições HTTP para http://loadbalancer:3000/api/health;
    
    |Nginx Load Balancer|
    if (Índice da requisição) then (req % 3 == 1)
        :Encaminhar para Réplica 1 (172.28.0.x:3001);
        note right: Header HTTP: X-Served-By: 172.28.0.x
    elseif (req % 3 == 2)
        :Encaminhar para Réplica 2 (172.28.0.y:3001);
        note right: Header HTTP: X-Served-By: 172.28.0.y
    else (req % 3 == 0)
        :Encaminhar para Réplica 3 (172.28.0.z:3001);
        note right: Header HTTP: X-Served-By: 172.28.0.z
    endif
    
    |Cluster Backend Fastify|
    :Processar requisição e responder HTTP 200 OK;
    :Incrementar contadores da réplica correspondente;
    
    if (Lote atingiu 5.000 requisições?) then (sim)
        |MySQL Database|
        :Atualizar progresso na tabela 'cluster_benchmark';
        |Cluster Backend Fastify|
    endif

repeat while (completed_requests < 1.000.000?) is (sim) not (não)

|MySQL Database|
:Gravar status = 'FINISHED' e timestamp final;

|Frontend Web (React/Leaflet)|
:Polling em tempo real a cada 1s consulta /api/cluster/benchmark/status;
:Exibir 100% concluído com distribuição idêntica (~33,3% por réplica);
:Teste de 1 Milhão finalizado com sucesso; <<#LightGreen>>
stop
@enduml
```

---

## 🔋 4. PlantUML: Ciclo de Vida da Coleira IoT e Economia de Bateria

Representação do algoritmo de loop contínuo embarcado na coleira rastreadora.

```plantuml
@startuml
title Ciclo de Vida do Dispositivo IoT e Gerenciamento de Energia
skinparam defaultFontName sans-serif

start
:Inicialização da Coleira (Hardware Boot);
:Conectar à rede e ao Broker MQTT;

while (Dispositivo energizado?) is (sim)
    :Ler sensores: Antena GPS + Sensor de Pulso + Nível de Carga;
    
    if (Nível de Bateria) then (> 20%)
        :Modo de Operação Normal;
        :Empacotar telemetria completa;
        :Enviar pacote MQTT (QoS 0/1);
        :Aguardar intervalo padrão (5 segundos);
    elseif (Nível de Bateria > 5%) then (<= 20%)
        :Modo de Economia de Energia (Eco Mode); <<#Yellow>>
        :Desligar módulo de alta precisão GPS;
        :Utilizar triangulação por antenas locais;
        :Empacotar telemetria simplificada;
        :Enviar pacote MQTT com flag 'battery_low';
        :Aguardar intervalo estendido (30 segundos);
    else (Crítico <= 5%)
        :Modo de Sobrevivência (Emergency); <<#Pink>>
        :Enviar último pacote 'EMERGENCY_LAST_GASP';
        :Suspender sensores secundários;
        :Desconectar rádio e entrar em Deep Sleep;
        detach
    endif
endwhile (não)

:Desligamento ordenado;
stop
@enduml
```

---

## 🏛️ 5. Mermaid: Visão Geral da Arquitetura de Componentes

Para referência rápida e visualização gráfica imediata no GitHub:

```mermaid
flowchart TD
    subgraph EDGE["1. Camada Edge & IoT"]
        D1["Coleira 1 (GPS, Vitais)"]
        D2["Coleira 2 (GPS, Vitais)"]
        DN["Simulador 1.500 Pets"]
    end

    subgraph BROKER["2. Middleware & Mensageria"]
        MQTT["Broker MQTT Mosquitto<br/>(1883 TCP / 9001 WS)"]
        INTER["InterSCity Platform<br/>(Porta 8000)"]
    end

    subgraph INGRESS["3. Balanceamento de Carga"]
        NGINX["Nginx Load Balancer<br/>(Porta 3000 / Round-Robin)"]
    end

    subgraph CLUSTER["4. Cluster de Aplicação"]
        B1["Réplica 1 (3001)"]
        B2["Réplica 2 (3001)"]
        B3["Réplica 3 (3001)"]
    end

    subgraph STORAGE["5. Banco de Dados"]
        MYSQL[("MySQL 8.0 Cluster Storage<br/>(Porta 3306)")]
    end

    subgraph PRESENTATION["6. Frontend Web"]
        REACT["React SPA + Leaflet Maps<br/>(Porta 80 / 5173)"]
    end

    D1 & D2 -->|"MQTT Publish"| MQTT
    DN -->|"HTTP POST /data"| INTER
    INTER --> MQTT

    MQTT <-->|"WebSocket / MQTT"| B1 & B2 & B3
    MQTT -.->|"WebSocket Direct"| REACT

    REACT -->|"HTTP Requests"| NGINX
    NGINX -->|"1/3 carga"| B1
    NGINX -->|"1/3 carga"| B2
    NGINX -->|"1/3 carga"| B3

    B1 & B2 & B3 -->|"Pool MySQL"| MYSQL
```

---

## 🌐 6. Mermaid: Topologia de Rede Docker e Portas

```mermaid
flowchart TB
    subgraph EXTERNAL["Acessos Externos (Host)"]
        BROWSER["Navegador Web / Cliente: http://localhost:80"]
        API_GATEWAY["API Gateway: http://localhost:3000"]
        MQTT_WS["WebSocket MQTT: ws://localhost:9001"]
    end

    subgraph DOCKER_NET["Rede Docker Privada: pet-tracker-net (172.28.0.0/16)"]
        FRONT["pet-tracker-frontend:80"]
        LB["pet-tracker-loadbalancer:3000"]
        REP1["distribuidos-backend-1:3001"]
        REP2["distribuidos-backend-2:3001"]
        REP3["distribuidos-backend-3:3001"]
        DB["pet-tracker-mysql:3306"]
        MOSQ["pet-tracker-mosquitto:1883 / 9001"]
        SIM["pet-tracker-simulators"]
    end

    BROWSER --> FRONT
    API_GATEWAY --> LB
    MQTT_WS --> MOSQ

    FRONT --> LB
    LB --> REP1 & REP2 & REP3
    REP1 & REP2 & REP3 --> DB
    REP1 & REP2 & REP3 <--> MOSQ
    SIM --> MOSQ
```

---

## 📚 Como Renderizar os Diagramas PlantUML

Os diagramas acima utilizam a sintaxe oficial **PlantUML Activity Diagram (Beta)**. Para visualizá-los:
1. **Online:** Cole o código entre `@startuml` e `@enduml` no editor oficial: [PlantText Editor](https://www.planttext.com/) ou [PlantUML Server](http://www.plantuml.com/plantuml/uml/).
2. **VS Code / Antigravity:** Instale a extensão `PlantUML` (`jebbs.plantuml`) e pressione `Alt + D` com o cursor dentro do bloco.
3. **CLI:** Execute `plantuml FLUXOGRAMA.md` para exportar diretamente para PNG ou SVG.
