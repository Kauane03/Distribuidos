import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getLatestLocations,
  getLocationHistory,
  simulateTelemetryInput,
} from "./location.controller.js";

const simulateSchema = z.object({
  t_id: z.string().min(1, "t_id é obrigatório"),
  s_id: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
  bat: z.number().optional(),
  sbat: z.number().optional(),
  lr_rssi: z.number().optional(),
});

export const locationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/locations/latest", async (_request, reply) => {
    const data = await getLatestLocations();
    return reply.send({ success: true, data });
  });

  fastify.get("/locations/history", async (request, reply) => {
    const { petId, trackerId, limit } = request.query as {
      petId?: string;
      trackerId?: string;
      limit?: string;
    };

    const data = await getLocationHistory({
      petId: petId ? Number(petId) : undefined,
      trackerId: trackerId ? Number(trackerId) : undefined,
      limit: limit ? Number(limit) : 100,
    });

    return reply.send({ success: true, data });
  });

  // Rota HTTP compatível com simulador/API legado ou testes diretos
  fastify.post("/locations/simulate", async (request, reply) => {
    const parse = simulateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    const res = await simulateTelemetryInput(parse.data);
    return reply.send(res);
  });

  fastify.post("/tracker/data", async (request, reply) => {
    const parse = simulateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    const res = await simulateTelemetryInput(parse.data);
    return reply.send(res);
  });
};
