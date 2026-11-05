import { db } from "../../infrastructure/database/index.js";
import {
  pets,
  trackers,
  sticks,
  rastreios,
  deviceEvents,
} from "../../infrastructure/database/schema.js";
import { sql, eq } from "drizzle-orm";
import { mqttService } from "../../infrastructure/mqtt/index.js";
import { wsManager } from "../../infrastructure/websocket/index.js";

export async function getDashboardStats() {
  const [totalPetsRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pets);

  const [activePetsRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pets)
    .where(eq(pets.status, true));

  const [totalTrackersRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trackers);

  const [onlineTrackersRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trackers)
    .where(eq(trackers.isOnline, true));

  const [totalSticksRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sticks);

  const [onlineSticksRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sticks)
    .where(eq(sticks.isOnline, true));

  const [totalLocationsRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rastreios);

  const [totalEventsRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deviceEvents);

  return {
    pets: {
      total: Number(totalPetsRes.count),
      active: Number(activePetsRes.count),
    },
    trackers: {
      total: Number(totalTrackersRes.count),
      online: Number(onlineTrackersRes.count),
    },
    sticks: {
      total: Number(totalSticksRes.count),
      online: Number(onlineSticksRes.count),
    },
    telemetry: {
      totalLocations: Number(totalLocationsRes.count),
      totalEvents: Number(totalEventsRes.count),
    },
    system: {
      mqtt: mqttService.getStatus(),
      wsClients: wsManager.getConnectedClientsCount(),
      serverTime: new Date().toISOString(),
    },
  };
}
