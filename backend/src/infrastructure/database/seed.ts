import { db } from "./index.js";
import { pets, sticks, trackers, petTrackers, rastreios, deviceEvents } from "./schema.js";
import { eq, sql, desc } from "drizzle-orm";

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

// 30 Bairros Reais de São Luís - MA
export const SAO_LUIS_NEIGHBORHOODS = [
  { name: "Centro Histórico", lat: -2.5290, lon: -44.3028 },
  { name: "Ponta d'Areia", lat: -2.4850, lon: -44.3120 },
  { name: "São Francisco", lat: -2.5020, lon: -44.2980 },
  { name: "Renascença", lat: -2.4990, lon: -44.2950 },
  { name: "Lagoa da Jansen", lat: -2.4960, lon: -44.3050 },
  { name: "Calhau / Litorânea", lat: -2.4880, lon: -44.2650 },
  { name: "Olho d'Água", lat: -2.4830, lon: -44.2380 },
  { name: "Araçagy", lat: -2.4650, lon: -44.1950 },
  { name: "Turu", lat: -2.5020, lon: -44.2250 },
  { name: "Cohama", lat: -2.5210, lon: -44.2480 },
  { name: "Vinhais", lat: -2.5180, lon: -44.2620 },
  { name: "Bequimão", lat: -2.5280, lon: -44.2550 },
  { name: "Maranhão Novo", lat: -2.5350, lon: -44.2600 },
  { name: "Monte Castelo", lat: -2.5400, lon: -44.2850 },
  { name: "João Paulo", lat: -2.5450, lon: -44.2700 },
  { name: "Alemanha", lat: -2.5480, lon: -44.2780 },
  { name: "Cohab Anil", lat: -2.5410, lon: -44.2180 },
  { name: "Cohatrac", lat: -2.5350, lon: -44.2000 },
  { name: "Parque Piauí", lat: -2.5700, lon: -44.2550 },
  { name: "Cidade Operária", lat: -2.5680, lon: -44.1900 },
  { name: "Anjo da Guarda", lat: -2.5650, lon: -44.3200 },
  { name: "Vila Embratel", lat: -2.5600, lon: -44.3180 },
  { name: "UFMA Bacanga", lat: -2.5578, lon: -44.3113 },
  { name: "Sá Viana", lat: -2.5520, lon: -44.3080 },
  { name: "Madre Deus", lat: -2.5380, lon: -44.3000 },
  { name: "Coroadinho", lat: -2.5500, lon: -44.2800 },
  { name: "São Cristóvão", lat: -2.5600, lon: -44.2280 },
  { name: "Tirirical / Aeroporto", lat: -2.5850, lon: -44.2350 },
  { name: "Maracanã", lat: -2.6050, lon: -44.2900 },
  { name: "Tibiri", lat: -2.6200, lon: -44.2500 },
];

export function getSaoLuisCoordinates(index: number) {
  const bairro = SAO_LUIS_NEIGHBORHOODS[index % SAO_LUIS_NEIGHBORHOODS.length];
  const seedOffsetLat = (((index * 7) % 31) - 15) * 0.0006;
  const seedOffsetLon = (((index * 13) % 31) - 15) * 0.0006;
  return {
    lat: Number((bairro.lat + seedOffsetLat).toFixed(6)),
    lon: Number((bairro.lon + seedOffsetLon).toFixed(6)),
    bairro: bairro.name,
  };
}

