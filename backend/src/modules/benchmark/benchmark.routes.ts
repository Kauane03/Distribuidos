import type { FastifyPluginAsync } from "fastify";
import { benchmarkService } from "./benchmark.service.js";

export const benchmarkRoutes: FastifyPluginAsync = async (fastify) => {
  // Inicia o teste de estresse massivo
  fastify.post("/cluster/benchmark/start", async (request, reply) => {
    const body = (request.body as any) || {};
    const total = Number(body.total) || 1_000_000;
    const concurrency = Number(body.concurrency) || 100;
    const targetUrl = body.targetUrl || "http://loadbalancer:3000/api/cluster/probe";

    try {
      const state = await benchmarkService.start(total, concurrency, targetUrl);
      return { success: true, message: "Benchmark iniciado", data: state };
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Retorna o status atual do benchmark em tempo real
  fastify.get("/cluster/benchmark/status", async () => {
    const state = await benchmarkService.getState();
    return {
      success: true,
      data: state,
    };
  });

  // Interrompe o benchmark
  fastify.post("/cluster/benchmark/stop", async () => {
    await benchmarkService.stop();
    const state = await benchmarkService.getState();
    return { success: true, message: "Benchmark interrompido", data: state };
  });
};

