import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wsManager } from "../websocket/index.js";
import { voltageToPercent, getSignalQuality } from "../mqtt/helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tipagem estrita da estrutura de dados do InterSCity
export interface InterSCityResourceMeta {
  tracker_ref: string;
  uuid: string;
  pet_name: string;
  lat: number;
  lon: number;
}

export interface InterSCityTelemetryData {
  t_id?: string;
  s_id?: string;
  lat: number;
  lon: number;
  battery?: number;
  bat?: number;
  sbat?: number;
  rssi?: number;
  lr_rssi?: number;
  speed?: number;
  timestamp?: number;
  updated_at?: string;
}

export interface LocationBroadcastPayload {
  trackerRef: string;
  petNome: string;
  stickRef: string | null;
  lat: number;
  lng: number;
  rssi: number | null;
  qualidadeSinal: "Excelente" | "Bom" | "Fraco";
  bateriaTracker: number | null;
  bateriaStick: number | null;
  capturedAt: string;
  isMoving: boolean;
}

class InterSCityService {
  private baseUrl: string;
  private resources: InterSCityResourceMeta[] = [];
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastSeenTimestamps: Map<string, number> = new Map();

  constructor() {
    this.baseUrl = (process.env.INTERSCITY_URL || "http://interscity:8000").replace(/\/+$/, "");
  }

  /**
   * Inicializa o serviço carregando a lista de recursos cadastrados
   * a partir do catálogo local gerado pelo seed ou do próprio InterSCity.
   */
  public async initialize(): Promise<void> {
    this.loadLocalResources();

    if (this.resources.length === 0) {
      await this.fetchResourcesFromCatalog();
    }

    console.log(
      `[InterSCity] Serviço inicializado com ${this.resources.length} recursos mapeados (URL: ${this.baseUrl})`
    );
  }