export async function seedDatabase() {
  console.log("[Seeder] Verificando dados iniciais no banco...");

  // 1. Cadastra Sticks se não existirem
  const existingSticks = await db.select().from(sticks);
  if (existingSticks.length === 0) {
    console.log("[Seeder] Cadastrando gateways Sticks em São Luís...");
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
        stickRef: "STICK_CENTRO_HISTORICO",
        status: true,
        bateria: "92.40",
        isOnline: true,
        lastSeen: new Date(),
        wifiSsid: "SLZ_DIGITAL_CENTRO",
      },
      {
        stickRef: "STICK_LITORANEA",
        status: true,
        bateria: "95.10",
        isOnline: true,
        lastSeen: new Date(),
        wifiSsid: "SLZ_PRAIA_NET",
      },
      {
        stickRef: "STICK_RENASCENCA",
        status: true,
        bateria: "91.80",
        isOnline: true,
        lastSeen: new Date(),
        wifiSsid: "SHOPPING_ISLAND_WIFI",
      },
      {
        stickRef: "STICK_COHAMA",
        status: true,
        bateria: "88.60",
        isOnline: true,
        lastSeen: new Date(),
        wifiSsid: "COHAMA_MESH_NET",
      },
    ]);
  }

  // 2. Cadastra os 1.500 pets virtuais para o teste de carga IoT
  const targetCount = Number(process.env.TOTAL_TRACKERS || 1500);
  await seedVirtualPets(targetCount);

  console.log("[Seeder] Sincronização de dados finalizada com sucesso!");
}

/**
 * Garante que 1.500 pets virtuais existam no banco relacional,
 * distribuídos geograficamente pelos bairros de São Luís (MA).
 */
export async function seedVirtualPets(targetCount = 1500) {
  const existingTrackers = await db.select().from(trackers);
  const existingTrackerRefs = new Set(existingTrackers.map((t) => t.trackerRef));

  const neededTrackers: Array<{
    index: number;
    ref: string;
    petName: string;
    bairro: string;
    lat: number;
    lon: number;
  }> = [];

  for (let i = 1; i <= targetCount; i++) {
    const ref = `TRK_VIRTUAL_${String(i).padStart(3, "0")}`;
    if (!existingTrackerRefs.has(ref)) {
      const coords = getSaoLuisCoordinates(i);
      neededTrackers.push({
        index: i,
        ref,
        petName: `Pet #${String(i).padStart(3, "0")} (${coords.bairro})`,
        bairro: coords.bairro,
        lat: coords.lat,
        lon: coords.lon,
      });
    }
  }

  if (neededTrackers.length > 0) {
    console.log(`[Seeder] Populando ${neededTrackers.length} novos pets virtuais espalhados por São Luís...`);

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

        // Insere localização inicial no bairro do pet para visualização imediata no mapa
        await db.insert(rastreios).values({
          petId: newPet.id,
          trackerId: newTracker.id,
          stickId: (item.index % 5) + 1,
          lat: String(item.lat),
          long: String(item.lon),
          rssi: String(75 + (item.index % 20)),
          bateriaTracker: String(80 + (item.index % 20)),
          bateriaStick: "98.50",
          capturedAt: new Date(),
        });
      }
    }
    console.log(`[Seeder] Inseridos com sucesso ${neededTrackers.length} pets espalhados por São Luís!`);
  }

  // Garante que TODOS os pets existentes no banco tenham registro de rastreio em São Luís
  const allPets = await db.select().from(pets);
  for (const pet of allPets) {
    const hasRastreio = await db.query.rastreios.findFirst({
      where: eq(rastreios.petId, pet.id),
    });

    if (!hasRastreio) {
      const link = await db.query.petTrackers.findFirst({
        where: eq(petTrackers.petId, pet.id),
      });
      const coords = getSaoLuisCoordinates(pet.id);
      await db.insert(rastreios).values({
        petId: pet.id,
        trackerId: link?.trackerId ?? 1,
        stickId: (pet.id % 5) + 1,
        lat: String(coords.lat),
        long: String(coords.lon),
        rssi: "82",
        bateriaTracker: "90",
        bateriaStick: "98",
        capturedAt: new Date(),
      });
    }
  }

  console.log(`[Seeder] Todos os ${targetCount} pets virtuais estão 100% ativos com coordenadas em São Luís.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seeder] Erro no seed:", err);
      process.exit(1);
    });
}
