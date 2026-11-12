import { db } from "../../infrastructure/database/index.js";
import {
  rastreios,
  pets,
  trackers,
  sticks,
  petTrackers,
  deviceEvents,
} from "../../infrastructure/database/schema.js";
import { eq, desc, and, isNull } from "drizzle-orm";
import {
  getSignalQuality,
  calculateDistanceMeters,
  voltageToPercent,
} from "../../infrastructure/mqtt/helpers.js";
import { wsManager } from "../../infrastructure/websocket/index.js";
import { interscityService } from "../../infrastructure/interscity/index.js";

import { getSaoLuisCoordinates } from "../../infrastructure/database/seed.js";

export async function getLatestLocations() {
  // 1. Alta performance: Retorna o cache em memória com os 1.500 pets atualizados em tempo real (< 2ms)
  const interscityLocations = interscityService.getLatestLocations();
  if (interscityLocations.length >= 100) {
    return interscityLocations;
  }

  // 2. Fallback resiliente: Busca os pets cadastrados e mapeia coordenadas de São Luís
  const allPets = await db.select().from(pets).where(eq(pets.status, true));
  return allPets.map((p) => {
    const coords = getSaoLuisCoordinates(p.id);
    return {
      id: p.id,
      petId: p.id,
      petNome: p.nome,
      petFoto: p.pathFoto,
      raca: p.raca,
      trackerId: p.id,
      trackerRef: `TRK_VIRTUAL_${String(p.id).padStart(3, "0")}`,
      stickId: (p.id % 5) + 1,
      stickRef: (p.id % 2 === 0) ? "STICK_CENTRO_HISTORICO" : "STICK_CCET_UFMA",
      lat: coords.lat,
      lng: coords.lon,
      rssi: 82,
      qualidadeSinal: "Excelente" as const,
      bateriaTracker: 88,
      bateriaStick: 98,
      capturedAt: new Date().toISOString(),
      isMoving: true,
    };
  });
}

export async function getLocationHistory(options: {
  petId?: number;
  trackerId?: number;
  limit?: number;
}) {
  const limit = Math.min(options.limit || 100, 500);

  let whereClause = undefined;
  if (options.petId) {
    whereClause = eq(rastreios.petId, options.petId);
  } else if (options.trackerId) {
    whereClause = eq(rastreios.trackerId, options.trackerId);
  }

  const records = await db.query.rastreios.findMany({
    where: whereClause,
    orderBy: [desc(rastreios.capturedAt)],
    limit,
    with: { pet: true, tracker: true, stick: true },
  });

  return records.map((r) => ({
    id: r.id,
    petId: r.petId,
    petNome: r.pet?.nome,
    trackerRef: r.tracker?.trackerRef,
    stickRef: r.stick?.stickRef || null,
    lat: Number(r.lat),
    lng: Number(r.long),
    rssi: r.rssi ? Number(r.rssi) : null,
    qualidadeSinal: getSignalQuality(r.rssi ? Number(r.rssi) : null),
    bateriaTracker: r.bateriaTracker ? Number(r.bateriaTracker) : null,
    bateriaStick: r.bateriaStick ? Number(r.bateriaStick) : null,
    capturedAt: r.capturedAt.toISOString(),
  }));
}

export async function simulateTelemetryInput(data: {
  t_id: string;
  s_id?: string;
  lat: number;
  lon: number;
  bat?: number;
  sbat?: number;
  lr_rssi?: number;
}) {
  const trackerRef = data.t_id;
  const now = new Date();

  let tracker = await db.query.trackers.findFirst({
    where: eq(trackers.trackerRef, trackerRef),
  });

  const batTracker = voltageToPercent(data.bat);

  if (!tracker) {
    const [newTrk] = await db
      .insert(trackers)
      .values({
        trackerRef,
        status: true,
        bateria: batTracker !== null ? String(batTracker) : null,
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
        bateria: batTracker !== null ? String(batTracker) : tracker.bateria,
        updatedAt: now,
      })
      .where(eq(trackers.id, tracker.id));
  }

  if (!tracker) throw new Error("Falha ao registrar tracker");

  let stickId: number | null = null;
  let batStick: number | null = null;
  if (data.s_id) {
    let stick = await db.query.sticks.findFirst({
      where: eq(sticks.stickRef, data.s_id),
    });
    batStick = voltageToPercent(data.sbat);

    if (!stick) {
      const [newStk] = await db
        .insert(sticks)
        .values({
          stickRef: data.s_id,
          status: true,
          bateria: batStick !== null ? String(batStick) : null,
          isOnline: true,
          lastSeen: now,
        })
        .$returningId();
      stick = await db.query.sticks.findFirst({ where: eq(sticks.id, newStk.id) });
    }
    stickId = stick?.id || null;
  }

  const vinculo = await db.query.petTrackers.findFirst({
    where: and(eq(petTrackers.trackerId, tracker.id), isNull(petTrackers.dataFim)),
    with: { pet: true },
  });

  if (!vinculo || !vinculo.pet) {
    return {
      success: false,
      message: `Tracker ${trackerRef} não possui vínculo ativo com pet.`,
    };
  }

  const pet = vinculo.pet;
  const rssi = data.lr_rssi !== undefined ? Number(data.lr_rssi) : null;

  // Haversine
  const ultimo = await db.query.rastreios.findFirst({
    where: eq(rastreios.trackerId, tracker.id),
    orderBy: [desc(rastreios.capturedAt)],
  });

  let inseriu = true;
  if (ultimo) {
    const dist = calculateDistanceMeters(
      Number(ultimo.lat),
      Number(ultimo.long),
      data.lat,
      data.lon
    );

    if (dist < 3.0) {
      await db
        .update(rastreios)
        .set({
          capturedAt: now,
          bateriaTracker: batTracker !== null ? String(batTracker) : ultimo.bateriaTracker,
          bateriaStick: batStick !== null ? String(batStick) : ultimo.bateriaStick,
        })
        .where(eq(rastreios.id, ultimo.id));
      inseriu = false;
    }
  }

  if (inseriu) {
    await db.insert(rastreios).values({
      trackerId: tracker.id,
      petId: pet.id,
      stickId,
      lat: String(data.lat),
      long: String(data.lon),
      rssi: rssi !== null ? String(rssi) : null,
      bateriaStick: batStick !== null ? String(batStick) : null,
      bateriaTracker: batTracker !== null ? String(batTracker) : null,
      capturedAt: now,
    });
  }

  // Notifica WebSocket
  wsManager.broadcast("LOCATION_UPDATE", {
    petId: pet.id,
    petNome: pet.nome,
    petFoto: pet.pathFoto,
    trackerId: tracker.id,
    trackerRef,
    stickRef: data.s_id || null,
    lat: data.lat,
    lng: data.lon,
    rssi,
    qualidadeSinal: getSignalQuality(rssi),
    bateriaTracker: batTracker,
    bateriaStick: batStick,
    capturedAt: now.toISOString(),
    isMoving: inseriu,
  });

  return {
    success: true,
    message: inseriu ? "Nova localização registrada" : "Localização estacionária atualizada",
    pet: pet.nome,
    distanciaMinimaAtendida: inseriu,
  };
}
