import http from "node:http";
import { pool } from "../../infrastructure/database/index.js";
import { wsManager } from "../../infrastructure/websocket/index.js";

export interface BenchmarkState {
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

class BenchmarkService {
  private state: BenchmarkState = {
    running: false,
    total: 1_000_000,
    completed: 0,
    errors: 0,
    currentRps: 0,
    avgRps: 0,
    elapsedSeconds: 0,
    etaSeconds: 0,
    percent: 0,
    distribution: {},
    targetUrl: "http://loadbalancer:3000/api/cluster/probe",
  };

  private shouldStop = false;
  private progressInterval: NodeJS.Timeout | null = null;
  private tableInitialized = false;

  private async ensureTables() {
    if (this.tableInitialized) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cluster_benchmark (
          id INT PRIMARY KEY,
          state JSON,
          updated_at BIGINT
        ) ENGINE=InnoDB;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cluster_benchmark_control (
          id INT PRIMARY KEY,
          should_stop TINYINT DEFAULT 0
        ) ENGINE=InnoDB;
      `);
      this.tableInitialized = true;
    } catch (e) {
      console.warn("[Benchmark] Erro ao inicializar tabelas distribuídas:", e);
    }
  }

  public async getState(): Promise<BenchmarkState> {
    await this.ensureTables();
    try {
      const [rows]: any = await pool.query("SELECT state FROM cluster_benchmark WHERE id = 1");
      if (rows && rows.length > 0 && rows[0].state) {
        const parsed = typeof rows[0].state === "string" ? JSON.parse(rows[0].state) : rows[0].state;
        return parsed;
      }
    } catch {
      // fallback
    }
    return { ...this.state, distribution: { ...this.state.distribution } };
  }

  public async stop() {
    await this.ensureTables();
    this.shouldStop = true;
    this.state.running = false;
    this.state.finishedAt = new Date().toISOString();

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    try {
      await pool.query("REPLACE INTO cluster_benchmark_control (id, should_stop) VALUES (1, 1)");
      await pool.query("REPLACE INTO cluster_benchmark (id, state, updated_at) VALUES (1, ?, ?)", [
        JSON.stringify(this.state),
        Date.now(),
      ]);
    } catch {}

    wsManager.broadcast("BENCHMARK_STATUS", this.state);
  }

  public async start(total = 1_000_000, concurrency = 120, targetUrl = "http://loadbalancer:3000/api/cluster/probe") {
    await this.ensureTables();
    const currentState = await this.getState();
    if (currentState.running) {
      throw new Error("Um teste de estresse já está em execução no cluster.");
    }

    this.shouldStop = false;
    await pool.query("REPLACE INTO cluster_benchmark_control (id, should_stop) VALUES (1, 0)");

    this.state = {
      running: true,
      total,
      completed: 0,
      errors: 0,
      currentRps: 0,
      avgRps: 0,
      elapsedSeconds: 0,
      etaSeconds: 0,
      percent: 0,
      distribution: {},
      targetUrl,
    };

    // Salva estado inicial compartilhado no MySQL
    await pool.query("REPLACE INTO cluster_benchmark (id, state, updated_at) VALUES (1, ?, ?)", [
      JSON.stringify(this.state),
      Date.now(),
    ]);

    const startTime = Date.now();
    let lastReportTime = startTime;
    let lastReportCompleted = 0;

    // Atualização periódica do estado compartilhado e broadcast WebSocket
    this.progressInterval = setInterval(async () => {
      const now = Date.now();
      const elapsedSec = (now - startTime) / 1000;
      const intervalSec = (now - lastReportTime) / 1000;
      const intervalReqs = this.state.completed - lastReportCompleted;

      this.state.elapsedSeconds = parseFloat(elapsedSec.toFixed(1));
      this.state.currentRps = intervalSec > 0 ? Math.round(intervalReqs / intervalSec) : 0;
      this.state.avgRps = elapsedSec > 0 ? Math.round(this.state.completed / elapsedSec) : 0;
      this.state.percent = parseFloat(((this.state.completed / this.state.total) * 100).toFixed(1));

      const remainingReqs = this.state.total - this.state.completed;
      this.state.etaSeconds = this.state.avgRps > 0 ? Math.round(remainingReqs / this.state.avgRps) : 0;

      lastReportTime = now;
      lastReportCompleted = this.state.completed;

      // Verifica sinal de parada externo gravado por outra réplica
      try {
        const [ctrl]: any = await pool.query("SELECT should_stop FROM cluster_benchmark_control WHERE id = 1");
        if (ctrl && ctrl.length > 0 && ctrl[0].should_stop === 1) {
          this.shouldStop = true;
        }
      } catch {}

      // Persiste no MySQL compartilhado
      try {
        await pool.query("REPLACE INTO cluster_benchmark (id, state, updated_at) VALUES (1, ?, ?)", [
          JSON.stringify(this.state),
          now,
        ]);
      } catch {}

      wsManager.broadcast("BENCHMARK_PROGRESS", this.state);
    }, 300);

    // Agente HTTP nativo com keepalive para vazão máxima
    const agent = new http.Agent({
      keepAlive: true,
      maxSockets: concurrency * 2,
      keepAliveMsecs: 60000,
    });

    const parsedUrl = new URL(targetUrl);
    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      agent,
      headers: {
        Connection: "keep-alive",
      },
    };

    let sent = 0;

    const runWorker = (): Promise<void> => {
      return new Promise<void>((resolve) => {
        const next = () => {
          if (this.shouldStop || sent >= total) {
            resolve();
            return;
          }

          sent++;
          const req = http.request(options, (res) => {
            const servedBy = (res.headers["x-served-by"] as string) || "backend-node";
            this.state.distribution[servedBy] = (this.state.distribution[servedBy] || 0) + 1;
            this.state.completed++;

            res.resume();
            res.on("end", () => {
              if (this.state.completed >= total || this.shouldStop) {
                resolve();
              } else {
                next();
              }
            });
          });

          req.on("error", () => {
            this.state.errors++;
            this.state.completed++;
            if (this.state.completed >= total || this.shouldStop) {
              resolve();
            } else {
              next();
            }
          });

          req.end();
        };

        next();
      });
    };

    // Dispara pool concorrente
    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(runWorker());
    }

    Promise.all(workers)
      .then(() => {
        this.finish(startTime);
      })
      .catch((err) => {
        console.error("[Benchmark] Erro na execução:", err);
        this.stop();
      });

    return this.state;
  }

  private async finish(startTime: number) {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    const totalTimeSec = (Date.now() - startTime) / 1000;
    this.state.running = false;
    this.state.elapsedSeconds = parseFloat(totalTimeSec.toFixed(2));
    this.state.avgRps = totalTimeSec > 0 ? Math.round(this.state.completed / totalTimeSec) : 0;
    this.state.percent = 100;
    this.state.etaSeconds = 0;
    this.state.finishedAt = new Date().toISOString();

    try {
      await pool.query("REPLACE INTO cluster_benchmark (id, state, updated_at) VALUES (1, ?, ?)", [
        JSON.stringify(this.state),
        Date.now(),
      ]);
    } catch {}

    wsManager.broadcast("BENCHMARK_COMPLETED", this.state);
  }
}

export const benchmarkService = new BenchmarkService();
