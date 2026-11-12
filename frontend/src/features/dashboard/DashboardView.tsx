import React, { useState } from "react";
import {
  Dog,
  Radio,
  Router,
  Navigation,
  BatteryMedium,
  ExternalLink,
  RefreshCw,
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
  const [displayCount, setDisplayCount] = useState<number>(10);
  const displayedLocations = displayCount === 0 ? locations : locations.slice(0, displayCount);

  return (
    <div className="space-y-5">
      {/* Header com botão de refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Painel de Monitoramento</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
          Atualizar Dados
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pets */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Pets Ativos</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Dog className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white">
              {stats?.pets.active ?? 0}
            </span>
            <span className="text-xs text-slate-400">de {stats?.pets.total ?? 0}</span>
          </div>
        </div>

        {/* Trackers */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Trackers Online</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-400">
              {stats?.trackers.online ?? 0}
            </span>
            <span className="text-xs text-slate-400">de {stats?.trackers.total ?? 0}</span>
          </div>
        </div>

        {/* Sticks */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Gateways</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Router className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-indigo-400">
              {stats?.sticks.online ?? 0}
            </span>
            <span className="text-xs text-slate-400">de {stats?.sticks.total ?? 0}</span>
          </div>
        </div>

        {/* Telemetria */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Coordenadas</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Navigation className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-cyan-400">
              {stats?.telemetry.totalLocations ?? 0}
            </span>
            <span className="text-xs text-slate-400">pontos</span>
          </div>
        </div>
      </div>

      {/* Grid Principal: Pets ao vivo & Feed de Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cartão de Pets Ativos com Posição */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-white">Pets Monitorados</h3>
              <div className="flex items-center gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded-lg border border-slate-700 text-xs">
                <span className="text-slate-400 text-[11px] mr-1">Mostrar:</span>
                {[5, 10, 25, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDisplayCount(n)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
                      displayCount === n
                        ? "bg-purple-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setDisplayCount(0)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
                    displayCount === 0
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Todos
                </button>
              </div>
            </div>

            <button
              onClick={onNavigateToMap}
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium transition"
            >
              <span>Ver no Mapa</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-700/50 max-h-[460px] overflow-y-auto pr-1">
            {locations.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum pet com telemetria ativa no momento.
              </div>
            ) : (
              displayedLocations.map((loc) => {
                const signalColor =
                  loc.qualidadeSinal === "Excelente"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : loc.qualidadeSinal === "Bom"
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    : "text-rose-400 bg-rose-500/10 border-rose-500/20";

                return (
                  <div key={loc.petId || loc.trackerRef} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full overflow-hidden bg-slate-700 shrink-0 border border-slate-600">
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
                          <h4 className="font-semibold text-xs text-slate-100">{loc.petNome || "Pet"}</h4>
                          <span className="font-mono text-[10px] text-purple-300 px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40">
                            {loc.trackerRef}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {loc.raca || "Vira-lata"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {/* Bateria */}
                      <div className="flex items-center gap-1 font-mono text-slate-300 text-xs">
                        <BatteryMedium
                          className={`h-3.5 w-3.5 ${
                            (loc.bateriaTracker ?? 100) < 20 ? "text-rose-400 animate-pulse" : "text-emerald-400"
                          }`}
                        />
                        <span>{loc.bateriaTracker ? `${loc.bateriaTracker}%` : "--"}</span>
                      </div>

                      {/* Sinal RSSI */}
                      <div className={`px-1.5 py-0.5 rounded border font-mono text-[10px] ${signalColor}`}>
                        {loc.qualidadeSinal || "Sinal"}
                      </div>

                      {/* Coordenadas */}
                      <div className="hidden sm:block text-right font-mono text-[10px] text-slate-400">
                        <div>
                          {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                        </div>
                      </div>

                      {/* Botão para Rota ao Vivo */}
                      {onNavigateToPetRoute && loc.petId && (
                        <button
                          onClick={() => onNavigateToPetRoute(loc.petId!)}
                          title="Acessar trajeto deste pet em tempo real"
                          className="px-2 py-1 rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/50 transition flex items-center gap-1 text-[11px] font-medium shrink-0"
                        >
                          <Footprints className="h-3 w-3 text-purple-400" />
                          <span className="hidden md:inline">Rota</span>
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
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 flex flex-col h-[480px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">Eventos em Tempo Real</h3>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {recentEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Aguardando transmissões...
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
                  {evt.payload?.lat && (
                    <div className="text-emerald-400 text-[10px]">
                      {Number(evt.payload.lat).toFixed(4)}, {Number(evt.payload.lon || evt.payload.long).toFixed(4)} | Bateria: {evt.payload.bat || evt.payload.bateria}%
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
