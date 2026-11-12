import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wsManager } from "../websocket/index.js";
import { voltageToPercent, getSignalQuality } from "../mqtt/helpers.js";
import { db } from "../database/index.js";
import { pets, trackers, petTrackers } from "../database/schema.js";
import { eq, inArray } from "drizzle-orm";
import { seedVirtualPets, getSaoLuisCoordinates } from "../database/seed.js";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  id: number;
  petId: number;
  petNome: string;
  petFoto?: string | null;
  raca?: string | null;
  trackerId: number;
  trackerRef: string;
  stickId: number | null;
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

interface PetTrackerRelationCache {
  petId: number;
  trackerId: number;
  petNome: string;
  petFoto: string | null;
  raca: string | null;
}

class InterSCityService {
  private baseUrl: string;
  private resources: InterSCityResourceMeta[] = [];
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastSeenTimestamps: Map<string, number> = new Map();
  private petTrackerCache: Map<string, PetTrackerRelationCache> = new Map();
  private cacheLatestLocations: Map<string, LocationBroadcastPayload> = new Map();

  constructor() {
    this.baseUrl = (process.env.INTERSCITY_URL || "http://interscity:8000").replace(/\/+$/, "");
  }

  /**
   * Inicializa o serviço carregando recursos e sincronizando banco relacional
   */
  public async initialize(): Promise<void> {
    this.loadLocalResources();

    if (this.resources.length === 0) {
      await this.fetchResourcesFromCatalog();
    }

    // Sincroniza os 500 pets virtuais na base de dados relacional (MySQL)
    await this.ensureDatabaseSync();

    console.log(
      `[InterSCity] Serviço pronto com ${this.resources.length} recursos mapeados (${this.petTrackerCache.size} pets vinculados)`
    );
  }

  /**
   * Garante que os 1.500 pets virtuais estejam cadastrados e carregados no cache
   */
  private async ensureDatabaseSync(): Promise<void> {
    try {
      const targetCount = Number(process.env.TOTAL_TRACKERS || 1500);
      await seedVirtualPets(targetCount);

      // 2. Constrói o cache de vínculos entre trackers e pets
      const allTrackers = await db.select().from(trackers);
      const allPets = await db.select().from(pets);
      const allLinks = await db.select().from(petTrackers);

      const petsMap = new Map(allPets.map((p) => [p.id, p]));
      const linksByTrackerId = new Map(allLinks.map((l) => [l.trackerId, l.petId]));

      for (const trk of allTrackers) {
        const petId = linksByTrackerId.get(trk.id);
        const pet = petId ? petsMap.get(petId) : null;

        if (pet) {
          this.petTrackerCache.set(trk.trackerRef, {
            petId: pet.id,
            trackerId: trk.id,
            petNome: pet.nome,
            petFoto: pet.pathFoto,
            raca: pet.raca,
          });

          // Inicializa localização no cache com coordenadas espalhadas por São Luís
          const coords = getSaoLuisCoordinates(pet.id);
          const meta = this.resources.find((r) => r.tracker_ref === trk.trackerRef);
          const initialLat = meta?.lat ?? coords.lat;
          const initialLon = meta?.lon ?? coords.lon;

          this.cacheLatestLocations.set(trk.trackerRef, {
            id: pet.id,
            petId: pet.id,
            petNome: pet.nome,
            petFoto: pet.pathFoto,
            raca: pet.raca,
            trackerId: trk.id,
            trackerRef: trk.trackerRef,
            stickId: (pet.id % 5) + 1,
            stickRef: (pet.id % 2 === 0) ? "STICK_CENTRO_HISTORICO" : "STICK_CCET_UFMA",
            lat: initialLat,
            lng: initialLon,
            rssi: 78,
            qualidadeSinal: "Excelente",
            bateriaTracker: Number(trk.bateria) || 85,
            bateriaStick: 98,
            capturedAt: new Date().toISOString(),
            isMoving: true,
          });
        }
      }
    } catch (err: any) {
      console.warn("[InterSCity] Aviso na sincronização do banco relacional:", err.message);
    }
  }

