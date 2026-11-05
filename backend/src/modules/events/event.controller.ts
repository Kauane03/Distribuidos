import { db } from "../../infrastructure/database/index.js";
import { deviceEvents } from "../../infrastructure/database/schema.js";
import { desc, eq } from "drizzle-orm";

export async function listEvents(limit = 100, deviceRef?: string) {
  const whereClause = deviceRef ? eq(deviceEvents.deviceRef, deviceRef) : undefined;

  const events = await db.query.deviceEvents.findMany({
    where: whereClause,
    orderBy: [desc(deviceEvents.createdAt)],
    limit: Math.min(limit, 300),
  });

  return events.map((e) => {
    let parsedPayload = null;
    try {
      parsedPayload = JSON.parse(e.payload);
    } catch {
      parsedPayload = e.payload;
    }

    return {
      id: e.id,
      deviceType: e.deviceType,
      deviceRef: e.deviceRef,
      eventType: e.eventType,
      topic: e.topic,
      payload: parsedPayload,
      createdAt: e.createdAt.toISOString(),
    };
  });
}
