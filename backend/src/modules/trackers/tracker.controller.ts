import { db } from "../../infrastructure/database/index.js";
import { trackers, petTrackers } from "../../infrastructure/database/schema.js";
import { eq, desc, and, isNull } from "drizzle-orm";
import { interscityService } from "../../infrastructure/interscity/index.js";

export async function listTrackers() {
  const all = await db.select().from(trackers).orderBy(desc(trackers.createdAt));

  const enriched = await Promise.all(
    all.map(async (trk) => {
      const activeLink = await db.query.petTrackers.findFirst({
        where: and(eq(petTrackers.trackerId, trk.id), isNull(petTrackers.dataFim)),
        with: { pet: true },
      });

      return {
        ...trk,
        bateria: trk.bateria ? Number(trk.bateria) : null,
        activePet: activeLink?.pet || null,
        activeLinkId: activeLink?.id || null,
      };
    })
  );

  // Se o banco ainda não sincronizou todos os 500, complementa a lista para o painel
  const existingRefs = new Set(enriched.map((t) => t.trackerRef));
  const resources = interscityService.getResources();

  for (let i = 0; i < resources.length; i++) {
    const res = resources[i];
    if (!existingRefs.has(res.tracker_ref)) {
      enriched.push({
        id: 1000 + i,
        trackerRef: res.tracker_ref,
        status: true,
        bateria: 85,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        activePet: {
          id: 1000 + i,
          nome: res.pet_name,
          raca: "Pet Virtual",
          dataNascimento: "2024-01-01",
          status: true,
          pathFoto: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeLinkId: 1000 + i,
      });
      existingRefs.add(res.tracker_ref);
    }
  }

  return enriched;
}

export async function listAvailableTrackers() {
  const all = await db.select().from(trackers).where(eq(trackers.status, true));

  const available: typeof all = [];
  for (const trk of all) {
    const hasActiveLink = await db.query.petTrackers.findFirst({
      where: and(eq(petTrackers.trackerId, trk.id), isNull(petTrackers.dataFim)),
    });
    if (!hasActiveLink) {
      available.push(trk);
    }
  }

  return available.map((trk) => ({
    ...trk,
    bateria: trk.bateria ? Number(trk.bateria) : null,
  }));
}

export async function createTracker(data: { trackerRef: string }) {
  const existing = await db.query.trackers.findFirst({
    where: eq(trackers.trackerRef, data.trackerRef),
  });
  if (existing) {
    throw new Error(`Tracker com referência '${data.trackerRef}' já cadastrado.`);
  }

  const [newTrk] = await db
    .insert(trackers)
    .values({
      trackerRef: data.trackerRef.trim().toUpperCase(),
      status: true,
      isOnline: false,
    })
    .$returningId();

  return db.query.trackers.findFirst({ where: eq(trackers.id, newTrk.id) });
}

export async function updateTracker(
  id: number,
  data: { trackerRef?: string; status?: boolean }
) {
  const trk = await db.query.trackers.findFirst({ where: eq(trackers.id, id) });
  if (!trk) return null;

  await db
    .update(trackers)
    .set({
      trackerRef: data.trackerRef ? data.trackerRef.trim().toUpperCase() : trk.trackerRef,
      status: data.status !== undefined ? data.status : trk.status,
      updatedAt: new Date(),
    })
    .where(eq(trackers.id, id));

  return db.query.trackers.findFirst({ where: eq(trackers.id, id) });
}

export async function deleteTracker(id: number) {
  const trk = await db.query.trackers.findFirst({ where: eq(trackers.id, id) });
  if (!trk) return false;

  await db.delete(trackers).where(eq(trackers.id, id));
  return true;
}
