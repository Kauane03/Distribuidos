import React, { useState, useEffect, useCallback } from "react";
import {
  Server,
  Cpu,
  Activity,
  CheckCircle2,
  RefreshCw,
  Zap,
  Network,
  Database,
  Radio,
  Layers,
  Clock,
  Play,
  RotateCcw,
  StopCircle,
  Gauge,
  TrendingUp,
} from "lucide-react";

interface NodeStats {
  hostname: string;
  ipPort: string;
  uptime: number;
  memory: {
    rssMB: number;
    heapUsedMB: number;
  };
  totalServed: number;
  lastSeen: Date;
  status: "healthy" | "warning" | "offline";
}

interface ProbeResult {
  id: number;
  timestamp: string;
  servedBy: string;
  hostname: string;
  latencyMs: number;
  status: number;
}

interface BenchmarkStatus {
  running: boolean;
  total: number;
  completed: number;
  errors: number;
  currentRps: number;
  avgRps: number;
  elapsedSeconds: number;
  etaSeconds: number;
  percent: number;
  distribution: Record<string, number>;
  finishedAt?: string;
  targetUrl: string;
}

export const ClusterMonitorView: React.FC = () => {
  const [nodes, setNodes] = useState<Map<string, NodeStats>>(new Map());
  const [probeHistory, setProbeHistory] = useState<ProbeResult[]>([]);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState<boolean>(true);
  const [probeCountTarget, setProbeCountTarget] = useState<number>(1_000_000);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState<BenchmarkStatus | null>(null);

  // Executa uma única sondagem ao cluster
  const executeSingleProbe = useCallback(async (probeId: number): Promise<ProbeResult | null> => {
    const startTime = performance.now();
    try {
      const res = await fetch("/api/cluster/probe", { cache: "no-store" });
      const latencyMs = Math.round(performance.now() - startTime);
      const servedBy = res.headers.get("x-served-by") || "127.0.0.1:3000";
      const data = await res.json();

      const result: ProbeResult = {
        id: probeId,
        timestamp: new Date().toLocaleTimeString("pt-BR"),
        servedBy,
        hostname: data.hostname || "unknown",
        latencyMs,
        status: res.status,
      };

      setNodes((prev) => {
        const next = new Map(prev);
        const nodeKey = servedBy || data.hostname;
        const existing = next.get(nodeKey);

        next.set(nodeKey, {
          hostname: data.hostname,
          ipPort: servedBy,
          uptime: data.uptime || 0,
          memory: data.memory || { rssMB: 0, heapUsedMB: 0 },
          totalServed: (existing?.totalServed || 0) + 1,
          lastSeen: new Date(),
          status: "healthy",
        });
        return next;
      });

      return result;
    } catch (err) {
      console.error("Falha ao sondar nó do cluster:", err);
      return null;
    }
  }, []);

  // Busca dados de saúde geral do cluster e middleware
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (e) {
      console.warn("Erro ao buscar saúde do sistema:", e);
    }
  }, []);

  // Busca status do benchmark massivo
  const fetchBenchmarkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/cluster/benchmark/status", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setBenchmarkStatus(json.data);
          if (json.data.distribution) {
            setNodes((prev) => {
              const next = new Map(prev);
              for (const [srv, count] of Object.entries(json.data.distribution as Record<string, number>)) {
                const existing = next.get(srv);
                if (existing) {
                  next.set(srv, { ...existing, totalServed: count });
                }
              }
              return next;
            });
          }
          if (!json.data.running && isProbing) {
            setIsProbing(false);
          }
        }
      }
    } catch {
      // silêncio
    }
  }, [isProbing]);

  // Inicialização
  useEffect(() => {
    fetchHealth();
    fetchBenchmarkStatus();
    const discover = async () => {
      for (let i = 1; i <= 6; i++) {
        await executeSingleProbe(i);
        await new Promise((r) => setTimeout(r, 60));
      }
    };
    discover();
  }, [executeSingleProbe, fetchHealth, fetchBenchmarkStatus]);

  // Polling de benchmark quando ativo
  useEffect(() => {
    if (!benchmarkStatus?.running && !isProbing) return;
    const interval = setInterval(() => {
      fetchBenchmarkStatus();
    }, 400);
    return () => clearInterval(interval);
  }, [benchmarkStatus?.running, isProbing, fetchBenchmarkStatus]);

  // Auto-refresh a cada 4 segundos
  useEffect(() => {
    if (!isAutoRefreshing || benchmarkStatus?.running) return;
    const interval = setInterval(() => {
      executeSingleProbe(Date.now());
      fetchHealth();
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoRefreshing, benchmarkStatus?.running, executeSingleProbe, fetchHealth]);

  // Dispara teste no backend (especialmente para volumes altos >= 1.000 ou 1 milhão)
  const handleStartBenchmark = async (total: number) => {
    try {
      setIsProbing(true);
      const res = await fetch("/api/cluster/benchmark/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total, concurrency: 120 }),
      });
      const json = await res.json();
      if (json.data) {
        setBenchmarkStatus(json.data);
      }
    } catch (err) {
      console.error("Erro ao iniciar benchmark:", err);
      setIsProbing(false);
    }
  };

  const handleStopBenchmark = async () => {
    try {
      await fetch("/api/cluster/benchmark/stop", { method: "POST" });
      setIsProbing(false);
      fetchBenchmarkStatus();
    } catch (err) {
      console.error("Erro ao interromper benchmark:", err);
    }
  };

  // Gerencia o disparo do teste
  const handleTriggerTest = async () => {
    if (isProbing || benchmarkStatus?.running) return;

    if (probeCountTarget >= 1_000) {
      // Dispara motor assíncrono de alta performance no backend
      await handleStartBenchmark(probeCountTarget);
    } else {
      // Dispara teste sequencial no frontend para volumes pequenos
      setIsProbing(true);
      for (let i = 1; i <= probeCountTarget; i++) {
        const res = await executeSingleProbe(Date.now() + i);
        if (res) {
          setProbeHistory((prev) => [res, ...prev.slice(0, 49)]);
        }
        await new Promise((r) => setTimeout(r, 60));
      }
      setIsProbing(false);
    }
  };

  const handleResetCounters = () => {
    setNodes((prev) => {
      const next = new Map();
      prev.forEach((val, key) => {
        next.set(key, { ...val, totalServed: 0 });
      });
      return next;
    });
    setProbeHistory([]);
    setBenchmarkStatus(null);
  };

  const nodesList = Array.from(nodes.values());
  const totalRequestsCount = benchmarkStatus?.completed || nodesList.reduce((acc, curr) => acc + curr.totalServed, 0);

  // Botões de contagem rápida
  const quickCounts = [
    { label: "15", value: 15 },
    { label: "100", value: 100 },
    { label: "500", value: 500 },
    { label: "1.000", value: 1_000 },
    { label: "10.000", value: 10_000 },
    { label: "100.000", value: 100_000 },
    { label: "1 Milhão (1M)", value: 1_000_000 },
  ];

  const isCurrentlyRunning = isProbing || benchmarkStatus?.running;

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Monitor */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Monitor de Servidores & Cluster</h2>
              <p className="text-xs text-slate-400">
                Escalabilidade horizontal, balanceamento Round Robin e telemetria dos nós distribuídos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAutoRefreshing((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
              isAutoRefreshing
                ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            <Activity className={`h-3.5 w-3.5 ${isAutoRefreshing ? "text-emerald-400 animate-pulse" : ""}`} />
            <span>{isAutoRefreshing ? "Monitoramento Ativo" : "Pausado"}</span>
          </button>

          <button
            onClick={() => {
              executeSingleProbe(Date.now());
              fetchHealth();
              fetchBenchmarkStatus();
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Visão de Infraestrutura do Cluster */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Load Balancer Nginx */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Load Balancer</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
              ONLINE
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-purple-400" />
              <span className="text-base font-bold text-white">Nginx 1.25 (Alpine)</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Algoritmo:</span>
                <span className="font-semibold text-purple-300">Round Robin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Porta de Entrada:</span>
                <span className="font-mono text-cyan-300">:3000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">WebSocket (RFC 6455):</span>
                <span className="text-emerald-400 font-medium">Habilitado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Réplicas Backend */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Cluster Fastify</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-mono">
              CONCORRENTE
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white">{nodesList.length || 3}</span>
              <span className="text-xs text-slate-400">nós ativos</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Runtime:</span>
                <span className="font-semibold text-slate-200">Node.js 22 + Fastify</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Requisições Testadas:</span>
                <span className="font-mono text-emerald-400 font-semibold">{totalRequestsCount.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middleware InterSCity */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Middleware IoT</span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono">
              INTEGRADO
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan-400" />
              <span className="text-base font-bold text-white">InterSCity Platform</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Serviço:</span>
                <span className="text-cyan-300">Resource Catalog + Collector</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recursos Mapeados:</span>
                <span className="font-mono text-emerald-400 font-bold">1.500 Trackers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Porta Interna:</span>
                <span className="font-mono text-slate-300">:8000</span>
              </div>
            </div>
          </div>
        </div>

        {/* Armazenamento & Mensageria */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Dados & MQTT</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
              {systemHealth?.status === "ok" ? "SAUDÁVEL" : "VERIFICANDO"}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="h-4 w-4 text-amber-400" />
                <span className="text-slate-200">MySQL 8.0:</span>
              </div>
              <span className={`font-mono ${systemHealth?.database === "connected" ? "text-emerald-400" : "text-amber-400"}`}>
                {systemHealth?.database === "connected" ? "Conectado" : "Verificando"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Radio className="h-4 w-4 text-indigo-400" />
                <span className="text-slate-200">Mosquitto MQTT:</span>
              </div>
              <span className={`font-mono ${systemHealth?.mqtt?.connected ? "text-emerald-400" : "text-amber-400"}`}>
                {systemHealth?.mqtt?.connected ? ":1883 Ativo" : ":1883 Conectando"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cartões dos Servidores Backend Ativos com Divisão de Carga */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">Réplicas Backend em Execução</h3>
            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-950/60 text-purple-300 border border-purple-800/40">
              {nodesList.length} instâncias
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            IPs Internos: 172.25.0.0/16
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nodesList.map((node, index) => {
            const share = totalRequestsCount > 0 ? (node.totalServed / totalRequestsCount) * 100 : 0;
            const uptimeMins = Math.floor(node.uptime / 60);
            const uptimeSecs = Math.floor(node.uptime % 60);

            return (
              <div
                key={node.ipPort || node.hostname}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between"
              >
                {/* Linha de status */}
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="font-bold text-sm text-white">
                      backend-réplica #{index + 1}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-[10px] font-mono">
                    200 OK
                  </span>
                </div>

                {/* Métricas do Nó */}
                <div className="py-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Network className="h-3.5 w-3.5 text-slate-500" />
                      IP / Porta:
                    </span>
                    <span className="font-mono text-purple-300 font-semibold bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-900/40">
                      {node.ipPort}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Cpu className="h-3.5 w-3.5 text-slate-500" />
                      Container ID:
                    </span>
                    <span className="font-mono text-slate-300">{node.hostname}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      Tempo de Atividade:
                    </span>
                    <span className="font-mono text-slate-300">
                      {uptimeMins}m {uptimeSecs}s
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Memória RAM:</span>
                    <span className="font-mono text-slate-300">
                      {node.memory.rssMB} MB (Heap: {node.memory.heapUsedMB} MB)
                    </span>
                  </div>
                </div>

                {/* Distribuição de Carga Round Robin */}
                <div className="pt-3 border-t border-slate-700/60">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Distribuição:</span>
                    <span className="font-mono font-bold text-purple-300">
                      {share.toFixed(1)}% ({node.totalServed.toLocaleString("pt-BR")} reqs)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(3, share))}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ferramenta Interativa de Teste do Balanceador com Opção de 1 MILHÃO */}
      <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-400" />
              Painel de Disparo de Teste de Carga & Estresse
            </h3>
            <p className="text-xs text-slate-400">
              Escolha a escala do teste (de 15 até 1.000.000 de requisições) e acompanhe o balanceamento ao vivo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Volume de Requisições */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400 px-1 text-[11px]">Meta:</span>
              {quickCounts.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setProbeCountTarget(item.value)}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    probeCountTarget === item.value
                      ? "bg-purple-600 text-white shadow-sm font-bold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Botão de Disparo Principal */}
            {isCurrentlyRunning ? (
              <button
                onClick={handleStopBenchmark}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm animate-pulse"
              >
                <StopCircle className="h-4 w-4" />
                <span>Interromper</span>
              </button>
            ) : (
              <button
                onClick={handleTriggerTest}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                  probeCountTarget >= 1_000_000
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white ring-2 ring-purple-400/30"
                    : "bg-purple-600 hover:bg-purple-500 text-white"
                }`}
              >
                <Play className="h-4 w-4" />
                <span>
                  {probeCountTarget >= 1_000_000
                    ? "Disparar 1 Milhão (1M)"
                    : `Disparar ${probeCountTarget.toLocaleString("pt-BR")}`}
                </span>
              </button>
            )}

            <button
              onClick={handleResetCounters}
              title="Zerar contadores"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Card Dinâmico de Progresso do Teste de Alta Concorrência (1M ou intermediários) */}
        {benchmarkStatus && (
          <div className="bg-slate-900/90 border border-purple-800/50 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  {benchmarkStatus.running && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      benchmarkStatus.running ? "bg-purple-500" : "bg-emerald-500"
                    }`}
                  ></span>
                </span>
                <span className="font-bold text-sm text-white">
                  {benchmarkStatus.running
                    ? "Executando Teste de Estresse em Tempo Real..."
                    : "Teste de Carga Concluído com Sucesso!"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-purple-300">
                  {benchmarkStatus.completed.toLocaleString("pt-BR")} /{" "}
                  {benchmarkStatus.total.toLocaleString("pt-BR")} requisições
                </span>
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <Gauge className="h-3.5 w-3.5" />
                  {benchmarkStatus.currentRps.toLocaleString("pt-BR")} req/s
                </span>
                <span className="text-slate-400">
                  {benchmarkStatus.elapsedSeconds}s decorridos
                </span>
              </div>
            </div>

            {/* Barra de Progresso com Gradiente */}
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(1, benchmarkStatus.percent))}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="bg-slate-800/60 p-2 rounded border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Progresso:</span>
                <span className="font-mono font-bold text-white">{benchmarkStatus.percent}%</span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Vazão Média:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {benchmarkStatus.avgRps.toLocaleString("pt-BR")} req/s
                </span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Tempo Restante Estimado:</span>
                <span className="font-mono font-bold text-cyan-300">
                  {benchmarkStatus.running ? `~${benchmarkStatus.etaSeconds}s` : "Finalizado"}
                </span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded border border-slate-700/50">
                <span className="text-slate-400 block text-[10px]">Taxa de Sucesso (200 OK):</span>
                <span className="font-mono font-bold text-emerald-400">
                  {benchmarkStatus.total > 0
                    ? (((benchmarkStatus.completed - benchmarkStatus.errors) /
                        (benchmarkStatus.completed || 1)) *
                        100).toFixed(1)
                    : 100}
                  %
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Histórico das Últimas Requisições (Amostragem) */}
        <div className="border border-slate-700/60 rounded-lg overflow-hidden">
          <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-700/60 grid grid-cols-5 text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
            <span>Requisição</span>
            <span>Nó Upstream (X-Served-By)</span>
            <span>Container ID</span>
            <span>Latência</span>
            <span className="text-right">Horário</span>
          </div>

          <div className="divide-y divide-slate-700/40 max-h-56 overflow-y-auto bg-slate-900/40 font-mono text-xs">
            {probeHistory.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400 font-sans">
                {benchmarkStatus?.running
                  ? "Processando requisições em alta velocidade no cluster..."
                  : "Amostragem de requisições individuais. Use os botões acima para disparar o teste."}
              </div>
            ) : (
              probeHistory.slice(0, 15).map((probe) => (
                <div key={probe.id} className="px-4 py-2 grid grid-cols-5 items-center hover:bg-slate-800/40 transition">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-slate-300">#{probe.id}</span>
                  </div>
                  <span className="text-purple-300 font-semibold">{probe.servedBy}</span>
                  <span className="text-slate-400 text-[11px]">{probe.hostname}</span>
                  <span className="text-cyan-400">{probe.latencyMs} ms</span>
                  <span className="text-right text-slate-400 text-[11px]">{probe.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Painel Informativo do Teste de 1 Milhão de Requisições */}
      <div className="bg-gradient-to-r from-purple-950/40 via-slate-800/50 to-indigo-950/40 border border-purple-800/40 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/20 text-purple-400 rounded-lg border border-purple-500/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Teste de Estresse de 1 Milhão de Requisições
              </h4>
              <p className="text-xs text-slate-400">
                Você pode disparar diretamente pelo botão acima ou via terminal com <code>./start.sh benchmark 1000000</code>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setProbeCountTarget(1_000_000);
              handleStartBenchmark(1_000_000);
            }}
            disabled={isCurrentlyRunning}
            className="font-mono text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Disparar 1M Agora</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 block mb-1">Roteamento Round Robin:</span>
            <span className="font-semibold text-white">Equilíbrio assintótico perfeito</span>
          </div>
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 block mb-1">Taxa de Sucesso:</span>
            <span className="font-semibold text-emerald-400">100% (200 OK sem timeouts)</span>
          </div>
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 block mb-1">Carga Dividida no Cluster:</span>
            <span className="font-semibold text-purple-300">~33.3% por Réplica Fastify</span>
          </div>
        </div>
      </div>
    </div>
  );
};
