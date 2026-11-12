import React, { useState, useMemo } from "react";
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
  Search,
  SlidersHorizontal,
  X,
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

  // Filtro de quantidade e busca
  const [quantity, setQuantity] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Opções rápidas de quantidade
  const quickQuantities = [50, 100, 250, 500, 1000, 1500];

  // Aplica filtro de quantidade e busca
  const filteredLocations = useMemo(() => {
    let result = locations;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (loc) =>
          loc.petNome?.toLowerCase().includes(term) ||
          loc.trackerRef?.toLowerCase().includes(term) ||
          loc.raca?.toLowerCase().includes(term)
      );
    }
    if (quantity > 0 && quantity < result.length) {
      return result.slice(0, quantity);
    }
    return result;
  }, [locations, searchTerm, quantity]);

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
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -22],
    });
  };

  const handleFocusPet = (loc: LocationPoint) => {
    setSelectedPetId(loc.petId || null);
    setCenter([loc.lat, loc.lng]);
    setZoom(17);
  };

  return (
    <div className="space-y-3 h-[calc(100vh-8rem)] flex flex-col">
      {/* Barra Superior Limpa com Controles e Filtro de Quantidade */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
        <div>
          <h2 className="text-lg font-bold text-white">Mapa em Tempo Real</h2>
          <span className="text-xs text-purple-300 font-medium">
            Exibindo {filteredLocations.length} de {locations.length} pets
          </span>
        </div>

        {/* Filtro de Quantidade */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 mr-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-medium">Quantidade no mapa:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
            {quickQuantities.map((qty) => (
              <button
                key={qty}
                onClick={() => setQuantity(qty)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  quantity === qty
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {qty}
              </button>
            ))}
            <button
              onClick={() => setQuantity(0)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                quantity === 0 || quantity >= locations.length
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              Todos
            </button>
          </div>

          {/* Input numérico personalizado */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max={locations.length || 1500}
              placeholder="Qtd"
              value={quantity === 0 ? "" : quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setQuantity(isNaN(val) ? 0 : Math.max(1, Math.min(val, locations.length || 1500)));
              }}
              className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-center focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">
        {/* Painel lateral de pets na visão de mapa */}
        <div className="p-3 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden shrink-0">
          {/* Campo de Busca Rápida */}
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar pet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-2 shrink-0">
            <span>Lista ({filteredLocations.length})</span>
            <Radio className="h-3 w-3 text-purple-400 animate-pulse" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredLocations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum pet encontrado com os filtros atuais.
              </div>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = selectedPetId === loc.petId;
                return (
                  <div
                    key={loc.petId || loc.trackerRef}
                    onClick={() => handleFocusPet(loc)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-900/30 border-purple-500/50 shadow-md"
                        : "bg-slate-800/50 border-slate-700/60 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={
                          loc.petFoto ||
                          "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=150"
                        }
                        alt={loc.petNome || "Pet"}
                        className="h-8 w-8 rounded-full object-cover border border-slate-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-xs text-slate-100 truncate">{loc.petNome}</p>
                          <span className="font-mono text-[10px] text-purple-400">{loc.trackerRef}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
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

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Marcadores e trilhas de cada pet filtrado */}
            {filteredLocations.map((loc) => {
              const trail = (loc.petId && historyTrails[loc.petId]) || [];
              const petCoords: [number, number] = [loc.lat, loc.lng];

              return (
                <React.Fragment key={loc.petId || loc.trackerRef}>
                  {/* Trilha do pet (Polyline) */}
                  {trail.length > 1 && (
                    <Polyline
                      positions={trail}
                      color="#8b5cf6"
                      weight={3}
                      opacity={0.8}
                      dashArray="4, 8"
                    />
                  )}

                  {/* Marcador ao vivo */}
                  <Marker position={petCoords} icon={createCustomMarker(loc)}>
                    <Popup className="custom-popup">
                      <div className="p-1 text-slate-900 max-w-xs">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="font-bold text-sm text-purple-900">{loc.petNome}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                            {loc.trackerRef}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs border-t pt-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Bateria:</span>
                            <span className="font-semibold">{loc.bateriaTracker}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Sinal:</span>
                            <span className="font-semibold text-emerald-600">{loc.qualidadeSinal}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                            <span>Atualizado:</span>
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
