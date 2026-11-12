import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import * as dotenv from "dotenv";

import { testConnection } from "./infrastructure/database/index.js";
import { runMigrations } from "./infrastructure/database/migrate.js";
import { seedDatabase } from "./infrastructure/database/seed.js";
import { mqttService } from "./infrastructure/mqtt/index.js";
import { wsManager } from "./infrastructure/websocket/index.js";
import { interscityService } from "./infrastructure/interscity/index.js";

// Módulos
import { petRoutes } from "./modules/pets/pet.routes.js";
import { trackerRoutes } from "./modules/trackers/tracker.routes.js";
import { stickRoutes } from "./modules/sticks/stick.routes.js";
import { locationRoutes } from "./modules/locations/location.routes.js";
import { eventRoutes } from "./modules/events/event.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { associationRoutes } from "./modules/pets/association.routes.js";

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const fastify = Fastify({
  logger: true,
});

async function bootstrap() {
  try {
    // 1. CORS
    await fastify.register(cors, {
      origin: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    });

    // 2. WebSocket
    await fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
      },
    });

    // Rota WebSocket para clientes frontend
    fastify.register(async function (fastifyWs) {
      fastifyWs.get("/ws", { websocket: true }, (socket, req) => {
        wsManager.register(socket);
      });
    });

    // 3. Health check com status do cluster e middleware
    fastify.get("/health", async () => {
      const dbOk = await testConnection();
      return {
        status: "ok",
        database: dbOk ? "connected" : "error",
        mqtt: mqttService.getStatus(),
        interscity: interscityService.getStatus(),
        cluster: {
          node_pid: process.pid,
          hostname: process.env.HOSTNAME || "backend-node",
          uptime: process.uptime(),
        },
        timestamp: new Date().toISOString(),
      };
    });

    // Rotas de observabilidade do InterSCity
    fastify.get("/api/interscity/status", async () => interscityService.getStatus());
    fastify.get("/api/interscity/resources", async () => ({
      total: interscityService.getResources().length,
      resources: interscityService.getResources(),
    }));

    fastify.get("/", async () => {
      return {
        project: "Pet Tracker - Sistema Distribuído para Rastreamento de Pets",
        course: "Sistemas Distribuídos - UFMA",
        version: "2.0.0",
        architecture: {
          middleware: "InterSCity Platform (Smart Cities)",
          loadBalancer: "Nginx (Round Robin)",
          realtime: "WebSocket Push",
        },
        docs: {
          apiPrefix: "/api",
          websocket: "/ws",
          interscity: "/api/interscity/status",
        },
      };
    });

    // 4. Registro dos Módulos REST (prefixo /api)
    await fastify.register(petRoutes, { prefix: "/api" });
    await fastify.register(trackerRoutes, { prefix: "/api" });
    await fastify.register(stickRoutes, { prefix: "/api" });
    await fastify.register(locationRoutes, { prefix: "/api" });
    await fastify.register(eventRoutes, { prefix: "/api" });
    await fastify.register(dashboardRoutes, { prefix: "/api" });
    await fastify.register(associationRoutes, { prefix: "/api" });

    // 5. Inicialização do Banco de Dados (Migrate e Seed)
    console.log("[Bootstrap] Verificando banco de dados...");
    try {
      await runMigrations();
      await seedDatabase();
    } catch (err: any) {
      console.warn(
        `[Bootstrap] Não foi possível rodar migrations/seed automaticamente (${err.message}). O banco pode estar aguardando container subir.`
      );
    }

    // 6. Conexão MQTT leve para controle
    mqttService.connect();

    // 7. Inicialização da integração com o Middleware InterSCity
    await interscityService.initialize();
    interscityService.startPolling(2500);

    fastify.addHook("onClose", async () => {
      interscityService.stopPolling();
    });

    // 8. Inicialização do Servidor HTTP/WebSocket
    await fastify.listen({ port, host });
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor Fastify rodando em http://${host}:${port}`);
    console.log(`📡 WebSocket ativo em ws://${host}:${port}/ws`);
    console.log(`🌐 InterSCity Middleware conectado em ${process.env.INTERSCITY_URL || "http://interscity:8000"}`);
    console.log(`======================================================\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
