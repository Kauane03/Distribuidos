import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { Sidebar, type NavTab } from "./components/Sidebar";
import { AlertBanner } from "./components/AlertBanner";
import { DashboardView } from "./features/dashboard/DashboardView";
import { LiveMapView } from "./features/map/LiveMapView";
import { LivePetRouteView } from "./features/map/LivePetRouteView";
import { ClusterMonitorView } from "./features/servers/ClusterMonitorView";
import { PetsView } from "./features/pets/PetsView";
import { TrackersView } from "./features/trackers/TrackersView";
import { SticksView } from "./features/sticks/SticksView";
import { HistoryView } from "./features/history/HistoryView";
import { EventsView } from "./features/events/EventsView";

import { api } from "./services/api";
import { useWebSocket } from "./services/websocket";
import type {
  Pet,
  Tracker,
  Stick,
  LocationPoint,
  DeviceEvent,
  DashboardStats,
} from "./types";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");
  const [focusedPetId, setFocusedPetId] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  // Estados principais
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [availableTrackers, setAvailableTrackers] = useState<Tracker[]>([]);
  const [sticks, setSticks] = useState<Stick[]>([]);
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [historyTrails, setHistoryTrails] = useState<Record<number, [number, number][]>>({});

  // WebSocket hook
  const {
    connected: wsConnected,
    lastLocation,
    lastDeviceStatus,
    lastEvent,
    alerts,
    dismissAlert,
  } = useWebSocket();

  // Carrega dados iniciais da API
  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statsData, petsData, trackersData, availTrackers, sticksData, locationsData, eventsData] =
        await Promise.all([
          api.getDashboardStats().catch(() => null),
          api.getPets().catch(() => []),
          api.getTrackers().catch(() => []),
          api.getAvailableTrackers().catch(() => []),
          api.getSticks().catch(() => []),
          api.getLatestLocations().catch(() => []),
          api.getEvents(60).catch(() => []),
        ]);

      if (statsData) setStats(statsData);
      setPets(petsData);
      setTrackers(trackersData);
      setAvailableTrackers(availTrackers);
      setSticks(sticksData);
      setLocations(locationsData);
      setEvents(eventsData);

      // Constrói trilhas iniciais a partir das localizações
      const initialTrails: Record<number, [number, number][]> = {};
      locationsData.forEach((loc) => {
        if (loc.petId) {
          initialTrails[loc.petId] = [[loc.lat, loc.lng]];
        }
      });
      setHistoryTrails(initialTrails);
    } catch (err) {
      console.error("Erro ao carregar dados iniciais:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Trata novas coordenadas recebidas via WebSocket
  useEffect(() => {
    if (!lastLocation) return;

    // 1. Atualiza lista de últimas localizações
    setLocations((prev) => {
      const filtered = prev.filter((l) => l.petId !== lastLocation.petId);
      return [lastLocation, ...filtered];
    });

    // 2. Atualiza trilha no mapa para este pet
    if (lastLocation.petId) {
      const pid = lastLocation.petId;
      setHistoryTrails((prev) => {
        const existing = prev[pid] || [];
        const newCoords: [number, number] = [lastLocation.lat, lastLocation.lng];
        return {
          ...prev,
          [pid]: [newCoords, ...existing.slice(0, 40)], // Mantém últimos 40 pontos na trilha
        };
      });
    }

    // 3. Atualiza contador no dashboard de telemetria
    setStats((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        telemetry: {
          ...prev.telemetry,
          totalLocations: prev.telemetry.totalLocations + 1,
        },
      };
    });
  }, [lastLocation]);

  // Trata alteração de status de dispositivo via WebSocket (online/offline/bateria)
  useEffect(() => {
    if (!lastDeviceStatus) return;

    if (lastDeviceStatus.deviceType === "tracker") {
      setTrackers((prev) =>
        prev.map((t) =>
          t.trackerRef === lastDeviceStatus.deviceRef
            ? {
                ...t,
                isOnline: lastDeviceStatus.isOnline,
                bateria: lastDeviceStatus.bateria ?? t.bateria,
                lastSeen: lastDeviceStatus.lastSeen,
              }
            : t
        )
      );
    } else if (lastDeviceStatus.deviceType === "stick") {
      setSticks((prev) =>
        prev.map((s) =>
          s.stickRef === lastDeviceStatus.deviceRef
            ? {
                ...s,
                isOnline: lastDeviceStatus.isOnline,
                bateria: lastDeviceStatus.bateria ?? s.bateria,
                wifiSsid: lastDeviceStatus.wifiSsid || s.wifiSsid,
                lastSeen: lastDeviceStatus.lastSeen,
              }
            : s
        )
      );
    }
  }, [lastDeviceStatus]);

  // Trata novos eventos brutos no barramento MQTT
  useEffect(() => {
    if (!lastEvent) return;
    setEvents((prev) => [lastEvent, ...prev.slice(0, 99)]);
    setStats((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        telemetry: {
          ...prev.telemetry,
          totalEvents: prev.telemetry.totalEvents + 1,
        },
      };
    });
  }, [lastEvent]);

  // CRUD Handlers
  const handleCreatePet = async (data: any) => {
    await api.createPet(data);
    await loadAllData();
  };

  const handleUpdatePet = async (id: number, data: any) => {
    await api.updatePet(id, data);
    await loadAllData();
  };

  const handleDeletePet = async (id: number) => {
    if (!window.confirm("Deseja realmente remover este pet?")) return;
    await api.deletePet(id);
    await loadAllData();
  };

  const handleUnlinkTracker = async (linkId: number) => {
    await api.unlinkPetTracker(linkId);
    await loadAllData();
  };

  const handleCreateTracker = async (data: { trackerRef: string }) => {
    await api.createTracker(data);
    await loadAllData();
  };

  const handleDeleteTracker = async (id: number) => {
    if (!window.confirm("Deseja realmente remover este tracker?")) return;
    await api.deleteTracker(id);
    await loadAllData();
  };

  const handleCreateStick = async (data: { stickRef: string; wifiSsid?: string }) => {
    await api.createStick(data);
    await loadAllData();
  };

  const handleDeleteStick = async (id: number) => {
    if (!window.confirm("Deseja realmente remover este stick gateway?")) return;
    await api.deleteStick(id);
    await loadAllData();
  };

  const handleConfigureWifi = async (id: number, config: { ssid: string; password?: string }) => {
    await api.configureStickWifi(id, config);
    await loadAllData();
  };

  const onlineTrackersCount = trackers.filter((t) => t.isOnline).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Navbar */}
      <Navbar stats={stats} wsConnected={wsConnected} />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onlineTrackersCount={onlineTrackersCount}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-900/60">
          <div className="max-w-7xl mx-auto">
            {currentTab === "dashboard" && (
              <DashboardView
                stats={stats}
                locations={locations}
                recentEvents={events}
                onNavigateToMap={() => setCurrentTab("map")}
                onNavigateToPetRoute={(petId) => {
                  setFocusedPetId(petId);
                  setCurrentTab("pet-route");
                }}
                onRefresh={loadAllData}
                isLoading={isLoading}
              />
            )}

            {currentTab === "map" && (
              <LiveMapView locations={locations} historyTrails={historyTrails} />
            )}

            {currentTab === "servers" && <ClusterMonitorView />}

            {currentTab === "pet-route" && (
              <LivePetRouteView
                pets={pets}
                locations={locations}
                selectedPetId={focusedPetId}
                onSelectPet={setFocusedPetId}
              />
            )}

            {currentTab === "pets" && (
              <PetsView
                pets={pets}
                availableTrackers={availableTrackers}
                onCreatePet={handleCreatePet}
                onUpdatePet={handleUpdatePet}
                onDeletePet={handleDeletePet}
                onUnlinkTracker={handleUnlinkTracker}
                onNavigateToPetRoute={(petId) => {
                  setFocusedPetId(petId);
                  setCurrentTab("pet-route");
                }}
              />
            )}

            {currentTab === "trackers" && (
              <TrackersView
                trackers={trackers}
                onCreateTracker={handleCreateTracker}
                onDeleteTracker={handleDeleteTracker}
              />
            )}

            {currentTab === "sticks" && (
              <SticksView
                sticks={sticks}
                onCreateStick={handleCreateStick}
                onDeleteStick={handleDeleteStick}
                onConfigureWifi={handleConfigureWifi}
              />
            )}

            {currentTab === "history" && <HistoryView pets={pets} />}

            {currentTab === "events" && (
              <EventsView events={events} onRefresh={loadAllData} isLoading={isLoading} />
            )}
          </div>
        </main>
      </div>

      {/* Floating Alerts */}
      <AlertBanner alerts={alerts} onDismiss={dismissAlert} />
    </div>
  );
};
