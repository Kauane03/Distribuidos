import React from "react";
import {
  LayoutDashboard,
  MapPin,
  Footprints,
  Dog,
  Radio,
  Router,
  History,
  Terminal,
  Server,
} from "lucide-react";

export type NavTab =
  | "dashboard"
  | "map"
  | "pet-route"
  | "servers"
  | "pets"
  | "trackers"
  | "sticks"
  | "history"
  | "events";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onlineTrackersCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onlineTrackersCount }) => {
  const navItems = [
    { id: "dashboard" as NavTab, label: "Dashboard", icon: LayoutDashboard },
    {
      id: "map" as NavTab,
      label: "Mapa em Tempo Real",
      icon: MapPin,
      badge: onlineTrackersCount > 0 ? `${onlineTrackersCount} ao vivo` : undefined,
    },
    {
      id: "servers" as NavTab,
      label: "Servidores & Cluster",
      icon: Server,
      badge: "Cluster",
    },
    {
      id: "pet-route" as NavTab,
      label: "Rota do Pet ao Vivo",
      icon: Footprints,
      badge: "GPS",
    },
    { id: "pets" as NavTab, label: "Pets Cadastrados", icon: Dog },
    { id: "trackers" as NavTab, label: "Trackers (Coleiras)", icon: Radio },
    { id: "sticks" as NavTab, label: "Sticks (Gateways)", icon: Router },
    { id: "history" as NavTab, label: "Histórico de Rotas", icon: History },
    { id: "events" as NavTab, label: "Console MQTT", icon: Terminal },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Navegação
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? "text-purple-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300">Sistemas Distribuídos</p>
        <p className="text-[11px] leading-relaxed">
          Tópicos MQTT: <code className="text-purple-300 font-mono">pawsition/*</code>
        </p>
        <p className="text-[11px] leading-relaxed">
          Broker: <span className="text-slate-300">Mosquitto (1883)</span>
        </p>
      </div>
    </aside>
  );
};
