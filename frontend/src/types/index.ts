export interface Pet {
  id: number;
  nome: string;
  raca: string | null;
  dataNascimento: string | null;
  status: boolean;
  pathFoto: string | null;
  createdAt: string;
  updatedAt: string;
  activeTracker?: Tracker | null;
  activeLinkId?: number | null;
  lastLocation?: LocationPoint | null;
}

export interface Tracker {
  id: number;
  trackerRef: string;
  status: boolean;
  bateria: number | null;
  isOnline: boolean;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
  activePet?: Pet | null;
  activeLinkId?: number | null;
}

export interface Stick {
  id: number;
  stickRef: string;
  status: boolean;
  bateria: number | null;
  isOnline: boolean;
  lastSeen: string | null;
  wifiSsid: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocationPoint {
  id?: number;
  petId?: number;
  petNome?: string;
  petFoto?: string | null;
  raca?: string | null;
  trackerId?: number;
  trackerRef?: string;
  stickId?: number | null;
  stickRef?: string | null;
  lat: number;
  lng: number;
  rssi?: number | null;
  qualidadeSinal?: "Excelente" | "Bom" | "Fraco";
  bateriaTracker?: number | null;
  bateriaStick?: number | null;
  capturedAt: string;
  isMoving?: boolean;
}

export interface DeviceEvent {
  id: number;
  deviceType: "tracker" | "stick";
  deviceRef: string;
  eventType: string;
  topic: string;
  payload: any;
  createdAt: string;
}

export interface DashboardStats {
  pets: {
    total: number;
    active: number;
  };
  trackers: {
    total: number;
    online: number;
  };
  sticks: {
    total: number;
    online: number;
  };
  telemetry: {
    totalLocations: number;
    totalEvents: number;
  };
  system: {
    mqtt: {
      connected: boolean;
      broker: string;
    };
    wsClients: number;
    serverTime: string;
  };
}

export interface AlertNotification {
  id: string;
  type: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  timestamp: string;
}
