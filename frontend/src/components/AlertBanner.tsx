import React from "react";
import { AlertTriangle, Info, XCircle, X } from "lucide-react";
import type { AlertNotification } from "../types";

interface AlertBannerProps {
  alerts: AlertNotification[];
  onDismiss: (id: string) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
      {alerts.map((alert) => {
        const isWarning = alert.severity === "warning";
        const isDanger = alert.severity === "danger";

        return (
          <div
            key={alert.id}
            className={`p-4 rounded-xl shadow-2xl border flex items-start justify-between gap-3 backdrop-blur-md transition-all duration-200 animate-slide-in ${
              isDanger
                ? "bg-rose-950/80 border-rose-800 text-rose-200"
                : isWarning
                ? "bg-amber-950/80 border-amber-800 text-amber-200"
                : "bg-slate-800/90 border-slate-700 text-slate-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {isDanger ? (
                <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              ) : isWarning ? (
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-sm leading-tight">{alert.title}</p>
                <p className="text-xs mt-1 text-slate-300 leading-relaxed">{alert.message}</p>
                <span className="text-[10px] opacity-70 font-mono mt-1 block">
                  {new Date(alert.timestamp).toLocaleTimeString("pt-BR")}
                </span>
              </div>
            </div>

            <button
              onClick={() => onDismiss(alert.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
