import { db } from "../../infrastructure/database/index.js";
import { trackers, petTrackers } from "../../infrastructure/database/schema.js";
import { eq, desc, and, isNull } from "drizzle-orm";

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
