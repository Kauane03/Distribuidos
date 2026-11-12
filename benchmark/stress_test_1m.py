#!/usr/bin/env python3
"""
==============================================================================
🚀 PET TRACKER DISTRIBUÍDO - TESTE DE CARGA DE 1 MILHÃO DE REQUISIÇÕES (PYTHON)
==============================================================================
Disciplina: Sistemas Distribuídos - UFMA
Objetivo: Benchmark concorrente via Python multi-threading/pools para avaliar
          a distribuição de carga Round Robin e throughput do cluster.
==============================================================================
"""

import sys
import time
import urllib.request
import concurrent.futures
from collections import defaultdict
import json
import os

TOTAL_REQUESTS = int(sys.argv[1]) if len(sys.argv) > 1 else 100_000
CONCURRENCY = int(sys.argv[2]) if len(sys.argv) > 2 else 50
TARGET_URL = sys.argv[3] if len(sys.argv) > 3 else "http://localhost:3000/api/cluster/probe"

def make_request(opener):
    try:
        req = urllib.request.Request(TARGET_URL, headers={"Connection": "keep-alive"})
        with opener.open(req, timeout=10) as res:
            served_by = res.headers.get("X-Served-By", "unknown")
            _ = res.read() # consome corpo
            return served_by, True
    except Exception as e:
        return "error", False

def main():
    print("=" * 66)
    print(f"🔥 INICIANDO BENCHMARK PYTHON: {TOTAL_REQUESTS:,} REQUISIÇÕES 🔥")
    print("=" * 66)
    print(f"🎯 Alvo        : {TARGET_URL}")
    print(f"🔌 Concorrência: {CONCURRENCY} workers")
    print("=" * 66)

    # Reutilização de conexões HTTP via opener padrão
    opener = urllib.request.build_opener()

    distribution = defaultdict(int)
    completed = 0
    errors = 0
    start_time = time.time()
    last_time = start_time
    last_completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        # Envia em batches para não estourar memória com 1M futures
        batch_size = min(TOTAL_REQUESTS, 50_000)
        remaining = TOTAL_REQUESTS

        while remaining > 0:
            current_batch = min(remaining, batch_size)
            futures = [executor.submit(make_request, opener) for _ in range(current_batch)]

            for f in concurrent.futures.as_completed(futures):
                server, success = f.result()
                if success:
                    distribution[server] += 1
                else:
                    errors += 1
                completed += 1

                now = time.time()
                if now - last_time >= 1.0:
                    elapsed = now - start_time
                    interval = now - last_time
                    current_rps = int((completed - last_completed) / interval)
                    percent = (completed / TOTAL_REQUESTS) * 100
                    print(f"Progresso: {percent:.1f}% ({completed:,}/{TOTAL_REQUESTS:,}) | Vazão: {current_rps:,} req/s")
                    last_time = now
                    last_completed = completed

            remaining -= current_batch

    total_time = time.time() - start_time
    avg_rps = int(completed / total_time) if total_time > 0 else 0

    print("\n" + "=" * 66)
    print("🏆 RESULTADO DO TESTE (PYTHON) 🏆")
    print("=" * 66)
    print(f"⏱️  Tempo Total : {total_time:.2f}s")
    print(f"🚀 Vazão Média : {avg_rps:,} req/s")
    print(f"✅ Sucesso     : {completed - errors:,}")
    print(f"❌ Erros       : {errors:,}")
    print("-" * 66)
    print("⚖️  Distribuição de Carga Round Robin:")
    for srv, count in sorted(distribution.items(), key=lambda x: x[1], reverse=True):
        share = (count / (completed - errors or 1)) * 100
        print(f"   👉 {srv:22} : {count:,} ({share:.2f}%)")
    print("=" * 66)

if __name__ == "__main__":
    main()

