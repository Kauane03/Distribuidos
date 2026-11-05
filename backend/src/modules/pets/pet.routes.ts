import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  listPets,
  getPetById,
  createPet,
  updatePet,
  deletePet,
  getPetRastreios,
} from "./pet.controller.js";

const createPetSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  raca: z.string().optional(),
  dataNascimento: z.string().optional(),
  pathFoto: z.string().optional(),
  trackerId: z.number().int().positive().optional(),
});

const updatePetSchema = z.object({
  nome: z.string().min(1).optional(),
  raca: z.string().optional(),
  dataNascimento: z.string().optional(),
  pathFoto: z.string().optional(),
  status: z.boolean().optional(),
  trackerId: z.number().int().positive().nullable().optional(),
});

export const petRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/pets", async (_request, reply) => {
    const data = await listPets();
    return reply.send({ success: true, data });
  });

  fastify.get("/pets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const pet = await getPetById(Number(id));
    if (!pet) {
      return reply.status(404).send({ success: false, message: "Pet não encontrado" });
    }
    return reply.send({ success: true, data: pet });
  });

  fastify.post("/pets", async (request, reply) => {
    const parse = createPetSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    const newPet = await createPet(parse.data);
    return reply.status(201).send({ success: true, data: newPet });
  });

  fastify.put("/pets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = updatePetSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    const updated = await updatePet(Number(id), parse.data);
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Pet não encontrado" });
    }
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/pets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await deletePet(Number(id));
    if (!success) {
      return reply.status(404).send({ success: false, message: "Pet não encontrado" });
    }
    return reply.send({ success: true, message: "Pet removido com sucesso" });
  });

  fastify.get("/pets/:id/rastreios", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };
    const rastreios = await getPetRastreios(Number(id), limit ? Number(limit) : 50);
    return reply.send({ success: true, data: rastreios });
  });
};
