import React, { useState } from "react";
import {
  Router,
  Plus,
  Trash2,
  Wifi,
  Settings,
  BatteryMedium,
  Clock,
  Send,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import type { Stick } from "../../types";

interface SticksViewProps {
  sticks: Stick[];
  onCreateStick: (data: { stickRef: string; wifiSsid?: string }) => Promise<void>;
  onDeleteStick: (id: number) => Promise<void>;
  onConfigureWifi: (id: number, config: { ssid: string; password?: string }) => Promise<void>;
}

export const SticksView: React.FC<SticksViewProps> = ({
  sticks,
  onCreateStick,
  onDeleteStick,
  onConfigureWifi,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [configuringStick, setConfiguringStick] = useState<Stick | null>(null);

  // States form create
  const [stickRef, setStickRef] = useState("");
  const [initialWifi, setInitialWifi] = useState("");

  // States form config wifi
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stickRef.trim()) {
      setErrorMsg("A referência do stick é obrigatória.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onCreateStick({
        stickRef: stickRef.trim().toUpperCase(),
        wifiSsid: initialWifi.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setStickRef("");
      setInitialWifi("");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao cadastrar stick.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenConfig = (stk: Stick) => {
    setConfiguringStick(stk);
    setWifiSsid(stk.wifiSsid || "");
    setWifiPassword("");
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringStick || !wifiSsid.trim()) {
      setErrorMsg("O SSID da rede Wi-Fi é obrigatório.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onConfigureWifi(configuringStick.id, {
        ssid: wifiSsid.trim(),
        password: wifiPassword,
      });
      setSuccessMsg(`Configuração enviada via MQTT para pawsition/sticks/${configuringStick.stickRef}/config!`);
      setTimeout(() => {
        setConfiguringStick(null);
        setSuccessMsg(null);
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao publicar configuração via MQTT.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Dispositivos Sticks (Gateways e Pontos de Coleta)</h2>
          <p className="text-xs text-slate-400">
            Estações base que recebem sinais dos trackers, fornecem conectividade Wi-Fi e sincronizam dados
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setStickRef("");
            setInitialWifi("");
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-sm shadow-md transition"
        >
          <Plus className="h-4 w-4" />
          Novo Stick Gateway
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sticks.map((stk) => (
          <div
            key={stk.id}
            className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Router className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-mono font-bold text-base text-white">{stk.stickRef}</h3>
                </div>

                <span
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    stk.isOnline
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${stk.isOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}
                  ></span>
                  {stk.isOnline ? "Online" : "Offline"}
                </span>
              </div>

              {/* Wi-Fi Configurado */}
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/40 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Wifi className="h-4 w-4 text-indigo-400" />
                  <div>
                    <p className="text-slate-400 text-[10px]">Rede Wi-Fi Conectada:</p>
                    <p className="font-semibold text-slate-200">{stk.wifiSsid || "Não configurado"}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenConfig(stk)}
                  title="Configurar Wi-Fi via MQTT"
                  className="p-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/50 transition flex items-center gap-1 text-[11px]"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Configurar</span>
                </button>
              </div>

              {/* Informações */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bateria do Gateway:</span>
                  <span className="font-mono font-semibold text-emerald-400 flex items-center gap-1">
                    <BatteryMedium className="h-4 w-4" />
                    {stk.bateria !== null ? `${stk.bateria}%` : "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Último Heartbeat:</span>
                  <span className="font-mono text-slate-300 text-[11px] flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {stk.lastSeen ? new Date(stk.lastSeen).toLocaleTimeString("pt-BR") : "Nunca"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700/40 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-mono text-[10px]">
                pawsition/sticks/{stk.stickRef}/*
              </span>
              <button
                onClick={() => onDeleteStick(stk.id)}
                title="Excluir Stick"
                className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Criar Stick */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Registrar Novo Stick Gateway</h3>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Referência do Stick (Identificador Único) *
                </label>
                <input
                  type="text"
                  value={stickRef}
                  onChange={(e) => setStickRef(e.target.value.toUpperCase())}
                  placeholder="Ex: STICK_CCET_UFMA, STICK_CASA"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  SSID Wi-Fi Padrão (Opcional)
                </label>
                <input
                  type="text"
                  value={initialWifi}
                  onChange={(e) => setInitialWifi(e.target.value)}
                  placeholder="Ex: UFMA_WIFI, MINHA_CASA"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                />
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
                  {isSubmitting ? "Cadastrando..." : "Registrar Stick"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Configurar Wi-Fi via MQTT */}
      {configuringStick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-5 w-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">
                Configurar Wi-Fi: {configuringStick.stickRef}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Dispara uma mensagem de controle distribuída no tópico MQTT{" "}
              <code className="text-purple-400 font-mono">
                pawsition/sticks/{configuringStick.stickRef}/config
              </code>
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Nome da Rede Wi-Fi (SSID) *
                </label>
                <input
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="Ex: UFMA_EDUROAM"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Senha da Rede Wi-Fi
                </label>
                <input
                  type="password"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="Deixe em branco se for rede aberta"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfiguringStick(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? "Publicando..." : "Publicar via MQTT"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
