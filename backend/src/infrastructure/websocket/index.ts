import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

export interface WebSocketMessage {
  event: string;
  data: any;
  timestamp: string;
}

class WebSocketManager {
  private clients: Set<WebSocket> = new Set();

  public register(ws: WebSocket) {
    this.clients.add(ws);
    console.log(`[WebSocket] Novo cliente conectado. Total: ${this.clients.size}`);

    // Mensagem de boas-vindas com confirmação
    this.send(ws, "CONNECTED", {
      message: "Conectado ao barramento em tempo real do Pet Tracker",
      timestamp: new Date().toISOString(),
    });

    ws.on("close", () => {
      this.clients.delete(ws);
      console.log(`[WebSocket] Cliente desconectado. Total: ${this.clients.size}`);
    });

    ws.on("error", (err) => {
      console.error("[WebSocket] Erro na conexão:", err);
      this.clients.delete(ws);
    });

    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === "PING") {
          this.send(ws, "PONG", { timestamp: new Date().toISOString() });
        }
      } catch {
        // Ignora mensagens que não sejam JSON
      }
    });
  }

  public broadcast(event: string, data: any) {
    const payload: WebSocketMessage = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);

    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(serialized);
        } catch (err) {
          console.error("[WebSocket] Erro ao enviar mensagem:", err);
        }
      }
    }
  }

  public send(ws: WebSocket, event: string, data: any) {
    if (ws.readyState === 1) {
      const payload: WebSocketMessage = {
        event,
        data,
        timestamp: new Date().toISOString(),
      };
      ws.send(JSON.stringify(payload));
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
