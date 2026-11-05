import { useEffect, useState, useCallback } from "react";
import type { LocationPoint, DeviceEvent, AlertNotification } from "../types";

type ListenerCallback = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<ListenerCallback>> = new Map();
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  public isConnected = false;

  public connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.emit("CONNECTION_CHANGE", { connected: true });

        // Inicia heartbeat ping
        this.pingInterval = window.setInterval(() => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: "PING" }));
          }
        }, 15000);
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event) {
            this.emit(message.event, message.data);
          }
        } catch {
          // Ignora mensagens inválidas
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.emit("CONNECTION_CHANGE", { connected: false });
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.socket?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, 3000);
  }

  public on(event: string, callback: ListenerCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Erro ao disparar callback do evento ${event}:`, err);
        }
      });
    }
  }
}

export const wsClient = new WebSocketClient();

export function useWebSocket() {
  const [connected, setConnected] = useState(wsClient.isConnected);
  const [lastLocation, setLastLocation] = useState<LocationPoint | null>(null);
  const [lastDeviceStatus, setLastDeviceStatus] = useState<any | null>(null);
  const [lastEvent, setLastEvent] = useState<DeviceEvent | null>(null);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    wsClient.connect();

    const unsubConn = wsClient.on("CONNECTION_CHANGE", (d) => setConnected(d.connected));
    const unsubLoc = wsClient.on("LOCATION_UPDATE", (data: LocationPoint) => {
      setLastLocation(data);
    });
    const unsubStatus = wsClient.on("DEVICE_STATUS", (data) => {
      setLastDeviceStatus(data);
    });
    const unsubEvent = wsClient.on("DEVICE_EVENT", (data) => {
      setLastEvent({
        id: Date.now(),
        deviceType: data.payload?.t_id ? "tracker" : "stick",
        deviceRef: data.deviceRef || data.payload?.t_id || data.payload?.s_id || "DEV",
        eventType: data.messageType || "telemetry",
        topic: data.topic,
        payload: data.payload,
        createdAt: data.receivedAt || new Date().toISOString(),
      });
    });
    const unsubAlert = wsClient.on("ALERT", (alertData: any) => {
      const newAlert: AlertNotification = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        type: alertData.type || "INFO",
        severity: alertData.severity || "warning",
        title: alertData.title || "Alerta do Sistema",
        message: alertData.message || "",
        timestamp: alertData.timestamp || new Date().toISOString(),
      };
      setAlerts((prev) => [newAlert, ...prev.slice(0, 4)]);
    });

    return () => {
      unsubConn();
      unsubLoc();
      unsubStatus();
      unsubEvent();
      unsubAlert();
    };
  }, []);

  return {
    connected,
    lastLocation,
    lastDeviceStatus,
    lastEvent,
    alerts,
    dismissAlert,
  };
}
