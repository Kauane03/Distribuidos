import React, { useState } from "react";
import {
  Terminal,
  Radio,
  Router,
  Search,
  RefreshCw,
  Code2,
  Copy,
  Check,
} from "lucide-react";
import type { DeviceEvent } from "../../types";

interface EventsViewProps {
  events: DeviceEvent[];
  onRefresh: () => void;
  isLoading: boolean;
}

export const EventsView: React.FC<EventsViewProps> = ({ events, onRefresh, isLoading }) => {
  const [filterDevice, setFilterDevice] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<DeviceEvent | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredEvents = events.filter((e) => {
    if (!filterDevice) return true;
    return (
      e.deviceRef.toLowerCase().includes(filterDevice.toLowerCase()) ||
      e.topic.toLowerCase().includes(filterDevice.toLowerCase()) ||
      e.eventType.toLowerCase().includes(filterDevice.toLowerCase())
    );
  });

  const handleCopyPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-purple-400" />
            Console Distribuído &bull; Mensageria MQTT
          </h2>
          <p className="text-xs text-slate-400">
            Inspeção em tempo real dos pacotes transmitidos pelo barramento de eventos (Publish/Subscribe)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filterDevice}
              onChange={(e) => setFilterDevice(e.target.value)}
              placeholder="Filtrar por tópico ou dispositivo..."
              className="pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-purple-500 w-64"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
            Recarregar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Eventos */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden flex flex-col h-[520px]">
          <div className="p-3 bg-slate-900/80 border-b border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
            <span>Fluxo de Mensagens ({filteredEvents.length})</span>
            <span className="font-mono text-[11px] text-purple-400">QoS: 1 &bull; JSON Encoded</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800 font-mono text-xs">
            {filteredEvents.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                Nenhum evento registrado correspondente ao filtro.
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const isSelected = selectedEvent?.id === evt.id;
                const isTracker = evt.deviceType === "tracker";

                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-purple-900/30 border-l-4 border-purple-500"
                        : "hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {isTracker ? (
                          <Radio className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Router className="h-3.5 w-3.5 text-indigo-400" />
                        )}
                        <span className="font-bold text-white text-[11px]">{evt.deviceRef}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-semibold ${
                            evt.eventType === "telemetry"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : evt.eventType === "status"
                              ? "bg-cyan-500/10 text-cyan-400"
                              : "bg-indigo-500/10 text-indigo-400"
                          }`}
                        >
                          {evt.eventType}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(evt.createdAt).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate mb-1">
                      <span className="text-purple-400">PUB &rarr;</span> {evt.topic}
                    </div>

                    <div className="text-[10px] text-slate-500 truncate bg-slate-950/60 p-1.5 rounded">
                      {typeof evt.payload === "string" ? evt.payload : JSON.stringify(evt.payload)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detalhe do Pacote Inspecionado */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Code2 className="h-4 w-4 text-purple-400" />
              Inspetor de Carga Útil (Payload)
            </h3>
            {selectedEvent && (
              <button
                onClick={() => handleCopyPayload(selectedEvent.payload)}
                className="p-1 text-slate-400 hover:text-white transition flex items-center gap-1 text-[11px]"
                title="Copiar JSON"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copiado!" : "Copiar"}</span>
              </button>
            )}
          </div>

          {selectedEvent ? (
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden font-mono text-xs">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-[11px] space-y-1">
                <div>
                  <span className="text-slate-500">Tópico:</span>{" "}
                  <span className="text-purple-300 font-semibold">{selectedEvent.topic}</span>
                </div>
                <div>
                  <span className="text-slate-500">Dispositivo:</span>{" "}
                  <span className="text-slate-200">{selectedEvent.deviceRef}</span> (
                  {selectedEvent.deviceType})
                </div>
                <div>
                  <span className="text-slate-500">Tipo de Evento:</span>{" "}
                  <span className="text-slate-200">{selectedEvent.eventType}</span>
                </div>
                <div>
                  <span className="text-slate-500">Carimbo de Data/Hora:</span>{" "}
                  <span className="text-slate-400">
                    {new Date(selectedEvent.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 bg-slate-950 rounded-lg border border-slate-800 text-emerald-400 text-[11px]">
                <pre>{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
              <Code2 className="h-10 w-10 text-slate-700 mb-2" />
              <p>Selecione uma mensagem no fluxo ao lado para inspecionar seus campos serializados em JSON.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
