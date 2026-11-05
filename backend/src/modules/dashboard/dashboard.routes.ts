import type { FastifyPluginAsync } from "fastify";
import { getDashboardStats } from "./dashboard.controller.js";

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/dashboard/stats", async (_request, reply) => {
    const stats = await getDashboardStats();
    return reply.send({ success: true, data: stats });
  });
};
