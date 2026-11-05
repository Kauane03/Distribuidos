import { db } from "../../infrastructure/database/index.js";
import { pets, petTrackers, trackers, rastreios } from "../../infrastructure/database/schema.js";
import { eq, desc, and, isNull } from "drizzle-orm";
import { getSignalQuality } from "../../infrastructure/mqtt/helpers.js";

export async function listPets() {
  const allPets = await db.select().from(pets).orderBy(desc(pets.createdAt));

  // Para cada pet, busca tracker ativo e última localização
  const petsWithDetails = await Promise.all(
    allPets.map(async (pet) => {
      const activeLink = await db.query.petTrackers.findFirst({
        where: and(eq(petTrackers.petId, pet.id), isNull(petTrackers.dataFim)),
        with: { tracker: true },
      });

      let lastLocation = null;
      if (activeLink?.tracker) {
        const lastRastreio = await db.query.rastreios.findFirst({
          where: eq(rastreios.petId, pet.id),
          orderBy: [desc(rastreios.capturedAt)],
          with: { stick: true },
        });

        if (lastRastreio) {
          lastLocation = {
            lat: Number(lastRastreio.lat),
            lng: Number(lastRastreio.long),
            rssi: lastRastreio.rssi ? Number(lastRastreio.rssi) : null,
            qualidadeSinal: getSignalQuality(lastRastreio.rssi ? Number(lastRastreio.rssi) : null),
            bateriaTracker: lastRastreio.bateriaTracker ? Number(lastRastreio.bateriaTracker) : null,
            bateriaStick: lastRastreio.bateriaStick ? Number(lastRastreio.bateriaStick) : null,
            capturedAt: lastRastreio.capturedAt.toISOString(),
            stickRef: lastRastreio.stick?.stickRef || null,
          };
        }
      }

      return {
        ...pet,
        activeTracker: activeLink?.tracker || null,
        activeLinkId: activeLink?.id || null,
        lastLocation,
      };
    })
  );

  return petsWithDetails;
}

export async function getPetById(id: number) {
  const pet = await db.query.pets.findFirst({
    where: eq(pets.id, id),
  });

  if (!pet) return null;

  const activeLink = await db.query.petTrackers.findFirst({
    where: and(eq(petTrackers.petId, pet.id), isNull(petTrackers.dataFim)),
    with: { tracker: true },
  });

  const recentLocations = await db.query.rastreios.findMany({
    where: eq(rastreios.petId, pet.id),
    orderBy: [desc(rastreios.capturedAt)],
    limit: 20,
    with: { stick: true, tracker: true },
  });

  return {
    ...pet,
    activeTracker: activeLink?.tracker || null,
    activeLinkId: activeLink?.id || null,
    recentLocations: recentLocations.map((r) => ({
      id: r.id,
      lat: Number(r.lat),
      lng: Number(r.long),
      rssi: r.rssi ? Number(r.rssi) : null,
      qualidadeSinal: getSignalQuality(r.rssi ? Number(r.rssi) : null),
      bateriaTracker: r.bateriaTracker ? Number(r.bateriaTracker) : null,
      bateriaStick: r.bateriaStick ? Number(r.bateriaStick) : null,
      capturedAt: r.capturedAt.toISOString(),
      stickRef: r.stick?.stickRef || null,
      trackerRef: r.tracker?.trackerRef || null,
    })),
  };
}

export async function createPet(data: {
  nome: string;
  raca?: string;
  dataNascimento?: string;
  pathFoto?: string;
  trackerId?: number;
}) {
  const [newPet] = await db
    .insert(pets)
    .values({
      nome: data.nome,
      raca: data.raca || null,
      dataNascimento: data.dataNascimento ? (data.dataNascimento as any) : null,
      pathFoto: data.pathFoto || null,
      status: true,
    })
    .$returningId();

  if (data.trackerId) {
    // Vincula tracker
    await db.insert(petTrackers).values({
      petId: newPet.id,
      trackerId: data.trackerId,
      dataInicio: new Date(),
    });
  }

  return getPetById(newPet.id);
}

export async function updatePet(
  id: number,
  data: {
    nome?: string;
    raca?: string;
    dataNascimento?: string;
    pathFoto?: string;
    status?: boolean;
    trackerId?: number | null;
  }
) {
  const pet = await db.query.pets.findFirst({ where: eq(pets.id, id) });
  if (!pet) return null;

  await db
    .update(pets)
    .set({
      nome: data.nome ?? pet.nome,
      raca: data.raca !== undefined ? data.raca : pet.raca,
      dataNascimento: data.dataNascimento ? (data.dataNascimento as any) : pet.dataNascimento,
      pathFoto: data.pathFoto !== undefined ? data.pathFoto : pet.pathFoto,
      status: data.status !== undefined ? data.status : pet.status,
      updatedAt: new Date(),
    })
    .where(eq(pets.id, id));

  // Gerenciamento de vínculo com tracker
  if (data.trackerId !== undefined) {
    // Encerra vínculo atual se houver
    await db
      .update(petTrackers)
      .set({ dataFim: new Date() })
      .where(and(eq(petTrackers.petId, id), isNull(petTrackers.dataFim)));

    if (data.trackerId !== null) {
      // Inicia novo vínculo
      await db.insert(petTrackers).values({
        petId: id,
        trackerId: data.trackerId,
        dataInicio: new Date(),
      });
    }
  }

  return getPetById(id);
}

export async function deletePet(id: number) {
  const pet = await db.query.pets.findFirst({ where: eq(pets.id, id) });
  if (!pet) return false;

  await db.delete(pets).where(eq(pets.id, id));
  return true;
}

export async function getPetRastreios(id: number, limit = 50) {
  const records = await db.query.rastreios.findMany({
    where: eq(rastreios.petId, id),
    orderBy: [desc(rastreios.capturedAt)],
    limit,
    with: { stick: true, tracker: true },
  });

  return records.map((r) => ({
    id: r.id,
    lat: Number(r.lat),
    lng: Number(r.long),
    rssi: r.rssi ? Number(r.rssi) : null,
    qualidadeSinal: getSignalQuality(r.rssi ? Number(r.rssi) : null),
    bateriaTracker: r.bateriaTracker ? Number(r.bateriaTracker) : null,
    bateriaStick: r.bateriaStick ? Number(r.bateriaStick) : null,
    capturedAt: r.capturedAt.toISOString(),
    stickRef: r.stick?.stickRef || null,
    trackerRef: r.tracker?.trackerRef || null,
  }));
}