  private generateDeterministicUuid(trackerRef: string): string {
    const hash = crypto.createHash("sha1").update(`pawsition.${trackerRef}`).digest("hex");
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      "5" + hash.substring(13, 16),
      ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
      hash.substring(20, 32),
    ].join("-");
  }

  private loadLocalResources(): void {
    const candidates = [
      path.resolve(__dirname, "../../../data/interscity_resources.json"),
      path.resolve(__dirname, "../../../../simulators/interscity_resources.json"),
      "/app/data/interscity_resources.json",
      "/app/simulators/interscity_resources.json"
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.resources) && parsed.resources.length > 0) {
            this.resources = parsed.resources;
            console.log(`[InterSCity] ${this.resources.length} recursos carregados de ${filePath}`);
            return;
          }
        } catch (err: any) {
          console.warn(`[InterSCity] Falha ao carregar ${filePath}:`, err.message);
        }
      }
    }

    // Se nenhum arquivo existir, gera os 1.500 mapeamentos de recursos em memória
    const targetCount = Number(process.env.TOTAL_TRACKERS || 1500);
    const generated: InterSCityResourceMeta[] = [];
    for (let i = 1; i <= targetCount; i++) {
      const ref = `TRK_VIRTUAL_${String(i).padStart(3, "0")}`;
      const coords = getSaoLuisCoordinates(i);
      generated.push({
        tracker_ref: ref,
        uuid: this.generateDeterministicUuid(ref),
        pet_name: `Pet #${String(i).padStart(3, "0")} (${coords.bairro})`,
        lat: coords.lat,
        lon: coords.lon,
      });
    }
    this.resources = generated;
    console.log(`[InterSCity] Gerados em memória ${this.resources.length} recursos distribuídos por São Luís`);
  }

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
      // Ignora falha se o catálogo ainda estiver iniciando
    }
  }

  public startPolling(intervalMs = 2500): void {
    if (this.pollingTimer) return;

    this.isPolling = true;
    console.log(`[InterSCity] Polling de 500 pets ativo a cada ${intervalMs}ms`);

    this.syncLatestData().catch((err) => {
      console.warn("[InterSCity] Aviso no primeiro ciclo de sync:", err.message);
    });

    this.pollingTimer = setInterval(() => {
      this.syncLatestData().catch((err) => {
        console.warn("[InterSCity] Aviso no polling de telemetria:", err.message);
      });
    }, intervalMs);
  }

  public stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.isPolling = false;
    }
  }

  public async syncLatestData(): Promise<void> {
    // 1. Tenta o endpoint agregador em lote
    const batchHandled = await this.tryBatchCollectionSync();
    if (batchHandled) return;

    // 2. Fallback: Consulta individual em chunks
    await this.syncIndividualResourcesInChunks(25);
  }

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

  private async syncIndividualResourcesInChunks(chunkSize = 50): Promise<void> {
    const list = this.resources;

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
            // Ignora falhas isoladas
          }
        })
      );
    }
  }

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
   * Processa a telemetria, atualiza o cache e faz broadcast via WebSocket
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

    if (timestamp <= lastSeen) {
      return;
    }
    this.lastSeenTimestamps.set(uuid, timestamp);

    const trackerRef = rawTelemetry.t_id || cachedMeta?.tracker_ref || `TRK_${uuid.substring(0, 8)}`;
    const relation = this.petTrackerCache.get(trackerRef);

    // Identificadores consistentes para o frontend
    const petId = relation?.petId ?? (parseInt(trackerRef.replace(/\D/g, ""), 10) || 1);
    const trackerId = relation?.trackerId ?? petId;
    const petNome = relation?.petNome || cachedMeta?.pet_name || `Pet Virtual #${petId}`;
    const petFoto = relation?.petFoto || null;
    const raca = relation?.raca || "Pet Virtual";

    const batPercent = voltageToPercent(rawTelemetry.battery ?? rawTelemetry.bat) ?? 85;
    const rssi = rawTelemetry.rssi ?? rawTelemetry.lr_rssi ?? 75;
    const signalQuality = getSignalQuality(rssi);

    const payload: LocationBroadcastPayload = {
      id: petId,
      petId,
      petNome,
      petFoto,
      raca,
      trackerId,
      trackerRef,
      stickId: 1,
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

    // Atualiza cache de localização mais recente
    this.cacheLatestLocations.set(trackerRef, payload);

    // 1. Broadcast de LOCALIZAÇÃO para o mapa do React Leaflet
    wsManager.broadcast("LOCATION_UPDATE", payload);

    // 2. Broadcast de STATUS ONLINE para Navbar e Sidebar do React
    wsManager.broadcast("DEVICE_STATUS", {
      deviceType: "tracker",
      deviceRef: trackerRef,
      isOnline: true,
      bateria: batPercent,
      lastSeen: new Date(timestamp).toISOString(),
    });

    // 3. Alerta de bateria crítica se necessário
    if (batPercent < 15) {
      wsManager.broadcast("ALERT", {
        type: "LOW_BATTERY",
        severity: "warning",
        title: "Bateria Fraca",
        message: `O tracker ${trackerRef} (${petNome}) está com bateria crítica: ${batPercent}%`,
        deviceRef: trackerRef,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Retorna todas as localizações em tempo real dos pets (500 pets)
   */
  public getLatestLocations(): LocationBroadcastPayload[] {
    return Array.from(this.cacheLatestLocations.values());
  }

  /**
   * Quantidade de trackers atualmente online no sistema
   */
  public getOnlineCount(): number {
    return Math.max(this.lastSeenTimestamps.size, this.cacheLatestLocations.size, this.resources.length);
  }

  public getStatus() {
    return {
      interscity_url: this.baseUrl,
      resources_mapped: this.resources.length,
      online_trackers: this.getOnlineCount(),
      is_polling: this.isPolling,
    };
  }

  public getResources(): InterSCityResourceMeta[] {
    return this.resources;
  }
}

export const interscityService = new InterSCityService();
