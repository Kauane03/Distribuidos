import type { FastifyPluginAsync } from "fastify";
import { listEvents } from "./event.controller.js";

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/events", async (request, reply) => {
    const { limit, deviceRef } = request.query as {
      limit?: string;
      deviceRef?: string;
    };

    const data = await listEvents(
      limit ? Number(limit) : 100,
      deviceRef || undefined
    );

    return reply.send({ success: true, data });
  });
};
