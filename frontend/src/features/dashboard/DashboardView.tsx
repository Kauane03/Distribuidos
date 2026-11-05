import React from "react";
import {
  Dog,
  Radio,
  Router,
  Navigation,
  BatteryMedium,
  Wifi,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  Footprints,
} from "lucide-react";
import type { DashboardStats, LocationPoint, DeviceEvent } from "../../types";

interface DashboardViewProps {
  stats: DashboardStats | null;
  locations: LocationPoint[];
  recentEvents: DeviceEvent[];
  onNavigateToMap: () => void;
  onNavigateToPetRoute?: (petId: number) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  locations,
  recentEvents,
  onNavigateToMap,
  onNavigateToPetRoute,
  onRefresh,
  isLoading,
}) => {
  return (
    <div className="space-y-6">
      {/* Header com botão de refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Painel de Monitoramento</h2>
          <p className="text-sm text-slate-400">
            Visão consolidada do cluster distribuído de rastreamento de pets
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm border border-slate-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
          Atualizar Dados
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pets */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Pets Ativos</span>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Dog className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {stats?.pets.active ?? 0}
            </span>
            <span className="text-xs text-slate-400">de {stats?.pets.total ?? 0} cadastrados</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Coleiras sincronizadas</span>
          </div>
        </div>

        {/* Trackers */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Trackers (IoT)</span>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">
              {stats?.trackers.online ?? 0}
            </span>
            <span className="text-xs text-slate-400">online de {stats?.trackers.total ?? 0}</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Protocolo MQTT &bull; QoS 1</span>
          </div>
        </div>

        {/* Sticks */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Sticks Gateways</span>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Router className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-indigo-400">
              {stats?.sticks.online ?? 0}
            </span>
            <span className="text-xs text-slate-400">ativos de {stats?.sticks.total ?? 0}</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <Wifi className="h-3.5 w-3.5 text-indigo-400" />
            <span>Pontos de coleta Wi-Fi</span>
          </div>
        </div>

        {/* Telemetria */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Pontos Capturados</span>
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Navigation className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-cyan-400">
              {stats?.telemetry.totalLocations ?? 0}
            </span>
            <span className="text-xs text-slate-400">coordenadas</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>{stats?.telemetry.totalEvents ?? 0} eventos registrados</span>
          </div>
        </div>
      </div>

      {/* Grid Principal: Pets ao vivo & Feed de Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cartão de Pets Ativos com Posição */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/60 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Pets em Monitoramento Ativo</h3>
              <p className="text-xs text-slate-400">Atualizações recebidas em tempo real via WebSocket</p>
            </div>
            <button
              onClick={onNavigateToMap}
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium transition"
            >
              <span>Abrir Mapa Completo</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-700/50">
            {locations.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Nenhum pet com telemetria ativa no momento. Inicie o simulador Python!
              </div>
            ) : (
              locations.map((loc) => {
                const signalColor =
                  loc.qualidadeSinal === "Excelente"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : loc.qualidadeSinal === "Bom"
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    : "text-rose-400 bg-rose-500/10 border-rose-500/20";

                return (
                  <div key={loc.petId || loc.trackerRef} className="py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full overflow-hidden bg-slate-700 shrink-0 border border-slate-600">
                        <img
                          src={
                            loc.petFoto ||
                            "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=150"
                          }
                          alt={loc.petNome || "Pet"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-slate-100">{loc.petNome || "Pet"}</h4>
                          <span className="font-mono text-[10px] text-purple-300 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40">
                            {loc.trackerRef}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {loc.raca || "Raça não informada"} &bull; Gateway: {loc.stickRef || "Direto"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      {/* Bateria */}
                      <div className="flex items-center gap-1.5 font-mono text-slate-300">
                        <BatteryMedium
                          className={`h-4 w-4 ${
                            (loc.bateriaTracker ?? 100) < 20 ? "text-rose-400 animate-pulse" : "text-emerald-400"
                          }`}
                        />
                        <span>{loc.bateriaTracker ? `${loc.bateriaTracker}%` : "--"}</span>
                      </div>

                      {/* Sinal RSSI */}
                      <div className={`px-2 py-1 rounded border font-mono text-[11px] ${signalColor}`}>
                        {loc.qualidadeSinal || "Sinal"} {loc.rssi ? `(${loc.rssi})` : ""}
                      </div>

                      {/* Coordenadas */}
                      <div className="hidden sm:block text-right font-mono text-[11px] text-slate-400">
                        <div>
                          {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(loc.capturedAt).toLocaleTimeString("pt-BR")}
                        </div>
                      </div>

                      {/* Botão para Rota ao Vivo */}
                      {onNavigateToPetRoute && loc.petId && (
                        <button
                          onClick={() => onNavigateToPetRoute(loc.petId!)}
                          title="Acessar trajeto deste pet em tempo real"
                          className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/50 transition flex items-center gap-1.5 text-xs font-medium shrink-0"
                        >
                          <Footprints className="h-3.5 w-3.5 text-purple-400" />
                          <span className="hidden md:inline">Rota ao Vivo</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Event Stream / Terminal */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-white">Fluxo do Barramento MQTT</h3>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Últimas mensagens processadas pelo servidor</p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {recentEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Aguardando transmissões MQTT...
              </div>
            ) : (
              recentEvents.slice(0, 15).map((evt, idx) => (
                <div
                  key={evt.id || idx}
                  className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-purple-400 font-semibold">{evt.deviceRef}</span>
                    <span className="text-[10px]">{new Date(evt.createdAt).toLocaleTimeString("pt-BR")}</span>
                  </div>
                  <div className="text-slate-300 truncate" title={evt.topic}>
                    <span className="text-indigo-400">TOPIC:</span> {evt.topic}
                  </div>
                  {evt.payload?.lat && (
                    <div className="text-emerald-400 text-[10px]">
                      POS: {Number(evt.payload.lat).toFixed(4)}, {Number(evt.payload.lon || evt.payload.long).toFixed(4)} | BAT:{" "}
                      {evt.payload.bat || evt.payload.bateria}%
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
