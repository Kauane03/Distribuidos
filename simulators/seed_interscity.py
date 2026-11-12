#!/usr/bin/env python3
"""
Script de Setup e Carga: Registro de 500 Recursos no InterSCity Catalog
Disciplina: Sistemas Distribuídos - UFMA
Projeto: Pet Tracker

Registra automaticamente 500 Trackers de Pets Virtuais (TRK_VIRTUAL_001 a 500)
no Resource Catalog do InterSCity via POST /catalog/resources e persiste o
mapeamento (tracker_ref <-> uuid) em arquivo JSON.
"""

import os
import sys
import json
import uuid
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List

# Adiciona o diretório raiz dos simuladores ao sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, PROJECT_ROOT)

try:
    import requests
except ImportError:
    import urllib.request
    import urllib.error
    requests = None

from simulators.common.geo import UFMA_CAMPUS_LAT, UFMA_CAMPUS_LON

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SeedInterSCity] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("SeedInterSCity")

TOTAL_TRACKERS = 500
INTERSCITY_URL = os.getenv("INTERSCITY_URL", "http://localhost:8000").rstrip("/")
CATALOG_ENDPOINT = f"{INTERSCITY_URL}/catalog/resources"
OUTPUT_FILE = os.path.join(BASE_DIR, "interscity_resources.json")
BACKEND_DATA_FILE = os.path.join(PROJECT_ROOT, "backend", "data", "interscity_resources.json")

def ensure_capabilities(session=None):
    """
    Garante o pré-registro das capacidades no catálogo oficial do InterSCity (USP/UFMA),
    evitando erros de CapabilityNotFound.
    """
    capabilities = ["location", "battery", "rssi", "speed", "status"]
    cap_url = f"{INTERSCITY_URL}/catalog/capabilities"
    for cap in capabilities:
        payload = {"name": cap, "capability_type": "sensor", "description": f"Capacidade {cap}"}
        try:
            if requests:
                req_func = session.post if session else requests.post
                req_func(cap_url, json=payload, timeout=2.0)
            else:
                req = urllib.request.Request(
                    cap_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req, timeout=2.0)
        except Exception:
            pass

def register_single_resource(index: int, session=None) -> Dict[str, Any]:
    """
    Registra um tracker virtual individual no catálogo do InterSCity.
    Espalha as coordenadas pelo campus da UFMA para teste de mapa realista.
    """
    tracker_ref = f"TRK_VIRTUAL_{index:03d}"
    pet_name = f"Pet Virtual #{index:03d}"

    # Dispersão espacial controlada no campus universitário
    lat_offset = ((index % 25) - 12) * 0.00035
    lon_offset = ((index // 25) - 10) * 0.00030
    lat = round(UFMA_CAMPUS_LAT + lat_offset, 6)
    lon = round(UFMA_CAMPUS_LON + lon_offset, 6)

    payload = {
        "data": {
            "description": f"Tracker Virtual {tracker_ref} ({pet_name})",
            "capabilities": ["location", "battery", "rssi", "speed", "status"],
            "status": "active",
            "lat": lat,
            "lon": lon,
            "city": "Sao Luis",
            "country": "Brazil"
        }
    }

    resource_uuid = None
    is_live = False

    # Tenta registrar no servidor InterSCity via HTTP POST
    try:
        if requests:
            req_func = session.post if session else requests.post
            resp = req_func(CATALOG_ENDPOINT, json=payload, timeout=3.0)
            if resp.status_code in (200, 201):
                res_json = resp.json()
                resource_uuid = res_json.get("data", {}).get("uuid") or res_json.get("uuid")
                is_live = True
        else:
            req = urllib.request.Request(
                CATALOG_ENDPOINT,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3.0) as response:
                if response.status in (200, 201):
                    res_json = json.loads(response.read().decode("utf-8"))
                    resource_uuid = res_json.get("data", {}).get("uuid") or res_json.get("uuid")
                    is_live = True
    except Exception as err:
        pass

    # Se o InterSCity não estiver online no instante de build/setup,
    # gera um UUID v5 determinístico e reprodutível baseado no tracker_ref
    if not resource_uuid:
        namespace = uuid.NAMESPACE_DNS
        resource_uuid = str(uuid.uuid5(namespace, f"pawsition.{tracker_ref}"))

    return {
        "tracker_ref": tracker_ref,
        "uuid": resource_uuid,
        "pet_name": pet_name,
        "lat": lat,
        "lon": lon,
        "live_registered": is_live
    }

def seed_resources(total: int = TOTAL_TRACKERS):
    """
    Executa o registro concorrente dos 500 recursos no InterSCity.
    """
    logger.info(f"Iniciando seed de {total} recursos no InterSCity ({CATALOG_ENDPOINT})...")
    start_time = time.time()

    results: List[Dict[str, Any]] = []
    session = None
    if requests:
        session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(pool_connections=25, pool_maxsize=25)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

    # Utiliza pool de threads para acelerar as 500 requisições HTTP
    ensure_capabilities(session)
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {
            executor.submit(register_single_resource, i, session): i
            for i in range(1, total + 1)
        }
        for future in as_completed(futures):
            results.append(future.result())

    # Ordena os resultados para manter integridade visual
    results.sort(key=lambda r: r["tracker_ref"])

    # Cria estruturas de indexação rápida O(1)
    uuid_by_tracker = {r["tracker_ref"]: r["uuid"] for r in results}
    tracker_by_uuid = {r["uuid"]: r["tracker_ref"] for r in results}

    live_count = sum(1 for r in results if r["live_registered"])
    elapsed = round(time.time() - start_time, 2)

    logger.info(
        f"Concluído em {elapsed}s! Total de {len(results)} recursos processados "
        f"({live_count} registrados via API ativa, {total - live_count} com UUID determinístico)."
    )

    data_payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(results),
        "interscity_url": INTERSCITY_URL,
        "resources": results,
        "uuid_by_tracker": uuid_by_tracker,
        "tracker_by_uuid": tracker_by_uuid
    }

    # Persiste o arquivo tanto em simulators quanto no backend
    for dest in (OUTPUT_FILE, BACKEND_DATA_FILE):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            json.dump(data_payload, f, indent=2, ensure_ascii=False)
        logger.info(f"Mapeamento salvo em: {dest}")

if __name__ == "__main__":
    seed_resources(TOTAL_TRACKERS)
