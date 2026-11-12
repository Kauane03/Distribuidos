import React, { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  Radio,
  BatteryMedium,
} from "lucide-react";
import type { LocationPoint } from "../../types";

// Corrige problema dos ícones padrão do Leaflet com Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Componente para recentralizar o mapa suavemente
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom, { animate: true });
  return null;
}

interface LiveMapViewProps {
  locations: LocationPoint[];
  historyTrails: Record<number, [number, number][]>; // petId -> array de [lat, lng]
}

export const LiveMapView: React.FC<LiveMapViewProps> = ({ locations, historyTrails }) => {
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [center, setCenter] = useState<[number, number]>([-2.5300, -44.2600]);
  const [zoom, setZoom] = useState<number>(12);

  // Cria ícone customizado com foto do pet e anel de pulso
  const createCustomMarker = (loc: LocationPoint) => {
    const photo =
      loc.petFoto ||
      "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=150";

    const html = `
      <div class="relative flex items-center justify-center">
        <div class="pet-marker-pulse"></div>
        <div class="pet-marker-pin">
          <img src="${photo}" alt="pet" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: "pet-marker-icon",
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -24],
    });
  };

  const handleFocusPet = (loc: LocationPoint) => {
    setSelectedPetId(loc.petId || null);
    setCenter([loc.lat, loc.lng]);
    setZoom(17);
  };

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white">Rastreamento Cartográfico em Tempo Real</h2>
          <p className="text-xs text-slate-400">
            Localização geográfica ao vivo dos pets via broker MQTT e transmissões LoRa/BLE
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-800/40 px-3 py-1.5 rounded-lg">
            Ilha de São Luís - MA &bull; {locations.length} Pets em Tempo Real
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">
        {/* Painel lateral de pets na visão de mapa */}
        <div className="p-4 bg-slate-900 border-r border-slate-800 overflow-y-auto space-y-3 shrink-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Dispositivos Ativos ({locations.length})</span>
            <Radio className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
          </div>

          {locations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Nenhuma posição recebida ainda.
            </div>
          ) : (
            locations.map((loc) => {
              const isSelected = selectedPetId === loc.petId;
              return (
                <div
                  key={loc.petId || loc.trackerRef}
                  onClick={() => handleFocusPet(loc)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-purple-900/30 border-purple-500/50 shadow-md"
                      : "bg-slate-800/50 border-slate-700/60 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        loc.petFoto ||
                        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=150"
                      }
                      alt={loc.petNome || "Pet"}
                      className="h-10 w-10 rounded-full object-cover border border-slate-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-slate-100 truncate">{loc.petNome}</p>
                        <span className="font-mono text-[10px] text-purple-400">{loc.trackerRef}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <BatteryMedium className="h-3 w-3 text-emerald-400" />
                          {loc.bateriaTracker ? `${loc.bateriaTracker}%` : "--"}
                        </span>
                        <span>&bull;</span>
                        <span className="text-cyan-400 font-mono text-[10px]">
                          {loc.qualidadeSinal || "Sinal"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mapa Leaflet */}
        <div className="lg:col-span-3 h-full w-full relative z-10">
          <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%", minHeight: "450px" }}
          >
            <ChangeView center={center} zoom={zoom} />

            {/* Camada OpenStreetMap padrão com estilo escuro ou carto */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Marcadores e trilhas de cada pet */}
            {locations.map((loc) => {
              const trail = (loc.petId && historyTrails[loc.petId]) || [];
              const petCoords: [number, number] = [loc.lat, loc.lng];

              return (
                <React.Fragment key={loc.petId || loc.trackerRef}>
                  {/* Trilha do pet (Polyline) */}
                  {trail.length > 1 && (
                    <Polyline
                      positions={trail}
                      color="#8b5cf6"
                      weight={4}
                      opacity={0.8}
                      dashArray="4, 8"
                    />
                  )}

                  {/* Marcador ao vivo */}
                  <Marker position={petCoords} icon={createCustomMarker(loc)}>
                    <Popup className="custom-popup">
                      <div className="p-1 text-slate-900 max-w-xs">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-sm text-purple-900">{loc.petNome}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                            {loc.trackerRef}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-2">{loc.raca || "Vira-lata"}</p>
                        <div className="space-y-1 text-xs border-t pt-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Bateria Tracker:</span>
                            <span className="font-semibold">{loc.bateriaTracker}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Qualidade do Sinal:</span>
                            <span className="font-semibold text-emerald-600">{loc.qualidadeSinal} ({loc.rssi})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Gateway Stick:</span>
                            <span className="font-mono text-[11px]">{loc.stickRef || "Direto"}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                            <span>Capturado às:</span>
                            <span>{new Date(loc.capturedAt).toLocaleTimeString("pt-BR")}</span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
