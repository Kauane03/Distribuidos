import mqtt, { type MqttClient } from "mqtt";
import { db } from "../database/index.js";
import {
  trackers,
  sticks,
  pets,
  petTrackers,
  rastreios,
  deviceEvents,
} from "../database/schema.js";
import { eq, and, isNull, desc } from "drizzle-orm";
import { wsManager } from "../websocket/index.js";
import {
  voltageToPercent,
  calculateDistanceMeters,
  getSignalQuality,
} from "./helpers.js";

class MqttService {
  private client: MqttClient | null = null;
  private isConnected = false;

  public connect() {
    const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
    const clientId = `${process.env.MQTT_CLIENT_ID || "pet-tracker-backend"}_${Math.random().toString(16).substring(2, 8)}`;

    console.log(`[MQTT] Conectando ao broker em ${brokerUrl} com clientId: ${clientId}...`);

    this.client = mqtt.connect(brokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 3000,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    });

    this.client.on("connect", () => {
      this.isConnected = true;
      console.log(`[MQTT] Conexão estabelecida com sucesso com o broker!`);

      // Subscreve aos tópicos dos dispositivos
      const topics = [
        "pawsition/trackers/+/telemetry",
        "pawsition/trackers/+/status",
        "pawsition/sticks/+/telemetry",
        "pawsition/sticks/+/status",
        "pawsition/devices/+/telemetry",
      ];

      this.client?.subscribe(topics, (err) => {
        if (err) {
          console.error("[MQTT] Erro ao subscrever aos tópicos:", err);
        } else {
          console.log(`[MQTT] Subscrito com sucesso aos tópicos: ${topics.join(", ")}`);
        }
      });
    });

    this.client.on("message", (topic, message) => {
      this.handleMessage(topic, message.toString()).catch((err) => {
        console.error(`[MQTT] Erro ao processar mensagem do tópico ${topic}:`, err);
      });
    });

    this.client.on("error", (err) => {
      console.error("[MQTT] Erro no cliente MQTT:", err.message);
    });

    this.client.on("reconnect", () => {
      console.log("[MQTT] Tentando reconectar ao broker...");
    });

