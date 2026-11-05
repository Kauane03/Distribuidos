import { db } from "./index.js";
import { pets, sticks, trackers, petTrackers, rastreios, deviceEvents } from "./schema.js";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  console.log("[Seeder] Verificando dados iniciais...");

  const existingPets = await db.select().from(pets);
  if (existingPets.length > 0) {
    console.log("[Seeder] Banco já contém dados. Pulando seed.");
    return;
  }

  console.log("[Seeder] Populando banco com dados de exemplo (UFMA - São Luís)...");

  // 1. Cadastra Sticks (Portais / Gateways)
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

  // 2. Cadastra Trackers (Coleiras)
  await db.insert(trackers).values([
    {
      trackerRef: "TRK_DOG_01",
      status: true,
      bateria: "82.40",
      isOnline: true,
      lastSeen: new Date(),
    },
    {
      trackerRef: "TRK_DOG_02",
      status: true,
      bateria: "74.10",
      isOnline: true,
      lastSeen: new Date(),
    },
    {
      trackerRef: "TRK_CAT_03",
      status: true,
      bateria: "91.80",
      isOnline: true,
      lastSeen: new Date(),
    },
    {
      trackerRef: "TRK_SPARE_04",
      status: true,
      bateria: "100.00",
      isOnline: false,
      lastSeen: null,
    },
  ]);

  // 3. Cadastra Pets
  const [pet1] = await db.insert(pets).values({
    nome: "Rex (Caramelo da UFMA)",
    raca: "Vira-lata Caramelo",
    dataNascimento: "2021-04-10",
    status: true,
    pathFoto: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400",
  }).$returningId();

  const [pet2] = await db.insert(pets).values({
    nome: "Luna",
    raca: "Golden Retriever",
    dataNascimento: "2022-08-15",
    status: true,
    pathFoto: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=400",
  }).$returningId();

  const [pet3] = await db.insert(pets).values({
    nome: "Mimi",
    raca: "Siamês",
    dataNascimento: "2023-01-20",
    status: true,
    pathFoto: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=400",
  }).$returningId();

  // 4. Associações Pets <-> Trackers
  const allTrackers = await db.select().from(trackers);
  const trk1 = allTrackers.find((t) => t.trackerRef === "TRK_DOG_01")!;
  const trk2 = allTrackers.find((t) => t.trackerRef === "TRK_DOG_02")!;
  const trk3 = allTrackers.find((t) => t.trackerRef === "TRK_CAT_03")!;
  const allSticks = await db.select().from(sticks);
  const stkWifi = allSticks.find((s) => s.stickRef === "STICK_CCET_UFMA")!;

  await db.insert(petTrackers).values([
    {
      petId: pet1.id,
      trackerId: trk1.id,
      dataInicio: new Date(),
    },
    {
      petId: pet2.id,
      trackerId: trk2.id,
      dataInicio: new Date(),
    },
    {
      petId: pet3.id,
      trackerId: trk3.id,
      dataInicio: new Date(),
    },
  ]);

  // 5. Pontos iniciais de rastreio (Campus do Bacanga - UFMA, São Luís: ~ -2.5578, -44.3113)
  const baseLat = -2.557812;
  const baseLng = -44.311345;

  await db.insert(rastreios).values([
    {
      petId: pet1.id,
      trackerId: trk1.id,
      stickId: stkWifi.id,
      lat: String(baseLat),
      long: String(baseLng),
      rssi: "75.00",
      bateriaStick: "98.50",
      bateriaTracker: "82.40",
      capturedAt: new Date(Date.now() - 300000),
    },
    {
      petId: pet1.id,
      trackerId: trk1.id,
      stickId: stkWifi.id,
      lat: String(baseLat + 0.00035),
      long: String(baseLng + 0.00020),
      rssi: "72.50",
      bateriaStick: "98.50",
      bateriaTracker: "82.00",
      capturedAt: new Date(Date.now() - 150000),
    },
    {
      petId: pet1.id,
      trackerId: trk1.id,
      stickId: stkWifi.id,
      lat: String(baseLat + 0.00070),
      long: String(baseLng + 0.00045),
      rssi: "68.00",
      bateriaStick: "98.50",
      bateriaTracker: "81.90",
      capturedAt: new Date(),
    },
    {
      petId: pet2.id,
      trackerId: trk2.id,
      stickId: stkWifi.id,
      lat: String(baseLat - 0.00040),
      long: String(baseLng + 0.00030),
      rssi: "84.00",
      bateriaStick: "98.50",
      bateriaTracker: "74.10",
      capturedAt: new Date(),
    },
    {
      petId: pet3.id,
      trackerId: trk3.id,
      stickId: stkWifi.id,
      lat: String(baseLat + 0.00020),
      long: String(baseLng - 0.00050),
      rssi: "62.00",
      bateriaStick: "98.50",
      bateriaTracker: "91.80",
      capturedAt: new Date(),
    },
  ]);

  await db.insert(deviceEvents).values([
    {
      deviceType: "tracker",
      deviceRef: "TRK_DOG_01",
      eventType: "telemetry",
      topic: "pawsition/trackers/TRK_DOG_01/telemetry",
      payload: JSON.stringify({
        t_id: "TRK_DOG_01",
        s_id: "STICK_CCET_UFMA",
        lat: baseLat + 0.00070,
        lon: baseLng + 0.00045,
        bat: 2570,
        sbat: 2730,
        lr_rssi: 68.0,
      }),
      createdAt: new Date(),
    },
  ]);

  console.log("[Seeder] Seed finalizado com sucesso!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seeder] Erro no seed:", err);
      process.exit(1);
    });
}
