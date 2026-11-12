import { db } from "./index.js";
import { pets, sticks, trackers, petTrackers, rastreios, deviceEvents } from "./schema.js";
import { eq, sql } from "drizzle-orm";

const PET_AVATARS = [
  "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&q=80&w=200",
];

const RACAS = [
  "Vira-lata Caramelo",
  "Golden Retriever",
  "Siamês",
  "Labrador",
  "Pastor Alemão",
  "Beagle",
  "Bulldog Francês",
  "Poodle",
];

export async function seedDatabase() {
  console.log("[Seeder] Verificando dados iniciais no banco...");

  // 1. Cadastra Sticks se não existirem
  const existingSticks = await db.select().from(sticks);
  if (existingSticks.length === 0) {
    console.log("[Seeder] Cadastrando gateways Sticks...");
    await db.insert(sticks).values([
      {
        stickRef: "STICK_CCET_UFMA",
        status: true,
        bateria: "98.50",
        isOnline: true,
        lastSeen: new Date(),
        wifiSsid: "UFMA_EDUROAM",
      },
      {
        stickRef: "STICK_BIBLIOTECA",
        status: true,
        bateria: "89.20",
        isOnline: true,
        lastSeen: new Date(),
        wifiSsid: "UFMA_WIFI_CAMPUS",
      },
      {
        stickRef: "STICK_PORTARIA_REITORIA",
        status: true,
        bateria: "95.00",
        isOnline: false,
        lastSeen: new Date(Date.now() - 3600000),
        wifiSsid: "UFMA_ADMIN",
      },
    ]);
  }

  // 2. Cadastra os 3 pets de demonstração clássicos caso a tabela esteja limpa
  const [petsCountRes] = await db.select({ count: sql<number>`count(*)` }).from(pets);
  const totalPets = Number(petsCountRes?.count || 0);

  if (totalPets === 0) {
    console.log("[Seeder] Inserindo pets base de demonstração...");
    const [p1] = await db.insert(pets).values({
      nome: "Rex (Caramelo da UFMA)",
      raca: "Vira-lata Caramelo",
      dataNascimento: "2021-04-10",
      status: true,
      pathFoto: PET_AVATARS[0],
    }).$returningId();

    const [p2] = await db.insert(pets).values({
      nome: "Luna",
      raca: "Golden Retriever",
      dataNascimento: "2022-08-15",
      status: true,
      pathFoto: PET_AVATARS[1],
    }).$returningId();

    const [p3] = await db.insert(pets).values({
      nome: "Mimi",
      raca: "Siamês",
      dataNascimento: "2023-01-20",
      status: true,
      pathFoto: PET_AVATARS[2],
    }).$returningId();

    // Trackers base
    const [t1] = await db.insert(trackers).values({
      trackerRef: "TRK_DOG_01",
      status: true,
      bateria: "82.40",
      isOnline: true,
      lastSeen: new Date(),
    }).$returningId();

    const [t2] = await db.insert(trackers).values({
      trackerRef: "TRK_DOG_02",
      status: true,
      bateria: "74.10",
      isOnline: true,
      lastSeen: new Date(),
    }).$returningId();

    const [t3] = await db.insert(trackers).values({
      trackerRef: "TRK_CAT_03",
      status: true,
      bateria: "91.80",
      isOnline: true,
      lastSeen: new Date(),
    }).$returningId();

    await db.insert(petTrackers).values([
      { petId: p1.id, trackerId: t1.id, dataInicio: new Date() },
      { petId: p2.id, trackerId: t2.id, dataInicio: new Date() },
      { petId: p3.id, trackerId: t3.id, dataInicio: new Date() },
    ]);
  }

  // 3. Cadastra os 500 pets virtuais para o teste de carga IoT
  await seedVirtualPets(500);

  console.log("[Seeder] Sincronização de dados finalizada com sucesso!");
}

/**
 * Garante que 500 pets virtuais (TRK_VIRTUAL_001 a 500) existam no banco relacional
 */
export async function seedVirtualPets(targetCount = 500) {
  const existingTrackers = await db.select().from(trackers);
  const existingTrackerRefs = new Set(existingTrackers.map((t) => t.trackerRef));

  const neededTrackers: Array<{
    index: number;
    ref: string;
    petName: string;
    lat: number;
    lon: number;
  }> = [];

  for (let i = 1; i <= targetCount; i++) {
    const ref = `TRK_VIRTUAL_${String(i).padStart(3, "0")}`;
    if (!existingTrackerRefs.has(ref)) {
      const latOffset = ((i % 25) - 12) * 0.00035;
      const lonOffset = ((Math.floor(i / 25)) - 10) * 0.00030;
      neededTrackers.push({
        index: i,
        ref,
        petName: `Pet Virtual #${String(i).padStart(3, "0")}`,
        lat: -2.557812 + latOffset,
        lon: -44.311345 + lonOffset,
      });
    }
  }

  if (neededTrackers.length === 0) {
    console.log(`[Seeder] Todos os ${targetCount} pets virtuais já estão cadastrados no banco.`);
    return;
  }

  console.log(`[Seeder] Populando ${neededTrackers.length} pets virtuais para o teste de carga...`);

  // Inserção em lotes de 100 para alta velocidade
  const CHUNK_SIZE = 100;
  for (let i = 0; i < neededTrackers.length; i += CHUNK_SIZE) {
    const chunk = neededTrackers.slice(i, i + CHUNK_SIZE);

    for (const item of chunk) {
      const [newPet] = await db
        .insert(pets)
        .values({
          nome: item.petName,
          raca: RACAS[item.index % RACAS.length],
          status: true,
          pathFoto: PET_AVATARS[item.index % PET_AVATARS.length],
          dataNascimento: "2024-01-01",
        })
        .$returningId();

      const [newTracker] = await db
        .insert(trackers)
        .values({
          trackerRef: item.ref,
          status: true,
          bateria: String(80 + (item.index % 20)),
          isOnline: true,
          lastSeen: new Date(),
        })
        .$returningId();

      await db.insert(petTrackers).values({
        petId: newPet.id,
        trackerId: newTracker.id,
        dataInicio: new Date(),
      });
    }
  }

  console.log(`[Seeder] Inseridos com sucesso ${neededTrackers.length} pets e trackers virtuais!`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seeder] Erro no seed:", err);
      process.exit(1);
    });
}
