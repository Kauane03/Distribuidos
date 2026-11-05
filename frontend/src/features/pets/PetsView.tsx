import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Edit,
  Radio,
  Link as LinkIcon,
  Unlink,
  Calendar,
  AlertCircle,
  Footprints,
} from "lucide-react";
import type { Pet, Tracker } from "../../types";

interface PetsViewProps {
  pets: Pet[];
  availableTrackers: Tracker[];
  onCreatePet: (data: { nome: string; raca?: string; dataNascimento?: string; pathFoto?: string; trackerId?: number }) => Promise<void>;
  onUpdatePet: (id: number, data: Partial<Pet> & { trackerId?: number | null }) => Promise<void>;
  onDeletePet: (id: number) => Promise<void>;
  onUnlinkTracker: (linkId: number) => Promise<void>;
  onNavigateToPetRoute?: (petId: number) => void;
}

export const PetsView: React.FC<PetsViewProps> = ({
  pets,
  availableTrackers,
  onCreatePet,
  onUpdatePet,
  onDeletePet,
  onUnlinkTracker,
  onNavigateToPetRoute,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [raca, setRaca] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [pathFoto, setPathFoto] = useState("");
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setNome("");
    setRaca("");
    setDataNascimento("");
    setPathFoto("");
    setSelectedTrackerId(undefined);
    setErrorMsg(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (pet: Pet) => {
    setEditingPet(pet);
    setNome(pet.nome);
    setRaca(pet.raca || "");
    setDataNascimento(pet.dataNascimento ? pet.dataNascimento.slice(0, 10) : "");
    setPathFoto(pet.pathFoto || "");
    setSelectedTrackerId(pet.activeTracker?.id || undefined);
    setErrorMsg(null);
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErrorMsg("O nome do pet é obrigatório.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onCreatePet({
        nome: nome.trim(),
        raca: raca.trim() || undefined,
        dataNascimento: dataNascimento || undefined,
        pathFoto: pathFoto.trim() || undefined,
        trackerId: selectedTrackerId,
      });
      setIsCreateModalOpen(false);
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar pet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPet) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onUpdatePet(editingPet.id, {
        nome: nome.trim(),
        raca: raca.trim() || undefined,
        dataNascimento: dataNascimento || undefined,
        pathFoto: pathFoto.trim() || undefined,
        trackerId: selectedTrackerId !== undefined ? selectedTrackerId : null,
      });
      setEditingPet(null);
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao atualizar pet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Gerenciamento de Pets</h2>
          <p className="text-xs text-slate-400">
            Cadastre os animais e faça a associação com as coleiras rastreadoras (Trackers)
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-sm shadow-md transition"
        >
          <Plus className="h-4 w-4" />
          Novo Pet
        </button>
      </div>

      {/* Cards de Pets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pets.map((pet) => (
          <div
            key={pet.id}
            className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Imagem e Badge */}
              <div className="h-44 w-full bg-slate-900 relative">
                <img
                  src={
                    pet.pathFoto ||
                    "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400"
                  }
                  alt={pet.nome}
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-3 right-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      pet.status
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {pet.status ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>

              {/* Informações */}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-white">{pet.nome}</h3>
                    <p className="text-xs text-slate-400">{pet.raca || "Raça não informada"}</p>
                  </div>
                </div>

                {pet.dataNascimento && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Nascimento: {new Date(pet.dataNascimento).toLocaleDateString("pt-BR")}</span>
                  </div>
                )}

                {/* Status do Tracker Vinculado */}
                <div className="pt-2 border-t border-slate-700/50">
                  {pet.activeTracker ? (
                    <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-purple-400" />
                        <div>
                          <p className="text-xs font-mono font-semibold text-purple-200">
                            {pet.activeTracker.trackerRef}
                          </p>
                          <p className="text-[10px] text-purple-400">Coleira Ativa</p>
                        </div>
                      </div>
                      {pet.activeLinkId && (
                        <button
                          onClick={() => onUnlinkTracker(pet.activeLinkId!)}
                          title="Desvincular coleira"
                          className="p-1 text-purple-300 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                        >
                          <Unlink className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>Nenhum tracker associado</span>
                      <button
                        onClick={() => handleOpenEdit(pet)}
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Vincular
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="px-5 py-3 bg-slate-900/40 border-t border-slate-700/40 flex items-center justify-between">
              {onNavigateToPetRoute ? (
                <button
                  onClick={() => onNavigateToPetRoute(pet.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/50 transition flex items-center gap-1.5 text-xs font-medium"
                  title="Acompanhar trajeto deste pet em tempo real"
                >
                  <Footprints className="h-3.5 w-3.5 text-purple-400" />
                  <span>Rota ao Vivo</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(pet)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Editar Pet"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDeletePet(pet.id)}
                  className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition"
                  title="Remover Pet"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Criar Pet */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Cadastrar Novo Pet</h3>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Nome do Pet *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Rex, Thor, Mel"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Raça
                </label>
                <input
                  type="text"
                  value={raca}
                  onChange={(e) => setRaca(e.target.value)}
                  placeholder="Ex: Vira-lata, Labrador, Poodle"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  URL da Foto
                </label>
                <input
                  type="url"
                  value={pathFoto}
                  onChange={(e) => setPathFoto(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Vincular Tracker (Opcional)
                </label>
                <select
                  value={selectedTrackerId || ""}
                  onChange={(e) => setSelectedTrackerId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                >
                  <option value="">Nenhum dispositivo agora</option>
                  {availableTrackers.map((trk) => (
                    <option key={trk.id} value={trk.id}>
                      {trk.trackerRef} ({trk.bateria ? `${trk.bateria}%` : "bateria n/d"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Cadastrar Pet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Pet */}
      {editingPet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Editar Pet: {editingPet.nome}</h3>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Nome do Pet *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Raça
                </label>
                <input
                  type="text"
                  value={raca}
                  onChange={(e) => setRaca(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Vincular Tracker
                </label>
                <select
                  value={selectedTrackerId || ""}
                  onChange={(e) => setSelectedTrackerId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                >
                  <option value="">Sem vínculo</option>
                  {editingPet.activeTracker && (
                    <option value={editingPet.activeTracker.id}>
                      {editingPet.activeTracker.trackerRef} (Atual)
                    </option>
                  )}
                  {availableTrackers.map((trk) => (
                    <option key={trk.id} value={trk.id}>
                      {trk.trackerRef} ({trk.bateria ? `${trk.bateria}%` : "bateria n/d"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPet(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
