#!/usr/bin/env python3
"""
Orquestrador de Simuladores de Dispositivos (Sticks e Trackers)
Disciplina: Sistemas Distribuídos - UFMA
"""

import argparse
import logging
import os
import signal
import sys
import threading
import time
from typing import List

# Permite imports relativos a partir da raiz do simulador
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulators.tracker.tracker_sim import TrackerSimulator
from simulators.stick.stick_sim import StickSimulator
from simulators.common.geo import UFMA_CAMPUS_LAT, UFMA_CAMPUS_LON

# Configuração de Logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("SimOrchestrator")

def parse_args():
    parser = argparse.ArgumentParser(
        description="Simulador Distribuído de Dispositivos IoT para Rastreamento de Pets (UFMA)"
    )
    parser.add_argument(
        "--host",
        default=os.getenv("MQTT_HOST", "localhost"),
        help="Endereço do broker MQTT (padrão: localhost)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("MQTT_PORT", 1883)),
        help="Porta do broker MQTT (padrão: 1883)"
    )
    parser.add_argument(
        "--trackers",
        default="TRK_DOG_01,TRK_DOG_02,TRK_CAT_03",
        help="Lista de referências de Trackers separadas por vírgula"
    )
    parser.add_argument(
        "--sticks",
        default="STICK_CCET_UFMA,STICK_BIBLIOTECA",
        help="Lista de referências de Sticks separadas por vírgula"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=3.0,
        help="Intervalo de envio de telemetria dos trackers em segundos (padrão: 3.0)"
    )
    return parser.parse_args()

def main():
    args = parse_args()

    print("\n" + "=" * 65)
    print("🐾 SIMULADOR DISTRIBUÍDO DE DISPOSITIVOS - PET TRACKER (UFMA) 🐾")
    print(f"📡 Broker MQTT : {args.host}:{args.port}")
    print(f"⏱️  Intervalo   : {args.interval}s")
    print("=" * 65 + "\n")

    tracker_refs = [t.strip() for t in args.trackers.split(",") if t.strip()]
    stick_refs = [s.strip() for s in args.sticks.split(",") if s.strip()]

    simulators = []
    threads = []
    stop_event = threading.Event()

    # 1. Instancia Sticks (Gateways)
    primary_stick = stick_refs[0] if stick_refs else "STICK_DEFAULT"
    for s_ref in stick_refs:
        stick_sim = StickSimulator(
            stick_ref=s_ref,
            broker_host=args.host,
            broker_port=args.port,
            interval_seconds=10.0
        )
        simulators.append(stick_sim)

    # 2. Instancia Trackers (Coleiras de Pets)
    for i, t_ref in enumerate(tracker_refs):
        # Pequeno deslocamento inicial no mapa para espalhar os pets pelo campus
        lat_offset = (i - 1) * 0.0006
        lon_offset = (i - 1) * 0.0004

        tracker_sim = TrackerSimulator(
            tracker_ref=t_ref,
            broker_host=args.host,
            broker_port=args.port,
            stick_ref=primary_stick,
            center_lat=UFMA_CAMPUS_LAT + lat_offset,
            center_lon=UFMA_CAMPUS_LON + lon_offset,
            interval_seconds=args.interval
        )
        simulators.append(tracker_sim)

    # Inicia todos os dispositivos
    logger.info(f"Iniciando {len(stick_refs)} Sticks e {len(tracker_refs)} Trackers...")

    for sim in simulators:
        sim.start()

    # Loop de ticks por dispositivo em threads dedicadas ou loop cooperativo
    def worker_loop(sim):
        # Pequeno atraso escalonado para evitar pico instantâneo de pacotes
        time.sleep(simulators.index(sim) * 0.4)
        while not stop_event.is_set():
            try:
                sim.tick()
            except Exception as e:
                logger.error(f"Erro no dispositivo {getattr(sim, 'tracker_ref', getattr(sim, 'stick_ref', 'dev'))}: {e}")
            stop_event.wait(timeout=sim.interval_seconds)

    for sim in simulators:
        t = threading.Thread(target=worker_loop, args=(sim,), daemon=True)
        threads.append(t)
        t.start()

    logger.info("Todos os dispositivos simulados estão operando e transmitindo via MQTT!")
    logger.info("Pressione Ctrl+C para encerrar os simuladores.\n")

    # Tratamento de finalização graciosa
    def handle_exit(signum, frame):
        logger.info("\nEncerrando simuladores graciosamente...")
        stop_event.set()
        for sim in simulators:
            sim.stop()
        logger.info("Todos os simuladores foram desconectados do broker MQTT.")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    # Mantém a thread principal ativa
    while not stop_event.is_set():
        time.sleep(1)

if __name__ == "__main__":
    main()
