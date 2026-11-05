# 🌐 Conceitos de Sistemas Distribuídos Aplicados no PetTracker

**Universidade Federal do Maranhão (UFMA)**  
**Curso:** Ciência da Computação / BICT  
**Disciplina:** Sistemas Distribuídos  
**Projeto:** Sistema Distribuído para Monitoramento e Rastreamento de Pets  

---

## 📑 Sumário

1. [Visão Geral e Arquitetura do Sistema](#1-visão-geral-e-arquitetura-do-sistema)
2. [Conceito 1: Comunicação por Troca de Mensagens (Message Passing vs Shared Memory)](#conceito-1-comunicação-por-troca-de-mensagens-message-passing-vs-shared-memory)
3. [Conceito 2: Arquitetura Orientada a Eventos e Padrão Publish/Subscribe](#conceito-2-arquitetura-orientada-a-eventos-e-padrão-publishsubscribe)
4. [Conceito 3: Identificação, Nomenclatura e Roteamento de Mensagens](#conceito-3-identificação-nomenclatura-e-roteamento-de-mensagens)
5. [Conceito 4: Processamento Assíncrono e Concorrência Não-Bloqueante](#conceito-4-processamento-assíncrono-e-concorrência-não-bloqueante)
6. [Conceito 5: Detecção de Falhas e Presença com Last Will and Testament (LWT)](#conceito-5-detecção-de-falhas-e-presença-com-last-will-and-testament-lwt)
7. [Conceito 6: Sincronização em Tempo Real via WebSockets (Push vs Polling)](#conceito-6-sincronização-em-tempo-real-via-websockets-push-vs-polling)
8. [Conceito 7: Arquitetura de Borda e Gateways Intermediários (O Papel dos Sticks)](#conceito-7-arquitetura-de-borda-e-gateways-intermediários-o-papel-dos-sticks)
9. [Conceito 8: Tempo, Ordenação e Validação de Coordenadas (Haversine)](#conceito-8-tempo-ordenação-e-validação-de-coordenadas-haversine)
10. [Conceito 9: Isolamento, Virtualização de Rede e Orquestração com Docker](#conceito-9-isolamento-virtualização-de-rede-e-orquestração-com-docker)

---

## 1. Visão Geral e Arquitetura do Sistema

Um **Sistema Distribuído** é definido como uma coleção de entidades computacionais autônomas que se comunicam através de uma rede e coordenam suas ações por meio de troca de mensagens, aparentando aos usuários finais ser um sistema único e integrado (Couloris et al., Tanenbaum & Van Steen).

Neste projeto, o sistema não é uma aplicação monolítica rodando em um único processo. Ele é composto por **múltiplos nós autônomos**, cada um executando em seu próprio ambiente e espaço de memória:

```
+---------------------------------------------------------------------------------------+
|                                    NÓS DE BORDA (IoT)                                 |
|  [Simulador Python TRK_01]     [Simulador Python TRK_02]     [Stick STICK_CCET_UFMA]  |
+---------------------------------------------------------------------------------------+
                                           │
                              Rede TCP/IP & Protocolo MQTT
                                           ▼
+---------------------------------------------------------------------------------------+
|                                     BROKER MQTT                                       |
|                                 (Eclipse Mosquitto)                                   |
+---------------------------------------------------------------------------------------+
                                           │
                                 Assinatura de Tópicos
                                           ▼
+---------------------------------------------------------------------------------------+
|                                   NÓ CENTRAL (Servidor)                               |
|                     Backend Node.js + Fastify + Drizzle ORM                           |
+------------------------------------------+--------------------------------------------+
                                           │
                        WebSockets (RFC 6455) & REST HTTP
                                           ▼
+---------------------------------------------------------------------------------------+
|                                   CLIENTES (Frontend)                                 |
|                     Painel Administrativo React + Leaflet (SPA)                       |
+---------------------------------------------------------------------------------------+
```

---

## Conceito 1: Comunicação por Troca de Mensagens (Message Passing vs Shared Memory)

### Teoria
Em sistemas centralizados ou multithread clássicos em uma única máquina, a comunicação ocorre predominantemente via **Memória Compartilhada** (*Shared Memory*), com variáveis globais e primitivas de sincronização locais (*mutexes*, semáforos).  
Em sistemas distribuídos, os nós **não compartilham memória física nem clock central**. Portanto, a comunicação é estritamente baseada em **Troca de Mensagens** (*Message Passing*).

### Aplicação no Projeto
- Os simuladores Python (**Trackers** e **Sticks**) não acessam o banco de dados MySQL diretamente e não realizam chamadas de função locais no backend.
- Toda informação sobre bateria, latitude, longitude e sinal de rádio é empacotada em uma estrutura de dados discreta (payload serializado em formato JSON) e transmitida pela rede através de sockets TCP para o broker de mensagens:
```python
# Trecho de simulators/tracker/tracker_sim.py
payload = {
    "t_id": self.tracker_ref,
    "s_id": self.stick_ref,
    "lat": lat,
    "lon": lon,
    "bat": bat_mv,
    "lr_rssi": rssi_value,
    "timestamp": int(time.time() * 1000)
}
self.mqtt.publish_telemetry(payload)
```

---

## Conceito 2: Arquitetura Orientada a Eventos e Padrão Publish/Subscribe

### Teoria
O padrão **Publish/Subscribe (Pub/Sub)** provê três dimensões cruciais de **desacoplamento**:
1. **Desacoplamento Espacial:** Os publicadores não sabem quem são os consumidores, quantos são ou onde estão na rede.
2. **Desacoplamento Temporal:** Publicador e assinante não precisam estar conectados simultaneamente se houver filas ou retenção de mensagens.
3. **Desacoplamento de Sincronização:** A publicação não bloqueia o nó emissor aguardando que o receptor termine de processar o dado.

```
+------------+                                            +------------+
| Publicador | ──[ Publica: pawsition/trackers/TRK_01 ]──>|   Broker   |
+------------+                                            |    MQTT    |
                                                          +-----+------+
                                                                │
                                    ┌───────────────────────────┴───────────────────────────┐
                                    ▼                                                       ▼
                             +------------+                                          +------------+
                             | Consumidor |                                          | Consumidor |
                             | (Backend)  |                                          | (Logger)   |
                             +------------+                                          +------------+
```

### Aplicação no Projeto
- **Broker Central (Eclipse Mosquitto):** Atua como o barramento neutro de mensageria na porta `1883`.
- **Nível de Qualidade de Serviço (QoS 1 - At Least Once):** Garante a entrega das mensagens de telemetria através de confirmação (*PUBACK*), prevenindo perda de pacotes em redes com oscilação.
- O simulador Python simplesmente publica nos tópicos. Se o backend reiniciar ou sofrer manutenção, o nó sensor continua operando de forma autônoma.

---

## Conceito 3: Identificação, Nomenclatura e Roteamento de Mensagens

### Teoria
Em sistemas distribuídos, a **Nomenclatura (Naming)** define como entidades e recursos são identificados e localizados sem ambiguidade. O roteamento por tópicos no MQTT utiliza um esquema de nomenclatura hierárquica baseada em strings com suporte a curingas (*wildcards* `+` e `#`).

### Aplicação no Projeto
Definiu-se uma convenção taxonômica uniforme para todos os nós:

| Estrutura do Tópico | Significado | Exemplo Real |
| :--- | :--- | :--- |
| `pawsition/trackers/{ref}/telemetry` | Canal de dados periódicos da coleira | `pawsition/trackers/TRK_DOG_01/telemetry` |
| `pawsition/trackers/{ref}/status` | Canal de presença e ciclo de vida | `pawsition/trackers/TRK_DOG_01/status` |
| `pawsition/sticks/{ref}/telemetry` | Canal de integridade do gateway | `pawsition/sticks/STICK_CCET_UFMA/telemetry` |
| `pawsition/sticks/{ref}/config` | Canal de controle bidirecional | `pawsition/sticks/STICK_CCET_UFMA/config` |

No backend ([backend/src/infrastructure/mqtt/index.ts](file:///home/yuri/Documentos/UFMA/Kauane/Distribuidos/backend/src/infrastructure/mqtt/index.ts)), uma única subscrição com *single-level wildcard* (`+`) roteia concorrentemente os eventos de centenas de dispositivos:
```typescript
this.client.subscribe([
  "pawsition/trackers/+/telemetry",
  "pawsition/trackers/+/status",
  "pawsition/sticks/+/telemetry",
  "pawsition/sticks/+/status"
]);
```

---

## Conceito 4: Processamento Assíncrono e Concorrência Não-Bloqueante

### Teoria
Servidores centralizados em sistemas distribuídos de IoT precisam lidar com o problema da **alta concorrência de I/O** (milhares de pacotes por segundo chegando de diferentes origens).  
Modelos tradicionais baseados em "uma thread por conexão" (*thread-per-connection*) consomem excessiva memória de stack e sofrem com trocas de contexto (*context switching*).

### Aplicação no Projeto
- O backend foi implementado utilizando o **Fastify** com **Node.js** sobre uma arquitetura orientada a eventos baseada no **Event Loop (Reactor Pattern)**.
- Operações de rede MQTT, inserções no banco MySQL e broadcasts WebSocket são tratadas como promessas assíncronas não-bloqueantes (`async/await` com I/O multiplexado via `epoll` do Linux).
- Isso permite que o backend ingira telemetria via MQTT enquanto responde requisições REST da interface administrativa com latência próxima a zero.

---

## Conceito 5: Detecção de Falhas e Presença com Last Will and Testament (LWT)

### Teoria
A **Detecção de Falhas (Failure Detection)** é um dos problemas fundamentais de sistemas distribuídos (Fischer, Lynch, Paterson - Teorema FLP). Em uma rede não-confiável, é impossível distinguir com certeza absoluta um nó lento de um nó que falhou definitivamente.  
Existem duas abordagens clássicas:
1. **Heartbeat periódico:** O nó envia um "estou vivo" a cada $N$ segundos. Se o servidor não receber após um timeout $T$, presume-se falha.
2. **Last Will and Testament (LWT):** Mecanismo onde o cliente registra previamente no broker uma mensagem testamentária a ser disparada se a conexão TCP for interrompida sem aviso (queda de sinal, falta de energia, falha de processo).

```
[Dispositivo IoT] ──── Registra LWT ao conectar ───> [ Broker MQTT ]
       │                                                    │
 (Queda / Falha)                                            │ Disparo Automático
       x                                                    ▼
                                            [ pawsition/trackers/TRK_01/status ]
                                            { "status": "offline", "reason": "unexpected" }
                                                            │
                                                            ▼
                                                    [ Backend Node.js ]
                                                            │
                                                            ▼
                                                    [ WebSocket Push: OFFLINE ]
```

### Aplicação no Projeto
Implementado em [simulators/common/mqtt_client.py](file:///home/yuri/Documentos/UFMA/Kauane/Distribuidos/simulators/common/mqtt_client.py):
```python
lwt_payload = json.dumps({
    "status": "offline",
    "deviceType": self.device_type,
    "deviceRef": self.device_ref,
    "reason": "unexpected_disconnect"
})
# O broker retém o testamento e publica imediatamente se a conexão TCP morrer
self.client.will_set(self.status_topic, payload=lwt_payload, qos=1, retain=True)
```
Se você executar `Ctrl+C` no terminal do simulador ou derrubar o container, o broker identifica a desconexão e o frontend atualiza o badge do pet para **Offline** instantaneamente.

---

## Conceito 6: Sincronização em Tempo Real via WebSockets (Push vs Polling)

### Teoria
Para atualizar interfaces de usuário com dados de nós distribuídos, existem duas abordagens:
- **Short/Long Polling HTTP:** O cliente requisita repetidamente `GET /api/locations` a cada $X$ segundos. Gera overhead imenso de cabeçalhos HTTP (TCP handshake, SSL/TLS negotiation) e latência de detecção.
- **WebSockets (RFC 6455):** Estabelece um túnel full-duplex bidirecional sobre uma única conexão TCP persistente. O servidor empurra o dado (*server push*) imediatamente no instante em que ele é gerado.

```
HTTP Polling (Ineficiente):
Cliente  ── GET /locations ──> Servidor (Nada novo)
Cliente  ── GET /locations ──> Servidor (Nada novo)
Cliente  ── GET /locations ──> Servidor (Ponto novo!)

WebSocket Push (Adotado):
Cliente  <════════ Conexão TCP Persistente Bidirecional ════════> Servidor
                                                         [Evento MQTT Chegou]
Cliente  <────── PUSH: { event: "LOCATION_UPDATE" } ──────────── Servidor
```

### Aplicação no Projeto
- O backend conta com um gerenciador central de WebSockets ([backend/src/infrastructure/websocket/index.ts](file:///home/yuri/Documentos/UFMA/Kauane/Distribuidos/backend/src/infrastructure/websocket/index.ts)) no endpoint `/ws`.
- No frontend React, o hook `useWebSocket` mantém reconexão com *backoff* exponencial e atualiza a rota no mapa Leaflet sem necessidade de refresh (F5).

---

## Conceito 7: Arquitetura de Borda e Gateways Intermediários (O Papel dos Sticks)

### Teoria
Em redes de sensores corporais/animais (BAN - *Body Area Networks*) ou IoT urbano, dispositivos móveis alimentados por bateria pequena não possuem rádios potentes de longo alcance ou pilhas de rede completas (IP).  
Adota-se a arquitetura de **Edge Gateway**:
- **Trackers (Nó Sensor Móvel):** Rádios de baixo consumo (BLE / LoRa / Sub-GHz).
- **Sticks (Gateway de Borda):** Dispositivo fixo de maior potência conectado ao Wi-Fi residencial ou do campus, responsável por escutar o sinal dos trackers no ar, medir o RSSI (intensidade do sinal) e encaminhar os dados para o broker MQTT na nuvem.

### Aplicação no Projeto
- O simulador Python emula o Stick como um ponto de coleta fixo no campus da UFMA (ex: `STICK_CCET_UFMA` e `STICK_BIBLIOTECA`).
- O backend suporta **controle remoto bidirecional**: o operador do sistema pode enviar um comando de reconfiguração de Wi-Fi (`pawsition/sticks/{stick_ref}/config`), e o gateway de borda reconfigura suas credenciais em tempo real.

---

## Conceito 8: Tempo, Ordenação e Validação de Coordenadas (Haversine)

### Teoria
Em sistemas distribuídos, **não existe um relógio físico universal sincronizado** (problema resolvido de forma imperfeita por NTP ou relógios lógicos de Lamport). Dados de nós sensores podem chegar com atraso ou com pequenas variações geradas por ruído e imperfeições de leitura de satélites GPS.

### Aplicação no Projeto
1. **Timestamping na Origem e no Destino:** O nó sensor registra a hora exata da captura física (`timestamp`), enquanto o servidor central adiciona o carimbo de persistência (`captured_at`).
2. **Filtro de Deslocamento Mínimo (Fórmula de Haversine):**  
   Para evitar explosão de registros redundantes quando o animal está dormindo ou parado, o backend calcula a distância geodésica entre o último ponto conhecido e a nova coordenada:

$$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$

Se a distância calculada for inferior ao limiar (ex: $3.0\text{ m}$), o sistema reconhece o animal como estacionário, atualizando apenas a telemetria de bateria e timestamp sem inflar a base de dados.

---

## Conceito 9: Isolamento, Virtualização de Rede e Orquestração com Docker

### Teoria
A heterogeneidade de linguagens e tecnologias (Python, Node.js, C/C++ do Mosquitto, MySQL) é uma das marcas dos sistemas distribuídos reais. Para garantir que o cluster funcione de forma idêntica em qualquer nó ou servidor, utiliza-se **conteinerização** (*cgroups* e *namespaces* no kernel Linux).

### Aplicação no Projeto
Através do [docker-compose.yml](file:///home/yuri/Documentos/UFMA/Kauane/Distribuidos/docker-compose.yml):
- Todos os serviços compartilham uma **rede virtual privada em bridge**.
- Resolução de nomes interna via DNS do Docker (o backend se conecta a `mqtt://mosquitto:1883` e `mysql:3306` usando nomes de domínio do cluster em vez de IPs estáticos).
- **Healthchecks declarativos:** o backend aguarda ativamente até que o container do MySQL responda à primitiva `mysqladmin ping` antes de iniciar suas migrações de dados.

---

## 📊 Matriz Resumo dos Conceitos

| Conceito de Sistemas Distribuídos | Componente Envolvido | Implementação Prática no Código |
| :--- | :--- | :--- |
| **Troca de Mensagens (IPC)** | Python Simulators $\leftrightarrow$ Mosquitto | Pacotes serializados em JSON via TCP socket |
| **Publish/Subscribe** | Mosquitto Broker | Desacoplamento temporal e espacial nos tópicos `pawsition/*` |
| **Detecção de Falhas (LWT)** | `mqtt_client.py` e Mosquitto | Disparo automático de status `offline` na queda de conexão |
| **Assincronismo & Concorrência** | Fastify (Node.js) | Event Loop não-bloqueante para alta vazão de telemetria |
| **Comunicação Push (Real-Time)** | Servidor WebSocket e React | Túnel full-duplex (`/ws`) atualizando o mapa sem polling |
| **Edge Computing / Gateways** | Sticks Simulator | Gateways Wi-Fi intermediando coleiras e aceitando comandos |
| **Consistência e Validação** | `helpers.ts` (Haversine) | Filtro de distância geodésica mínima de $3\text{ m}$ |
| **Virtualização e Rede** | Docker Compose | Rede bridge isolada, DNS interno e healthchecks |