  /**
   * Carrega mapeamento gerado previamente pelo script seed_interscity
   */
  private loadLocalResources(): void {
    const candidates = [
      path.resolve(__dirname, "../../../data/interscity_resources.json"),
      path.resolve(__dirname, "../../../../simulators/interscity_resources.json"),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.resources)) {
            this.resources = parsed.resources;
            console.log(`[InterSCity] ${this.resources.length} recursos carregados de ${filePath}`);
            return;
          }
        } catch (err: any) {
          console.warn(`[InterSCity] Falha ao carregar ${filePath}:`, err.message);
        }
      }
    }
  }

  /**
   * Consulta a API do Resource Catalog do InterSCity caso não haja arquivo local
   */
  private async fetchResourcesFromCatalog(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/catalog/resources`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return;

      const body = (await response.json()) as any;
      const list = body.resources || body.data || [];

      if (Array.isArray(list)) {
        this.resources = list.map((item: any, idx: number) => ({
          tracker_ref: item.description?.match(/TRK_VIRTUAL_\d+/)?.[0] || `TRK_VIRTUAL_${String(idx + 1).padStart(3, "0")}`,
          uuid: item.uuid || item.id,
          pet_name: item.description || `Pet Virtual #${idx + 1}`,
          lat: Number(item.lat) || -2.5578,
          lon: Number(item.lon) || -44.3113,
        }));
      }
    } catch {
      // Falha silenciosa caso o catálogo ainda não esteja disponível
    }
  }

  /**
   * Inicia o ciclo contínuo de polling com broadcast via WebSocket
   */
  public startPolling(intervalMs = 2500): void {
    if (this.pollingTimer) return;

    this.isPolling = true;
    console.log(`[InterSCity] Iniciando rotina otimizada de pooling a cada ${intervalMs}ms...`);

    // Executa a primeira verificação imediatamente
    this.syncLatestData().catch((err) => {
      console.warn("[InterSCity] Erro no ciclo inicial de sincronização:", err.message);
    });

    this.pollingTimer = setInterval(() => {
      this.syncLatestData().catch((err) => {
        console.warn("[InterSCity] Erro no ciclo de polling:", err.message);
      });
    }, intervalMs);
  }

  /**
   * Para a rotina de polling
   */
  public stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.isPolling = false;
      console.log("[InterSCity] Rotina de polling encerrada.");
    }
  }

  /**
   * Consulta a telemetria mais recente no InterSCity e faz push via WebSocket.
   * Aplica estratégia híbrida: tenta o endpoint de lote (batch) para alta performance;
   * se indisponível, faz consultas concorrentes com chunks controlados.
   */
  public async syncLatestData(): Promise<void> {
    // Se não houver clientes WebSocket ouvindo, reduz processamento
    if (wsManager.getConnectedClientsCount() === 0 && this.resources.length > 50) {
      return;
    }

    // 1. Tenta o endpoint agregador em lote (1 única requisição HTTP para todos os recursos)
    const batchHandled = await this.tryBatchCollectionSync();
    if (batchHandled) return;

    // 2. Fallback: Consulta individual em chunks concorrentes
    await this.syncIndividualResourcesInChunks(25);
  }

  /**
   * Tenta sincronizar via GET /collector/resources/data/last (lote)
   */
  private async tryBatchCollectionSync(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/collector/resources/data/last`, {
        headers: { Accept: "application/json" },
      });

      if (!resp.ok) return false;

      const body = (await resp.json()) as any;
      const dataList = body.data || body.resources;

      if (!Array.isArray(dataList) || dataList.length === 0) {
        return false;
      }

      for (const item of dataList) {
        this.processTelemetryItem(item.uuid, item);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Consulta o endpoint individual GET /collector/resources/{uuid}/data/last em chunks
   */
  private async syncIndividualResourcesInChunks(chunkSize = 25): Promise<void> {
    const list = this.resources.slice(0, 500);

    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk.map(async (resource) => {
          try {
            const data = await this.fetchResourceLastData(resource.uuid);
            if (data) {
              this.processTelemetryItem(resource.uuid, data, resource);
            }
          } catch {
            // Ignora falhas isoladas de rede
          }
        })
      );
    }
  }

  /**
   * Consulta o último dado de um recurso específico
   */
  public async fetchResourceLastData(uuid: string): Promise<InterSCityTelemetryData | null> {
    try {
      const url = `${this.baseUrl}/collector/resources/${uuid}/data/last`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;

      const body = (await res.json()) as any;
      return body.data || body.last_measure || body;
    } catch {
      return null;
    }
  }

  /**
   * Processa o dado de telemetria recebido e faz o broadcast se for atualizado
   */
  private processTelemetryItem(
    uuid: string,
    rawTelemetry: any,
    cachedMeta?: InterSCityResourceMeta
  ): void {
    if (!rawTelemetry) return;

    const lat = Number(rawTelemetry.lat ?? rawTelemetry.location?.lat);
    const lon = Number(rawTelemetry.lon ?? rawTelemetry.lng ?? rawTelemetry.location?.lon);

    if (isNaN(lat) || isNaN(lon)) return;

    const timestamp = Number(rawTelemetry.timestamp) || Date.now();
    const lastSeen = this.lastSeenTimestamps.get(uuid) || 0;

    // Descarta mensagens já enviadas anteriormente para economizar rede/processamento
    if (timestamp <= lastSeen) {
      return;
    }
    this.lastSeenTimestamps.set(uuid, timestamp);

    const trackerRef = rawTelemetry.t_id || cachedMeta?.tracker_ref || `TRK_${uuid.substring(0, 8)}`;
    const petNome = cachedMeta?.pet_name || `Pet (${trackerRef})`;
    const batPercent = voltageToPercent(rawTelemetry.battery ?? rawTelemetry.bat);
    const rssi = rawTelemetry.rssi ?? rawTelemetry.lr_rssi ?? null;
    const signalQuality = getSignalQuality(rssi);

    const payload: LocationBroadcastPayload = {
      trackerRef,
      petNome,
      stickRef: rawTelemetry.s_id || "STICK_CCET_UFMA",
      lat,
      lng: lon,
      rssi: rssi !== null ? Number(rssi) : null,
      qualidadeSinal: signalQuality,
      bateriaTracker: batPercent,
      bateriaStick: voltageToPercent(rawTelemetry.sbat) ?? 98,
      capturedAt: new Date(timestamp).toISOString(),
      isMoving: (rawTelemetry.speed ?? 1) > 0.1,
    };

    // Disparo em tempo real para os clientes conectados no React via WebSocket
    wsManager.broadcast("LOCATION_UPDATE", payload);

    // Alerta de bateria crítica caso esteja abaixo de 15%
    if (batPercent !== null && batPercent < 15) {
      wsManager.broadcast("ALERT", {
        type: "LOW_BATTERY",
        severity: "warning",
        title: "Bateria Fraca",
        message: `O tracker ${trackerRef} do ${petNome} está com ${batPercent}% de bateria.`,
        deviceRef: trackerRef,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public getStatus() {
    return {
      interscity_url: this.baseUrl,
      resources_mapped: this.resources.length,
      is_polling: this.isPolling,
    };
  }

  public getResources(): InterSCityResourceMeta[] {
    return this.resources;
  }
}

export const interscityService = new InterSCityService();

