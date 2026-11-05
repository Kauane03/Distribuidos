import { db } from "../../infrastructure/database/index.js";
import { sticks } from "../../infrastructure/database/schema.js";
import { eq, desc } from "drizzle-orm";
import { mqttService } from "../../infrastructure/mqtt/index.js";

export async function listSticks() {
  const all = await db.select().from(sticks).orderBy(desc(sticks.createdAt));
  return all.map((s) => ({
    ...s,
    bateria: s.bateria ? Number(s.bateria) : null,
  }));
}

export async function createStick(data: { stickRef: string; wifiSsid?: string }) {
  const existing = await db.query.sticks.findFirst({
    where: eq(sticks.stickRef, data.stickRef),
  });
  if (existing) {
    throw new Error(`Stick com referência '${data.stickRef}' já cadastrado.`);
  }

  const [newStk] = await db
    .insert(sticks)
    .values({
      stickRef: data.stickRef.trim().toUpperCase(),
      wifiSsid: data.wifiSsid || null,
      status: true,
      isOnline: false,
    })
    .$returningId();

  return db.query.sticks.findFirst({ where: eq(sticks.id, newStk.id) });
}

export async function updateStick(
  id: number,
  data: { stickRef?: string; status?: boolean; wifiSsid?: string }
) {
  const stk = await db.query.sticks.findFirst({ where: eq(sticks.id, id) });
  if (!stk) return null;

  await db
    .update(sticks)
    .set({
      stickRef: data.stickRef ? data.stickRef.trim().toUpperCase() : stk.stickRef,
      status: data.status !== undefined ? data.status : stk.status,
      wifiSsid: data.wifiSsid !== undefined ? data.wifiSsid : stk.wifiSsid,
      updatedAt: new Date(),
    })
    .where(eq(sticks.id, id));

  return db.query.sticks.findFirst({ where: eq(sticks.id, id) });
}

export async function deleteStick(id: number) {
  const stk = await db.query.sticks.findFirst({ where: eq(sticks.id, id) });
  if (!stk) return false;

  await db.delete(sticks).where(eq(sticks.id, id));
  return true;
}

export async function configureStickWifi(
  id: number,
  config: { ssid: string; password?: string }
) {
  const stk = await db.query.sticks.findFirst({ where: eq(sticks.id, id) });
  if (!stk) throw new Error("Stick não encontrado");

  // Atualiza banco
  await db
    .update(sticks)
    .set({ wifiSsid: config.ssid, updatedAt: new Date() })
    .where(eq(sticks.id, id));

  // Publica no broker MQTT
  const mqttPayload = {
    wf1: config.ssid,
    ps1: config.password || "",
    timestamp: new Date().toISOString(),
  };

  await mqttService.publishConfig(stk.stickRef, mqttPayload);

  return {
    success: true,
    stickRef: stk.stickRef,
    publishedTopic: `pawsition/sticks/${stk.stickRef}/config`,
    config: mqttPayload,
  };
}
