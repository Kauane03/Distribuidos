#!/usr/bin/env python3
"""
Orquestrador de Simuladores IoT para Teste de Carga (500 Pets Virtuais)
Disciplina: Sistemas Distribuídos - UFMA
Projeto: Pet Tracker

Instancia 500 trackers virtuais (TRK_VIRTUAL_001 a 500) e envia telemetria
concorrente via HTTP POST para o Data Collector da plataforma InterSCity.
"""

import argparse
import json
import logging
import os
import signal
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict

# Permite imports relativos a partir da raiz do projeto
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, PROJECT_ROOT)

import requests
from requests.adapters import HTTPAdapter

from simulators.tracker.tracker_sim import TrackerSimulator
from simulators.common.geo import UFMA_CAMPUS_LAT, UFMA_CAMPUS_LON, get_sao_luis_coordinates
from simulators.seed_interscity import seed_resources

# Configuração de Logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SimOrchestrator] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("SimOrchestrator")

RESOURCES_FILE = os.path.join(BASE_DIR, "interscity_resources.json")

def load_or_generate_uuids(count: int) -> Dict[str, str]:
    """
    Carrega o mapeamento de UUIDs gerado pelo script seed_interscity.
    Caso o arquivo não exista, executa o seed automaticamente.
    """
    mapping: Dict[str, str] = {}
    if not os.path.exists(RESOURCES_FILE):
        logger.info(f"Arquivo {RESOURCES_FILE} não encontrado. Executando seed automático de {count} recursos...")
        try:
            seed_resources(count)
        except Exception as err:
            logger.warning(f"Seed automático encontrou aviso: {err}")

    if os.path.exists(RESOURCES_FILE):
        try:
            with open(RESOURCES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("uuid_by_tracker", {})
                logger.info(f"Carregados {len(mapping)} UUIDs de {RESOURCES_FILE}")
        except Exception as e:
            logger.warning(f"Não foi possível ler {RESOURCES_FILE}: {e}")

    # Garante que todos os trackers de 1 a count possuam UUID
    namespace = uuid.NAMESPACE_DNS
    for i in range(1, count + 1):
        ref = f"TRK_VIRTUAL_{i:03d}"
        if ref not in mapping:
            mapping[ref] = str(uuid.uuid5(namespace, f"pawsition.{ref}"))

    return mapping

def parse_args():
    parser = argparse.ArgumentParser(
        description="Teste de Carga IoT: 500 Pets Virtuais no InterSCity (UFMA - Pet Tracker)"
    )
    parser.add_argument(
        "--interscity",
        default=os.getenv("INTERSCITY_URL", "http://interscity:8000"),
        help="URL base do middleware InterSCity (padrão: http://interscity:8000)"
    )
    parser.add_argument(
        "--count",
        type=int,
        default=int(os.getenv("TOTAL_TRACKERS", "1500")),
        help="Quantidade de pets virtuais a serem simulados (padrão: 1500)"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=3.0,
        help="Intervalo de telemetria de cada tracker em segundos (padrão: 3.0s)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=30,
        help="Número de threads no pool HTTP (padrão: 30)"
    )
    # Argumentos legados aceitos para retrocompatibilidade
    parser.add_argument("--host", default="mosquitto", help=argparse.SUPPRESS)
    parser.add_argument("--port", type=int, default=1883, help=argparse.SUPPRESS)
    parser.add_argument("--trackers", default="", help=argparse.SUPPRESS)
    parser.add_argument("--sticks", default="", help=argparse.SUPPRESS)
    return parser.parse_args()

def main():
    args = parse_args()
    total_pets = args.count
    interscity_url = args.interscity.rstrip("/")

    print("\n" + "=" * 70)
    print("🐾 PET TRACKER - TESTE DE CARGA IoT (SISTEMAS DISTRIBUÍDOS - UFMA) 🐾")
    print(f"🎯 Total de Pets Virtuais : {total_pets} coleiras (TRK_VIRTUAL_001 a {total_pets:03d})")
    print(f"🌐 Middleware InterSCity  : {interscity_url}")
    print(f"⏱️  Intervalo de Envio     : {args.interval}s por dispositivo")
    print(f"🧵 Pool de Threads HTTP   : {args.workers} workers concorrentes")
    print("=" * 70 + "\n")

    # 1. Carrega mapeamento de UUIDs
    uuid_map = load_or_generate_uuids(total_pets)

    # 2. Instancia os simuladores de trackers em loop distribuídos por São Luís
    simulators: List[TrackerSimulator] = []
    for i in range(1, total_pets + 1):
        ref = f"TRK_VIRTUAL_{i:03d}"
        res_uuid = uuid_map[ref]

        # Distribuição geográfica ampla em São Luís (30 bairros diferentes)
        lat, lon, bairro = get_sao_luis_coordinates(i)

        sim = TrackerSimulator(
            tracker_ref=ref,
            resource_uuid=res_uuid,
            interscity_url=interscity_url,
            stick_ref="STICK_CENTRO_HISTORICO" if i % 2 == 0 else "STICK_CCET_UFMA",
            start_lat=lat,
            start_lon=lon,
            interval_seconds=args.interval
        )
        sim.start()
        simulators.append(sim)

    logger.info(f"{len(simulators)} rastreadores virtuais prontos para envio de telemetria.")

    # 3. Configuração de sessão HTTP com connection pooling de alta performance
    session = requests.Session()
    adapter = HTTPAdapter(
        pool_connections=args.workers,
        pool_maxsize=args.workers * 2,
        max_retries=1
    )
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    stop_event = threading.Event()

    def handle_exit(signum, frame):
        logger.info("\nEncerrando teste de carga...")
        stop_event.set()

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    # 4. Loop de carga distribuído: executa os ciclos de telemetria
    executor = ThreadPoolExecutor(max_workers=args.workers)
    cycle_count = 0

    try:
        while not stop_event.is_set():
            cycle_start = time.time()
            cycle_count += 1

            # Dispara os 500 ticks concorrentemente no thread pool
            futures = [
                executor.submit(sim.tick, session)
                for sim in simulators
            ]

            success_count = sum(1 for f in futures if f.result())
            elapsed = time.time() - cycle_start
            rate = round(total_pets / max(elapsed, 0.001), 1)

            logger.info(
                f"[Ciclo #{cycle_count:03d}] {success_count}/{total_pets} telemetrias enviadas "
                f"em {elapsed:.2f}s (~{rate} req/s para InterSCity Data Collector)"
            )

            # Aguarda o intervalo restante respeitando o tempo de envio
            sleep_time = max(0.0, args.interval - elapsed)
            if stop_event.wait(timeout=sleep_time):
                break

    finally:
        executor.shutdown(wait=False)
        session.close()
        logger.info("Teste de carga finalizado.")

if __name__ == "__main__":
    main()
