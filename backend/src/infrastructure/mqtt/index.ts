import mqtt, { type MqttClient } from "mqtt";

/**
 * Serviço MQTT Otimizado:
 * A ingestão pesada de telemetria foi migrada para o Middleware InterSCity.
 * O MQTT é mantido apenas como canal de controle leve para comandos e configurações remotas.
 */
class MqttService {
  private client: MqttClient | null = null;
  private isConnected = false;

  public connect() {
    const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
    const clientId = `${process.env.MQTT_CLIENT_ID || "pet-tracker-backend"}_${Math.random().toString(16).substring(2, 8)}`;

    console.log(`[MQTT] Conectando ao broker leve em ${brokerUrl}...`);

    this.client = mqtt.connect(brokerUrl, {
      clientId,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 5000,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    });

    this.client.on("connect", () => {
      this.isConnected = true;
      console.log(`[MQTT] Conectado ao broker para controle de comandos (ingestão delegada ao InterSCity).`);
    });

    this.client.on("error", (err) => {
      console.warn("[MQTT] Alerta de conexão com broker MQTT:", err.message);
    });

    this.client.on("close", () => {
      this.isConnected = false;
    });
  }

  public publishConfig(stickRef: string, configPayload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        return resolve(); // Não bloqueia se broker offline
      }

      const topic = `pawsition/sticks/${stickRef}/config`;
      const payloadStr = JSON.stringify(configPayload);

      this.client.publish(topic, payloadStr, { qos: 1 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public publishCommand(trackerRef: string, commandPayload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        return resolve();
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
      role: "command-control-only (telemetry delegated to InterSCity)",
    };
  }
}

export const mqttService = new MqttService();
