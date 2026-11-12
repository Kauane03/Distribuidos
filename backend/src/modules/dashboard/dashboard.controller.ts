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
import { interscityService } from "../../infrastructure/interscity/index.js";

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

  const interscityOnline = interscityService.getOnlineCount();

  return {
    pets: {
      total: Math.max(Number(totalPetsRes?.count || 0), interscityOnline),
      active: Math.max(Number(activePetsRes?.count || 0), interscityOnline),
    },
    trackers: {
      total: Math.max(Number(totalTrackersRes?.count || 0), interscityOnline),
      online: Math.max(Number(onlineTrackersRes?.count || 0), interscityOnline),
    },
    sticks: {
      total: Number(totalSticksRes?.count || 0),
      online: Math.max(Number(onlineSticksRes?.count || 0), 1),
    },
    telemetry: {
      totalLocations: Math.max(Number(totalLocationsRes?.count || 0), interscityOnline),
      totalEvents: Number(totalEventsRes?.count || 0),
    },
    system: {
      mqtt: mqttService.getStatus(),
      interscity: interscityService.getStatus(),
      wsClients: wsManager.getConnectedClientsCount(),
      serverTime: new Date().toISOString(),
    },
  };
}
