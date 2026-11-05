import type {
  Pet,
  Tracker,
  Stick,
  LocationPoint,
  DeviceEvent,
  DashboardStats,
} from "../types";

const BASE_URL = "/api";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Erro na requisição HTTP: ${res.status}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Dashboard
  getDashboardStats: () => request<DashboardStats>("/dashboard/stats"),

  // Pets
  getPets: () => request<Pet[]>("/pets"),
  getPet: (id: number) => request<Pet>(`/pets/${id}`),
  createPet: (data: { nome: string; raca?: string; dataNascimento?: string; pathFoto?: string; trackerId?: number }) =>
    request<Pet>("/pets", { method: "POST", body: JSON.stringify(data) }),
  updatePet: (id: number, data: Partial<Pet> & { trackerId?: number | null }) =>
    request<Pet>(`/pets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePet: (id: number) => request<{ success: boolean }>(`/pets/${id}`, { method: "DELETE" }),
  getPetRastreios: (id: number, limit = 50) =>
    request<LocationPoint[]>(`/pets/${id}/rastreios?limit=${limit}`),

  // Trackers
  getTrackers: () => request<Tracker[]>("/trackers"),
  getAvailableTrackers: () => request<Tracker[]>("/trackers/available"),
  createTracker: (data: { trackerRef: string }) =>
    request<Tracker>("/trackers", { method: "POST", body: JSON.stringify(data) }),
  updateTracker: (id: number, data: { trackerRef?: string; status?: boolean }) =>
    request<Tracker>(`/trackers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTracker: (id: number) => request<{ success: boolean }>(`/trackers/${id}`, { method: "DELETE" }),

  // Sticks
  getSticks: () => request<Stick[]>("/sticks"),
  createStick: (data: { stickRef: string; wifiSsid?: string }) =>
    request<Stick>("/sticks", { method: "POST", body: JSON.stringify(data) }),
  updateStick: (id: number, data: { stickRef?: string; status?: boolean; wifiSsid?: string }) =>
    request<Stick>(`/sticks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStick: (id: number) => request<{ success: boolean }>(`/sticks/${id}`, { method: "DELETE" }),
  configureStickWifi: (id: number, config: { ssid: string; password?: string }) =>
    request<{ success: boolean; publishedTopic: string; config: any }>(`/sticks/${id}/config`, {
      method: "POST",
      body: JSON.stringify(config),
    }),

  // Associações
  linkPetTracker: (petId: number, trackerId: number) =>
    request<any>("/associations", { method: "POST", body: JSON.stringify({ petId, trackerId }) }),
  unlinkPetTracker: (linkId: number) =>
    request<any>(`/associations/${linkId}`, { method: "DELETE" }),

  // Localizações
  getLatestLocations: () => request<LocationPoint[]>("/locations/latest"),
  getLocationHistory: (params?: { petId?: number; trackerId?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.petId) query.append("petId", String(params.petId));
    if (params?.trackerId) query.append("trackerId", String(params.trackerId));
    if (params?.limit) query.append("limit", String(params.limit));
    return request<LocationPoint[]>(`/locations/history?${query.toString()}`);
  },

  // Eventos MQTT e Logs
  getEvents: (limit = 100, deviceRef?: string) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (deviceRef) query.append("deviceRef", deviceRef);
    return request<DeviceEvent[]>(`/events?${query.toString()}`);
  },

  // Simulação manual via HTTP
  simulateTelemetry: (data: {
    t_id: string;
    s_id?: string;
    lat: number;
    lon: number;
    bat?: number;
    sbat?: number;
    lr_rssi?: number;
  }) => request<any>("/locations/simulate", { method: "POST", body: JSON.stringify(data) }),
};
