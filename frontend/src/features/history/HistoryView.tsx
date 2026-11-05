import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";
import type { Pet, LocationPoint } from "../../types";
import { api } from "../../services/api";

interface HistoryViewProps {
  pets: Pet[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ pets }) => {
  const [selectedPetId, setSelectedPetId] = useState<number | undefined>(
    pets.length > 0 ? pets[0].id : undefined
  );
  const [limit, setLimit] = useState<number>(50);
  const [history, setHistory] = useState<LocationPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    if (!selectedPetId) return;
    try {
      setIsLoading(true);
      const data = await api.getLocationHistory({ petId: selectedPetId, limit });
      setHistory(data);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPetId) {
      fetchHistory();
    }
  }, [selectedPetId, limit]);

  const polylineCoords: [number, number][] = history.map((h) => [h.lat, h.lng]);
  const centerCoords: [number, number] =
    polylineCoords.length > 0 ? polylineCoords[0] : [-2.557812, -44.311345];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Histórico e Auditoria de Rastreamento</h2>
          <p className="text-xs text-slate-400">
            Consulte trajetórias passadas, telemetrias armazenadas e métricas de conexão
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3">
          <select
            value={selectedPetId || ""}
            onChange={(e) => setSelectedPetId(Number(e.target.value))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-medium outline-none focus:border-purple-500"
          >
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.raca || "Pet"})
              </option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-medium outline-none focus:border-purple-500"
          >
            <option value={25}>Últimos 25 pontos</option>
            <option value={50}>Últimos 50 pontos</option>
            <option value={100}>Últimos 100 pontos</option>
            <option value={200}>Últimos 200 pontos</option>
          </select>

          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Recarregar"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapa com trajeto percorrido */}
        <div className="lg:col-span-1 h-[420px] rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 relative">
          <MapContainer
            key={`${selectedPetId}-${history.length}`}
            center={centerCoords}
            zoom={15}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {polylineCoords.length > 1 && (
              <Polyline positions={polylineCoords} color="#7c3aed" weight={4} opacity={0.8} />
            )}
            {polylineCoords.length > 0 && (
              <Marker position={polylineCoords[0]}>
                <Popup>Última posição registrada</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Tabela de coordenadas */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden flex flex-col h-[420px]">
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Registros Persistidos ({history.length})
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Filtro: {history.length} leituras retornadas
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-mono text-[10px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Data / Hora</th>
                  <th className="py-2.5 px-4">Latitude</th>
                  <th className="py-2.5 px-4">Longitude</th>
                  <th className="py-2.5 px-4">Bateria</th>
                  <th className="py-2.5 px-4">Sinal RSSI</th>
                  <th className="py-2.5 px-4">Stick Gateway</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 text-slate-300 font-mono">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Nenhum registro encontrado para o pet selecionado.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-4 text-slate-400">
                        {new Date(item.capturedAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2.5 px-4 text-emerald-400">{item.lat.toFixed(6)}</td>
                      <td className="py-2.5 px-4 text-emerald-400">{item.lng.toFixed(6)}</td>
                      <td className="py-2.5 px-4 text-slate-300">
                        {item.bateriaTracker ? `${item.bateriaTracker}%` : "--"}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            item.qualidadeSinal === "Excelente"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : item.qualidadeSinal === "Bom"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {item.qualidadeSinal} ({item.rssi})
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-purple-300">{item.stickRef || "Direto"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
