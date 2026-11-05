import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../infrastructure/database/index.js";
import { petTrackers, trackers, pets } from "../../infrastructure/database/schema.js";
import { eq, and, isNull } from "drizzle-orm";

const linkSchema = z.object({
  petId: z.number().int().positive("petId é obrigatório"),
  trackerId: z.number().int().positive("trackerId é obrigatório"),
});

export const associationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/associations", async (request, reply) => {
    const parse = linkSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }

    const { petId, trackerId } = parse.data;

    const pet = await db.query.pets.findFirst({ where: eq(pets.id, petId) });
    if (!pet) return reply.status(404).send({ success: false, message: "Pet não encontrado" });

    const tracker = await db.query.trackers.findFirst({ where: eq(trackers.id, trackerId) });
    if (!tracker) return reply.status(404).send({ success: false, message: "Tracker não encontrado" });

    // Verifica se tracker já está em uso por outro pet
    const trackerEmUso = await db.query.petTrackers.findFirst({
      where: and(eq(petTrackers.trackerId, trackerId), isNull(petTrackers.dataFim)),
    });
    if (trackerEmUso) {
      return reply.status(400).send({
        success: false,
        message: "Este tracker já está associado a outro pet ativo",
      });
    }

    // Encerra qualquer vínculo ativo anterior deste pet
    await db
      .update(petTrackers)
      .set({ dataFim: new Date() })
      .where(and(eq(petTrackers.petId, petId), isNull(petTrackers.dataFim)));

    // Cria novo vínculo
    const [novoVinculo] = await db
      .insert(petTrackers)
      .values({
        petId,
        trackerId,
        dataInicio: new Date(),
      })
      .$returningId();

    return reply.status(201).send({
      success: true,
      message: `Tracker ${tracker.trackerRef} associado com sucesso ao pet ${pet.nome}`,
      data: { id: novoVinculo.id, petId, trackerId },
    });
  });

  fastify.delete("/associations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const linkId = Number(id);

    const link = await db.query.petTrackers.findFirst({
      where: eq(petTrackers.id, linkId),
    });

    if (!link) {
      return reply.status(404).send({ success: false, message: "Vínculo não encontrado" });
    }

    await db
      .update(petTrackers)
      .set({ dataFim: new Date() })
      .where(eq(petTrackers.id, linkId));

    return reply.send({
      success: true,
      message: "Vínculo desfeito com sucesso. Tracker liberado.",
    });
  });
};
