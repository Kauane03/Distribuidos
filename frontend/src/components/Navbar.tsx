import React from "react";
import { Activity, Wifi, Radio, Cpu } from "lucide-react";
import type { DashboardStats } from "../types";

interface NavbarProps {
  stats: DashboardStats | null;
  wsConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ stats, wsConnected }) => {
  const mqttConnected = stats?.system?.mqtt?.connected ?? false;

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-slate-100 text-lg leading-tight tracking-wide">
              PetTracker <span className="text-purple-400 font-mono text-xs px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60">UFMA</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Sistemas Distribuídos &bull; Simulação IoT com MQTT & WebSocket
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Status MQTT */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
          <Radio className={`h-4 w-4 ${mqttConnected ? "text-emerald-400 animate-pulse" : "text-rose-400"}`} />
          <span className="text-slate-400">MQTT:</span>
          <span className={mqttConnected ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
            {mqttConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Status WebSocket */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
          <Wifi className={`h-4 w-4 ${wsConnected ? "text-cyan-400 animate-pulse" : "text-rose-400"}`} />
          <span className="text-slate-400">WebSocket:</span>
          <span className={wsConnected ? "text-cyan-400 font-semibold" : "text-rose-400 font-semibold"}>
            {wsConnected ? "SYNC ATIVO" : "DESCONECTADO"}
          </span>
        </div>

        {/* Clientes Conectados */}
        {stats && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/40 border border-slate-800 text-xs text-slate-400 font-mono">
            <Cpu className="h-4 w-4 text-purple-400" />
            <span>Nós: {stats.trackers.online + stats.sticks.online} ativos</span>
          </div>
        )}
      </div>
    </header>
  );
};
