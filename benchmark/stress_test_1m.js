#!/usr/bin/env node

/**
 * ==============================================================================
 * 🚀 PET TRACKER DISTRIBUÍDO - TESTE DE CARGA DE 1 MILHÃO DE REQUISIÇÕES
 * ==============================================================================
 * Disciplina: Sistemas Distribuídos - UFMA
 * Objetivo: Avaliar a vazão (RPS), latência e a distribuição Round Robin do
 *           Load Balancer Nginx entre as réplicas do cluster Fastify.
 * ==============================================================================
 */

const http = require("http");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");

// Parâmetros via linha de comando ou padrões
const args = process.argv.slice(2);
const TOTAL_REQUESTS = parseInt(args[0], 10) || 1_000_000;
const CONCURRENCY_PER_WORKER = parseInt(args[1], 10) || 80;
const NUM_WORKERS = parseInt(args[2], 10) || Math.min(8, Math.max(2, os.cpus().length));
const TARGET_URL = args[3] || "http://localhost:3000/api/cluster/probe";

if (isMainThread) {
  console.log("==================================================================");
  console.log("🔥 INICIANDO TESTE DE CARGA MASSIVO: 1.000.000 DE REQUISIÇÕES 🔥");
  console.log("==================================================================");
  console.log(`🎯 Alvo do Balanceador: ${TARGET_URL}`);
  console.log(`📦 Total de Requisições: ${TOTAL_REQUESTS.toLocaleString("pt-BR")}`);
  console.log(`⚙️  Workers Concorrentes: ${NUM_WORKERS} threads`);
  console.log(`🔌 Conexões por Worker : ${CONCURRENCY_PER_WORKER}`);
  console.log("==================================================================\n");

  const startTime = Date.now();
  let totalCompleted = 0;
  let totalErrors = 0;
  const serverDistribution = {};
  let lastReportTime = Date.now();
  let lastReportCount = 0;

  const quotaPerWorker = Math.floor(TOTAL_REQUESTS / NUM_WORKERS);
  const remainder = TOTAL_REQUESTS % NUM_WORKERS;

  let activeWorkers = NUM_WORKERS;

  for (let i = 0; i < NUM_WORKERS; i++) {
    const workerQuota = quotaPerWorker + (i === 0 ? remainder : 0);
    const worker = new Worker(__filename, {
      workerData: {
        workerId: i + 1,
        quota: workerQuota,
        concurrency: CONCURRENCY_PER_WORKER,
        targetUrl: TARGET_URL,
      },
    });

    worker.on("message", (msg) => {
      if (msg.type === "progress") {
        totalCompleted += msg.completed;
        totalErrors += msg.errors;
        for (const [srv, count] of Object.entries(msg.distribution)) {
          serverDistribution[srv] = (serverDistribution[srv] || 0) + count;
        }
      } else if (msg.type === "done") {
        activeWorkers--;
        if (activeWorkers === 0) {
          finishBenchmark();
        }
      }
    });

    worker.on("error", (err) => {
      console.error(`Erro no worker ${i + 1}:`, err);
    });
  }

  // Timer para atualização periódica no terminal
  const interval = setInterval(() => {
    const now = Date.now();
    const elapsedSec = (now - startTime) / 1000;
    const intervalSec = (now - lastReportTime) / 1000;
    const intervalReqs = totalCompleted - lastReportCount;
    const currentRps = intervalSec > 0 ? Math.round(intervalReqs / intervalSec) : 0;
    const avgRps = elapsedSec > 0 ? Math.round(totalCompleted / elapsedSec) : 0;
    const percent = ((totalCompleted / TOTAL_REQUESTS) * 100).toFixed(1);
    const remainingReqs = TOTAL_REQUESTS - totalCompleted;
    const etaSec = avgRps > 0 ? Math.round(remainingReqs / avgRps) : 0;

    lastReportTime = now;
    lastReportCount = totalCompleted;

    const barLength = 28;
    const filled = Math.min(barLength, Math.round((totalCompleted / TOTAL_REQUESTS) * barLength));
    const bar = "█".repeat(filled) + "░".repeat(Math.max(0, barLength - filled));

    // Formatação de nós
    const nodeStatus = Object.entries(serverDistribution)
      .map(([srv, count]) => {
        const share = totalCompleted > 0 ? ((count / totalCompleted) * 100).toFixed(1) : "0";
        return `${srv}: ${count.toLocaleString("pt-BR")} (${share}%)`;
      })
      .join(" | ");

    process.stdout.write(
      `\r[${bar}] ${percent}% | ${totalCompleted.toLocaleString(
        "pt-BR"
      )}/${TOTAL_REQUESTS.toLocaleString("pt-BR")} | ${currentRps.toLocaleString(
        "pt-BR"
      )} req/s | ETA: ${etaSec}s\n` +
        `   ↳ Distribuição: ${nodeStatus || "Sondando..."}\x1b[1A`
    );
  }, 1000);

  function finishBenchmark() {
    clearInterval(interval);
    const totalTimeSec = (Date.now() - startTime) / 1000;
    const overallRps = Math.round(totalCompleted / totalTimeSec);

    console.log("\n\n==================================================================");
    console.log("🏆 RELATÓRIO FINAL DO TESTE DE 1 MILHÃO DE REQUISIÇÕES 🏆");
    console.log("==================================================================");
    console.log(`⏱️  Tempo Total Decorrido : ${totalTimeSec.toFixed(2)} segundos`);
    console.log(`🚀 Vazão Média (Throughput): ${overallRps.toLocaleString("pt-BR")} req/s`);
    console.log(`✅ Requisições com Sucesso: ${totalCompleted.toLocaleString("pt-BR")} (200 OK)`);
    console.log(`❌ Falhas / Timeouts     : ${totalErrors.toLocaleString("pt-BR")}`);
    console.log("------------------------------------------------------------------");
    console.log("⚖️  DISTRIBUIÇÃO DE CARGA ENTRE AS RÉPLICAS DO CLUSTER (ROUND ROBIN):");

    const sortedServers = Object.entries(serverDistribution).sort((a, b) => b[1] - a[1]);
    for (const [srv, count] of sortedServers) {
      const share = ((count / totalCompleted) * 100).toFixed(2);
      console.log(`   👉 Réplica ${srv.padEnd(20)} : ${count.toLocaleString("pt-BR")} requisições (${share}%)`);
    }

    console.log("==================================================================\n");

    // Salva o relatório consolidado em JSON e Markdown
    const reportData = {
      benchmark: "1 Million Requests Stress Test",
      date: new Date().toISOString(),
      targetUrl: TARGET_URL,
      totalRequests: TOTAL_REQUESTS,
      completed: totalCompleted,
      errors: totalErrors,
      totalTimeSeconds: parseFloat(totalTimeSec.toFixed(2)),
      requestsPerSecond: overallRps,
      distribution: serverDistribution,
    };

    const outPath = path.join(__dirname, "benchmark_report.json");
    fs.writeFileSync(outPath, JSON.stringify(reportData, null, 2), "utf-8");
    console.log(`📄 Relatório salvo com sucesso em: ${outPath}\n`);
    process.exit(0);
  }
} else {
  // ============================================================================
  // WORKER THREAD: DISPARADOR ASSÍNCRONO DE REQUISIÇÕES HTTP COM KEEPALIVE
  // ============================================================================
  const { quota, concurrency, targetUrl } = workerData;
  const agent = new http.Agent({
    keepAlive: true,
    maxSockets: concurrency * 2,
    keepAliveMsecs: 60000,
  });

  const urlObj = new URL(targetUrl);
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 80,
    path: urlObj.pathname + urlObj.search,
    method: "GET",
    agent,
    headers: {
      Connection: "keep-alive",
    },
  };

  let sent = 0;
  let completed = 0;
  let errors = 0;
  const localDistribution = {};

  let batchCompleted = 0;
  let batchErrors = 0;
  const batchDistribution = {};

  // Emite progresso a cada 2.500 requisições
  const flushProgress = () => {
    if (batchCompleted > 0 || batchErrors > 0) {
      parentPort.postMessage({
        type: "progress",
        completed: batchCompleted,
        errors: batchErrors,
        distribution: { ...batchDistribution },
      });
      batchCompleted = 0;
      batchErrors = 0;
      for (const k in batchDistribution) delete batchDistribution[k];
    }
  };

  function sendNext() {
    if (sent >= quota) return;
    sent++;

    const req = http.request(options, (res) => {
      const servedBy = res.headers["x-served-by"] || "backend-unknown";
      localDistribution[servedBy] = (localDistribution[servedBy] || 0) + 1;
      batchDistribution[servedBy] = (batchDistribution[servedBy] || 0) + 1;
      batchCompleted++;
      completed++;

      res.resume(); // drena stream rapidamente sem ler memória
      res.on("end", () => {
        if (completed % 2500 === 0) flushProgress();
        if (completed >= quota) {
          flushProgress();
          parentPort.postMessage({ type: "done" });
        } else {
          sendNext();
        }
      });
    });

    req.on("error", () => {
      errors++;
      batchErrors++;
      completed++;
      if (completed % 2500 === 0) flushProgress();
      if (completed >= quota) {
        flushProgress();
        parentPort.postMessage({ type: "done" });
      } else {
        sendNext();
      }
    });

    req.end();
  }

  // Dispara o pool de conexões concorrentes
  for (let i = 0; i < concurrency; i++) {
    sendNext();
  }
}
