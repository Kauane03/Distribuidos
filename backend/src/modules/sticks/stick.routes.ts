import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  listSticks,
  createStick,
  updateStick,
  deleteStick,
  configureStickWifi,
} from "./stick.controller.js";

const createStickSchema = z.object({
  stickRef: z.string().min(1, "Referência do stick é obrigatória"),
  wifiSsid: z.string().optional(),
});

const updateStickSchema = z.object({
  stickRef: z.string().min(1).optional(),
  status: z.boolean().optional(),
  wifiSsid: z.string().optional(),
});

const configWifiSchema = z.object({
  ssid: z.string().min(1, "SSID da rede Wi-Fi é obrigatório"),
  password: z.string().optional().default(""),
});

export const stickRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/sticks", async (_request, reply) => {
    const data = await listSticks();
    return reply.send({ success: true, data });
  });

  fastify.post("/sticks", async (request, reply) => {
    const parse = createStickSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    try {
      const created = await createStick(parse.data);
      return reply.status(201).send({ success: true, data: created });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  fastify.put("/sticks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = updateStickSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    const updated = await updateStick(Number(id), parse.data);
    if (!updated) {
      return reply.status(404).send({ success: false, message: "Stick não encontrado" });
    }
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/sticks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = await deleteStick(Number(id));
    if (!success) {
      return reply.status(404).send({ success: false, message: "Stick não encontrado" });
    }
    return reply.send({ success: true, message: "Stick removido com sucesso" });
  });

  fastify.post("/sticks/:id/config", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = configWifiSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.format() });
    }
    try {
      const res = await configureStickWifi(Number(id), parse.data);
      return reply.send({ success: true, message: "Configuração publicada via MQTT", data: res });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });
};
