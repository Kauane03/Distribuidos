import React, { useState } from "react";
import {
  Radio,
  Plus,
  Trash2,
  BatteryMedium,
  Clock,
  Dog,
  AlertCircle,
} from "lucide-react";
import type { Tracker } from "../../types";

interface TrackersViewProps {
  trackers: Tracker[];
  onCreateTracker: (data: { trackerRef: string }) => Promise<void>;
  onDeleteTracker: (id: number) => Promise<void>;
}

export const TrackersView: React.FC<TrackersViewProps> = ({
  trackers,
  onCreateTracker,
  onDeleteTracker,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trackerRef, setTrackerRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackerRef.trim()) {
      setErrorMsg("A referência do tracker é obrigatória.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onCreateTracker({ trackerRef: trackerRef.trim().toUpperCase() });
      setIsModalOpen(false);
      setTrackerRef("");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao cadastrar tracker.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Dispositivos Trackers (Coleiras)</h2>
          <p className="text-xs text-slate-400">
            Monitoramento de status, nível de bateria e presença dos nós sensores na rede
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setTrackerRef("");
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-sm shadow-md transition"
        >
          <Plus className="h-4 w-4" />
          Novo Tracker
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trackers.map((trk) => {
          const isLowBat = trk.bateria !== null && trk.bateria < 20;

          return (
            <div
              key={trk.id}
              className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Radio className="h-5 w-5 text-purple-400" />
                    <h3 className="font-mono font-bold text-base text-white">{trk.trackerRef}</h3>
                  </div>

                  {/* Badge Online/Offline */}
                  <span
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      trk.isOnline
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {trk.isOnline ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Online
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                        Offline
                      </>
                    )}
                  </span>
                </div>

                {/* Pet Associado */}
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dog className="h-4 w-4 text-slate-400" />
                    <span className="text-xs text-slate-300">
                      {trk.activePet ? trk.activePet.nome : "Sem pet associado"}
                    </span>
                  </div>
                  {trk.activePet && (
                    <span className="text-[10px] text-purple-400 font-medium bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                      Vinculado
                    </span>
                  )}
                </div>

                {/* Métricas */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nível da Bateria:</span>
                    <span
                      className={`font-mono font-semibold flex items-center gap-1 ${
                        isLowBat ? "text-rose-400 animate-pulse" : "text-emerald-400"
                      }`}
                    >
                      <BatteryMedium className="h-4 w-4" />
                      {trk.bateria !== null ? `${trk.bateria}%` : "Aguardando leitura"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Última Transmissão:</span>
                    <span className="font-mono text-slate-300 text-[11px] flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {trk.lastSeen ? new Date(trk.lastSeen).toLocaleTimeString("pt-BR") : "Nunca"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700/40 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono text-[10px]">
                  Tópico: pawsition/trackers/{trk.trackerRef}/*
                </span>
                <button
                  onClick={() => onDeleteTracker(trk.id)}
                  title="Excluir Tracker"
                  className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Criar Tracker */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Registrar Novo Tracker</h3>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Referência do Dispositivo (Código Único) *
                </label>
                <input
                  type="text"
                  value={trackerRef}
                  onChange={(e) => setTrackerRef(e.target.value.toUpperCase())}
                  placeholder="Ex: TRK_DOG_05, TRK_UFMA_01"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-purple-500 outline-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Este identificador é utilizado no tópico MQTT e pelo simulador Python.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? "Cadastrando..." : "Registrar Tracker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
