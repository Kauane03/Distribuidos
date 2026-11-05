import React, { useState, useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  Compass,
  BatteryMedium,
  Radio,
  Router,
  Navigation,
  Clock,
  RotateCcw,
  Footprints,
  Zap,
} from "lucide-react";
import type { Pet, LocationPoint } from "../../types";

// Função para cálculo de distância Haversine em metros
function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Componente para auto-centralizar a câmera no pet se o modo "Acompanhar" estiver ativo
function AutoPanCamera({
  position,
  enabled,
}: {
  position: [number, number] | null;
  enabled: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (enabled && position) {
      map.panTo(position, { animate: true, duration: 1.0 });
    }
  }, [position, enabled, map]);
  return null;
}

interface LivePetRouteViewProps {
  pets: Pet[];
  locations: LocationPoint[];
  selectedPetId?: number;
  onSelectPet?: (id: number) => void;
}

export const LivePetRouteView: React.FC<LivePetRouteViewProps> = ({
  pets,
  locations,
  selectedPetId: initialPetId,
  onSelectPet,
}) => {
  const [activePetId, setActivePetId] = useState<number>(
    initialPetId || (pets.length > 0 ? pets[0].id : 1)
  );
  const [followCamera, setFollowCamera] = useState(true);
  const [routePoints, setRoutePoints] = useState<LocationPoint[]>([]);

  // Sincroniza se o pet mudar externamente
  useEffect(() => {
    if (initialPetId && initialPetId !== activePetId) {
      setActivePetId(initialPetId);
    }
  }, [initialPetId]);

  const activePet = useMemo(
    () => pets.find((p) => p.id === activePetId) || pets[0] || null,
    [pets, activePetId]
  );

  // Última localização conhecida deste pet específico
  const currentLoc = useMemo(() => {
    return locations.find((l) => l.petId === activePetId) || activePet?.lastLocation || null;
  }, [locations, activePetId, activePet]);

  // Atualiza os pontos da rota deste pet conforme novas localizações chegam
  useEffect(() => {
    if (!currentLoc) return;

    setRoutePoints((prev) => {
      // Se a rota estiver vazia ou for um novo ponto diferente do último
      if (prev.length === 0) {
        return [currentLoc];
      }
      const lastPoint = prev[prev.length - 1];
      if (lastPoint.lat !== currentLoc.lat || lastPoint.lng !== currentLoc.lng) {
        return [...prev.slice(-60), currentLoc]; // Mantém os últimos 60 pontos
      }
      return prev;
    });
  }, [currentLoc]);

  // Se trocar de pet, reinicia os pontos com a última posição conhecida
  const handleSelectPet = (petId: number) => {
    setActivePetId(petId);
    if (onSelectPet) onSelectPet(petId);
    const pet = pets.find((p) => p.id === petId);
    const loc = locations.find((l) => l.petId === petId) || pet?.lastLocation;
    setRoutePoints(loc ? [loc] : []);
  };

  const handleClearTrail = () => {
    if (currentLoc) {
      setRoutePoints([currentLoc]);
    } else {
      setRoutePoints([]);
    }
  };

  // Coordenadas para Polyline
  const polylineCoords: [number, number][] = useMemo(() => {
    return routePoints.map((p) => [p.lat, p.lng]);
  }, [routePoints]);

  // Distância total percorrida na sessão atual (Haversine cumulativo)
  const totalDistanceMeters = useMemo(() => {
    if (polylineCoords.length < 2) return 0;
    let dist = 0;
    for (let i = 1; i < polylineCoords.length; i++) {
      dist += haversineDist(
        polylineCoords[i - 1][0],
        polylineCoords[i - 1][1],
        polylineCoords[i][0],
        polylineCoords[i][1]
      );
    }
    return Math.round(dist);
  }, [polylineCoords]);

  // Cria ícone dinâmico do Pet
  const customPetIcon = useMemo(() => {
    const photo =
      activePet?.pathFoto ||
      "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=150";

    const html = `
      <div class="relative flex items-center justify-center">
        <div class="pet-marker-pulse"></div>
        <div class="pet-marker-pin" style="border-color: #8b5cf6;">
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
  }, [activePet]);

  const currentCoords: [number, number] | null = currentLoc
    ? [currentLoc.lat, currentLoc.lng]
    : polylineCoords.length > 0
    ? polylineCoords[polylineCoords.length - 1]
    : [-2.557812, -44.311345];

  const speedKmh = currentLoc ? (1.2 * 3.6).toFixed(1) : "0.0"; // Velocidade média estimada de caminhada

  return (
    <div className="space-y-4 h-[calc(100vh-7.5rem)] flex flex-col">
      {/* Barra Superior de Controles e Seleção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Footprints className="h-5 w-5 text-purple-400" />
            Rota do Pet em Tempo Real
          </h2>
          <p className="text-xs text-slate-400">
            Acompanhe o trajeto percorrido, vetor de deslocamento e telemetria ao vivo da coleira
          </p>
        </div>

        {/* Seletor de Pet & Câmera */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
            {pets.map((p) => {
              const isSelected = p.id === activePetId;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPet(p.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/60"
                  }`}
                >
                  <img
                    src={
                      p.pathFoto ||
                      "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=60"
                    }
                    alt={p.nome}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                  <span>{p.nome.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Toggle de Auto-acompanhar Câmera */}
          <button
            onClick={() => setFollowCamera(!followCamera)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              followCamera
                ? "bg-purple-950/60 border-purple-500/60 text-purple-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Recentralizar automaticamente o mapa a cada novo passo"
          >
            <Compass className={`h-4 w-4 ${followCamera ? "text-purple-400 animate-spin" : ""}`} />
            <span>{followCamera ? "Seguindo Pet" : "Câmera Livre"}</span>
          </button>

          {/* Limpar Trilha */}
          <button
            onClick={handleClearTrail}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Limpar trilha atual da sessão"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid Principal: Mapa e Painel Lateral de Telemetria */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">
        {/* Mapa Interativo */}
        <div className="lg:col-span-3 h-full w-full relative z-10">
          <MapContainer
            center={currentCoords || [-2.557812, -44.311345]}
            zoom={17}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%", minHeight: "450px" }}
          >
            {/* Auto-pan camera quando novo ponto chega */}
            <AutoPanCamera position={currentCoords} enabled={followCamera} />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Trilha Polyline contínua do pet */}
            {polylineCoords.length > 1 && (
              <Polyline
                positions={polylineCoords}
                color="#7c3aed"
                weight={5}
                opacity={0.85}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* Breadcrumb Markers (Pontinhos pelo caminho percorrido) */}
            {routePoints.slice(0, -1).map((pt, idx) => (
              <CircleMarker
                key={idx}
                center={[pt.lat, pt.lng]}
                radius={4}
                pathOptions={{
                  color: "#a855f7",
                  fillColor: "#3b0764",
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1 text-slate-900 text-xs">
                    <p className="font-bold">Ponto #{idx + 1}</p>
                    <p className="text-slate-600">
                      Hora: {new Date(pt.capturedAt).toLocaleTimeString("pt-BR")}
                    </p>
                    <p className="text-slate-600 font-mono">
                      {pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Marcador atual com a foto e anel de pulso */}
            {currentCoords && (
              <Marker position={currentCoords} icon={customPetIcon}>
                <Popup className="custom-popup">
                  <div className="p-1 text-slate-900 max-w-xs text-xs">
                    <h4 className="font-bold text-sm text-purple-900 mb-1">
                      {activePet?.nome || "Pet"}
                    </h4>
                    <p className="text-slate-600 mb-2">{activePet?.raca || "Vira-lata"}</p>
                    <div className="space-y-1 border-t pt-1 font-mono text-[11px]">
                      <div>Coleira: {currentLoc?.trackerRef || "TRK"}</div>
                      <div>Bateria: {currentLoc?.bateriaTracker}%</div>
                      <div>Sinal: {currentLoc?.qualidadeSinal} ({currentLoc?.rssi})</div>
                      <div>Gateway: {currentLoc?.stickRef || "Direto"}</div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Painel Lateral com Métricas ao Vivo da Rota */}
        <div className="p-4 bg-slate-900 border-l border-slate-800 overflow-y-auto space-y-4 shrink-0">
          {/* Card do Pet Ativo */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-3">
            <img
              src={
                activePet?.pathFoto ||
                "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=150"
              }
              alt={activePet?.nome || "Pet"}
              className="h-12 w-12 rounded-full object-cover border-2 border-purple-500"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-white truncate">{activePet?.nome}</h3>
              <p className="text-xs text-slate-400 truncate">{activePet?.raca || "Raça não informada"}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                  Transmissão Ativa
                </span>
              </div>
            </div>
          </div>

          {/* Métricas da Rota */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Métricas do Trajeto
            </div>

            {/* Distância Percorrida */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Navigation className="h-4 w-4 text-purple-400" />
                <span>Distância Total</span>
              </div>
              <span className="font-mono font-bold text-base text-white">
                {totalDistanceMeters >= 1000
                  ? `${(totalDistanceMeters / 1000).toFixed(2)} km`
                  : `${totalDistanceMeters} m`}
              </span>
            </div>

            {/* Velocidade Estimada */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>Velocidade Média</span>
              </div>
              <span className="font-mono font-bold text-sm text-amber-300">
                ~{speedKmh} km/h
              </span>
            </div>

            {/* Pontos Capturados na Sessão */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Footprints className="h-4 w-4 text-cyan-400" />
                <span>Pontos na Trilha</span>
              </div>
              <span className="font-mono font-bold text-sm text-cyan-300">
                {routePoints.length} coordenadas
              </span>
            </div>
          </div>

          {/* Telemetria de Conexão Distribuída */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Sinais e Conectividade
            </div>

            {/* Bateria do Tracker */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/40 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <BatteryMedium className="h-4 w-4 text-emerald-400" />
                  Bateria da Coleira
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {currentLoc?.bateriaTracker ? `${currentLoc.bateriaTracker}%` : "--"}
                </span>
              </div>
              {/* Barra de progresso da bateria */}
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${currentLoc?.bateriaTracker || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Força do Sinal RSSI */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Radio className="h-4 w-4 text-purple-400" />
                Sinal LoRa/BLE
              </span>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                  currentLoc?.qualidadeSinal === "Excelente"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : currentLoc?.qualidadeSinal === "Bom"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {currentLoc?.qualidadeSinal || "Bom"} {currentLoc?.rssi ? `(${currentLoc.rssi})` : ""}
              </span>
            </div>

            {/* Stick Gateway */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Router className="h-4 w-4 text-indigo-400" />
                Gateway Stick
              </span>
              <span className="font-mono text-purple-300 font-medium">
                {currentLoc?.stickRef || "STICK_CCET_UFMA"}
              </span>
            </div>

            {/* Último Heartbeat */}
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                Recebido às
              </span>
              <span className="font-mono text-slate-300 text-[11px]">
                {currentLoc ? new Date(currentLoc.capturedAt).toLocaleTimeString("pt-BR") : "--"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
