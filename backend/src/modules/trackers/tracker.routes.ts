import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  listTrackers,
  listAvailableTrackers,
  createTracker,
  updateTracker,
  deleteTracker,
} from "./tracker.controller.js";

const createTrackerSchema = z.object({
  trackerRef: z.string().min(1, "Referência do tracker é obrigatória"),
});

const updateTrackerSchema = z.object({
  trackerRef: z.string().min(1).optional(),
  status: z.boolean().optional(),
});

export const trackerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/trackers", async (_request, reply) => {
    const data = await listTrackers();
    return reply.send({ success: true, data });
  });

  fastify.get("/trackers/available", async (_request, reply) => {
    const data = await listAvailableTrackers();
    return reply.send({ success: true, data });
  });

  fastify.post("/trackers", async (request, reply) => {
    const parse = createTrackerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    try {
      const created = await createTracker(parse.data);
      return reply.status(201).send({ success: true, data: created });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  fastify.put("/trackers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = updateTrackerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    const updated = await updateTracker(Number(id), parse.data);
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Tracker não encontrado" });
    }
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/trackers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await deleteTracker(Number(id));
    if (!success) {
      return reply.status(404).send({ success: false, message: "Tracker não encontrado" });
    }
    return reply.send({ success: true, message: "Tracker removido com sucesso" });
  });
};