    this.client.on("close", () => {
      this.isConnected = false;
      console.log("[MQTT] Conexão com o broker encerrada.");
    });
  }

  private async handleMessage(topic: string, rawPayload: string) {
    let payload: any;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      console.warn(`[MQTT] Payload inválido no tópico ${topic}:`, rawPayload);
      return;
    }

    const topicParts = topic.split("/");
    const deviceCategory = topicParts[1]; // 'trackers', 'sticks', ou 'devices'
    const deviceRefFromTopic = topicParts[2];
    const messageType = topicParts[3] || "telemetry"; // 'telemetry' ou 'status'

    console.log(`[MQTT Ingestion] [${topic}] -> ${rawPayload}`);

    // Salva evento no log para auditoria e demonstração de sistemas distribuídos
    await db.insert(deviceEvents).values({
      deviceType: deviceCategory === "sticks" ? "stick" : "tracker",
      deviceRef: deviceRefFromTopic || payload.t_id || payload.s_id || "UNKNOWN",
      eventType: messageType,
      topic,
      payload: rawPayload,
      createdAt: new Date(),
    });

    // Notifica frontend sobre o evento bruto recebido no barramento
    wsManager.broadcast("DEVICE_EVENT", {
      topic,
      payload,
      deviceRef: deviceRefFromTopic,
      messageType,
      receivedAt: new Date().toISOString(),
    });

    // Se for mensagem de STATUS (heartbeat / online / offline)
    if (messageType === "status") {
      await this.handleStatusMessage(deviceCategory, deviceRefFromTopic, payload);
      return;
    }

    // Se for mensagem de TELEMETRIA de Tracker
    if (deviceCategory === "trackers" || payload.t_id) {
      await this.handleTrackerTelemetry(topic, payload, deviceRefFromTopic);
      return;
    }

    // Se for mensagem de TELEMETRIA de Stick
    if (deviceCategory === "sticks" || payload.s_id) {
      await this.handleStickTelemetry(topic, payload, deviceRefFromTopic);
      return;
    }
  }

  private async handleStatusMessage(category: string, deviceRef: string, payload: any) {
    const isOnline = payload.status === "online" || payload.status === true || payload.isOnline === true;
    const now = new Date();

    if (category === "trackers" || payload.deviceType === "tracker") {
      const tracker = await db.query.trackers.findFirst({
        where: eq(trackers.trackerRef, deviceRef),
      });

      if (tracker) {
        const batPercent = voltageToPercent(payload.bat ?? payload.bateria);
        await db
          .update(trackers)
          .set({
            isOnline,
            lastSeen: now,
            bateria: batPercent !== null ? String(batPercent) : tracker.bateria,
            updatedAt: now,
          })
          .where(eq(trackers.id, tracker.id));

        wsManager.broadcast("DEVICE_STATUS", {
          deviceType: "tracker",
          deviceRef,
          isOnline,
          bateria: batPercent ?? Number(tracker.bateria),
          lastSeen: now.toISOString(),
        });
      }
    } else if (category === "sticks" || payload.deviceType === "stick") {
      const stick = await db.query.sticks.findFirst({
        where: eq(sticks.stickRef, deviceRef),
      });

      if (stick) {
        const batPercent = voltageToPercent(payload.sbat ?? payload.bateria);
        await db
          .update(sticks)
          .set({
            isOnline,
            lastSeen: now,
            bateria: batPercent !== null ? String(batPercent) : stick.bateria,
            wifiSsid: payload.wifi_ssid || stick.wifiSsid,
            updatedAt: now,
          })
          .where(eq(sticks.id, stick.id));

        wsManager.broadcast("DEVICE_STATUS", {
          deviceType: "stick",
          deviceRef,
          isOnline,
          bateria: batPercent ?? Number(stick.bateria),
          wifiSsid: payload.wifi_ssid || stick.wifiSsid,
          lastSeen: now.toISOString(),
        });
      }
    }
  }

  private async handleTrackerTelemetry(topic: string, data: any, deviceRefFromTopic?: string) {
    const trackerRef = data.t_id || deviceRefFromTopic;
    if (!trackerRef) {
      console.warn("[MQTT] Telemetria de tracker recebida sem identificador (t_id)");
      return;
    }

    const lat = data.lat !== undefined && data.lat !== null ? Number(data.lat) : null;
    const lon = data.lon !== undefined && data.lon !== null ? Number(data.lon) : (data.long !== undefined ? Number(data.long) : null);

    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
      console.warn(`[MQTT] Coordenadas inválidas recebidas de ${trackerRef}: lat=${lat}, lon=${lon}`);
      return;
    }

    // 1. Busca ou cadastra automaticamente o tracker se for dispositivo novo
    let tracker = await db.query.trackers.findFirst({
      where: eq(trackers.trackerRef, trackerRef),
    });

    const batTrackerPercent = voltageToPercent(data.bat);
    const now = new Date();

    if (!tracker) {
      console.log(`[MQTT] Auto-cadastrando novo tracker detectado na rede: ${trackerRef}`);
      const [newTrk] = await db
        .insert(trackers)
        .values({
          trackerRef,
          status: true,
          bateria: batTrackerPercent !== null ? String(batTrackerPercent) : null,
          isOnline: true,
          lastSeen: now,
        })
        .$returningId();
      tracker = await db.query.trackers.findFirst({ where: eq(trackers.id, newTrk.id) });
    } else {
      await db
        .update(trackers)
        .set({
          isOnline: true,
          lastSeen: now,
          bateria: batTrackerPercent !== null ? String(batTrackerPercent) : tracker.bateria,
          updatedAt: now,
        })
        .where(eq(trackers.id, tracker.id));
    }

    if (!tracker) return;

    // 2. Busca stick se informado (s_id)
    let stickId: number | null = null;
    let batStickPercent: number | null = null;
    if (data.s_id) {
      const stickRef = data.s_id;
      let stick = await db.query.sticks.findFirst({
        where: eq(sticks.stickRef, stickRef),
      });

      batStickPercent = voltageToPercent(data.sbat);

      if (!stick) {
        console.log(`[MQTT] Auto-cadastrando novo stick gateway detectado: ${stickRef}`);
        const [newStk] = await db
          .insert(sticks)
          .values({
            stickRef,
            status: true,
            bateria: batStickPercent !== null ? String(batStickPercent) : null,
            isOnline: true,
            lastSeen: now,
          })
          .$returningId();
        stick = await db.query.sticks.findFirst({ where: eq(sticks.id, newStk.id) });
      } else {
        await db
          .update(sticks)
          .set({
            isOnline: true,
            lastSeen: now,
            bateria: batStickPercent !== null ? String(batStickPercent) : stick.bateria,
            updatedAt: now,
          })
          .where(eq(sticks.id, stick.id));
      }

      if (stick) {
        stickId = stick.id;
      }
    }

    // 3. Procura vínculo ativo do pet com este tracker
    const vinculo = await db.query.petTrackers.findFirst({
      where: and(eq(petTrackers.trackerId, tracker.id), isNull(petTrackers.dataFim)),
      with: { pet: true },
    });

    if (!vinculo || !vinculo.pet) {
      console.warn(`[MQTT] Tracker ${trackerRef} sem vínculo ativo com nenhum pet.`);
      // Mesmo sem pet, atualizamos o status do tracker no WebSocket
      wsManager.broadcast("DEVICE_STATUS", {
        deviceType: "tracker",
        deviceRef: trackerRef,
        isOnline: true,
        bateria: batTrackerPercent,
        lastSeen: now.toISOString(),
      });
      return;
    }

    const pet = vinculo.pet;
    const rssi = data.lr_rssi !== undefined ? Number(data.lr_rssi) : null;

    // 4. Verificação de distância mínima (Haversine 3-5m)
    const ultimoRastreio = await db.query.rastreios.findFirst({
      where: eq(rastreios.trackerId, tracker.id),
      orderBy: [desc(rastreios.capturedAt)],
    });

    let deveInserirNovo = true;
    const DISTANCIA_MINIMA = 3.0; // metros

    if (ultimoRastreio) {
      const dist = calculateDistanceMeters(
        Number(ultimoRastreio.lat),
        Number(ultimoRastreio.long),
        lat,
        lon
      );

      if (dist < DISTANCIA_MINIMA) {
        // Dispositivo estacionário: atualiza apenas timestamp e baterias
        await db
          .update(rastreios)
          .set({
            capturedAt: now,
            bateriaTracker: batTrackerPercent !== null ? String(batTrackerPercent) : ultimoRastreio.bateriaTracker,
            bateriaStick: batStickPercent !== null ? String(batStickPercent) : ultimoRastreio.bateriaStick,
            rssi: rssi !== null ? String(rssi) : ultimoRastreio.rssi,
          })
          .where(eq(rastreios.id, ultimoRastreio.id));

        deveInserirNovo = false;
        console.log(`[MQTT] Pet ${pet.nome} estacionário (${dist.toFixed(1)}m < ${DISTANCIA_MINIMA}m). Atualizado timestamp.`);
      }
    }

    if (deveInserirNovo) {
      await db.insert(rastreios).values({
        trackerId: tracker.id,
        petId: pet.id,
        stickId,
        lat: String(lat),
        long: String(lon),
        rssi: rssi !== null ? String(rssi) : null,
        bateriaStick: batStickPercent !== null ? String(batStickPercent) : null,
        bateriaTracker: batTrackerPercent !== null ? String(batTrackerPercent) : null,
        capturedAt: now,
      });

      console.log(`[MQTT] Novo ponto gravado para Pet ${pet.nome} (${trackerRef}): lat=${lat}, lon=${lon}, bat=${batTrackerPercent}%`);
    }

    // 5. Broadcast para o Frontend via WebSocket em tempo real
    const signalQuality = getSignalQuality(rssi);

    wsManager.broadcast("LOCATION_UPDATE", {
      petId: pet.id,
      petNome: pet.nome,
      petFoto: pet.pathFoto,
      raca: pet.raca,
      trackerId: tracker.id,
      trackerRef,
      stickRef: data.s_id || null,
      lat,
      lng: lon,
      rssi,
      qualidadeSinal: signalQuality,
      bateriaTracker: batTrackerPercent,
      bateriaStick: batStickPercent,
      capturedAt: now.toISOString(),
      isMoving: deveInserirNovo,
    });

    // 6. Alerta se bateria estiver muito baixa (< 15%) ou sinal muito fraco
    if (batTrackerPercent !== null && batTrackerPercent < 15) {
      wsManager.broadcast("ALERT", {
        type: "LOW_BATTERY",
        severity: "warning",
        title: "Bateria Fraca",
        message: `O tracker ${trackerRef} do pet ${pet.nome} está com bateria crítica (${batTrackerPercent}%).`,
        petId: pet.id,
        deviceRef: trackerRef,
        timestamp: now.toISOString(),
      });
    }
  }

  private async handleStickTelemetry(topic: string, data: any, deviceRefFromTopic?: string) {
    const stickRef = data.s_id || deviceRefFromTopic;
    if (!stickRef) return;

    let stick = await db.query.sticks.findFirst({
      where: eq(sticks.stickRef, stickRef),
    });

    const batStickPercent = voltageToPercent(data.sbat ?? data.bateria);
    const now = new Date();

    if (!stick) {
      const [newStk] = await db
        .insert(sticks)
        .values({
          stickRef,
          status: true,
          bateria: batStickPercent !== null ? String(batStickPercent) : null,
          isOnline: true,
          lastSeen: now,
          wifiSsid: data.wifi_ssid || null,
        })
        .$returningId();
      stick = await db.query.sticks.findFirst({ where: eq(sticks.id, newStk.id) });
    } else {
      await db
        .update(sticks)
        .set({
          isOnline: true,
          lastSeen: now,
          bateria: batStickPercent !== null ? String(batStickPercent) : stick.bateria,
          wifiSsid: data.wifi_ssid || stick.wifiSsid,
          updatedAt: now,
        })
        .where(eq(sticks.id, stick.id));
    }

    wsManager.broadcast("DEVICE_STATUS", {
      deviceType: "stick",
      deviceRef: stickRef,
      isOnline: true,
      bateria: batStickPercent,
      wifiSsid: data.wifi_ssid || stick?.wifiSsid,
      lastSeen: now.toISOString(),
    });
  }

  public publishConfig(stickRef: string, configPayload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        return reject(new Error("Cliente MQTT não conectado"));
      }

      const topic = `pawsition/sticks/${stickRef}/config`;
      const payloadStr = JSON.stringify(configPayload);

      this.client.publish(topic, payloadStr, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Erro ao publicar config para ${topic}:`, err);
          return reject(err);
        }

        console.log(`[MQTT] Configuração publicada para ${topic}:`, payloadStr);

        // Registra evento de envio
        db.insert(deviceEvents)
          .values({
            deviceType: "stick",
            deviceRef: stickRef,
            eventType: "config",
            topic,
            payload: payloadStr,
            createdAt: new Date(),
          })
          .catch(console.error);

        resolve();
      });
    });
  }

  public publishCommand(trackerRef: string, commandPayload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        return reject(new Error("Cliente MQTT não conectado"));
      }

      const topic = `pawsition/trackers/${trackerRef}/command`;
      const payloadStr = JSON.stringify(commandPayload);

      this.client.publish(topic, payloadStr, { qos: 1 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      broker: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    };
  }
}

export const mqttService = new MqttService();
