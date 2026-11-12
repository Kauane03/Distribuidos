#!/usr/bin/env python3
"""
Servidor Emulador da Plataforma InterSCity (Resource Catalog & Data Collector)
Compatível com a API REST oficial do InterSCity:
- POST /catalog/resources
- GET  /catalog/resources
- GET  /catalog/resources/{uuid}
- POST /collector/resources/{uuid}/data
- GET  /collector/resources/{uuid}/data/last
- GET  /collector/resources/data/last
"""

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [InterSCity] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("InterSCity")

# Armazenamento em memória para alta performance
catalog_store: Dict[str, Dict[str, Any]] = {}
collector_store: Dict[str, Dict[str, Any]] = {}

class InterSCityHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suprime logs de acesso padrão para não poluir terminal com 500 requests/s
        pass

    def _send_json(self, status_code: int, data: Any):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"status": "ok"})

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")

        # 1. GET /health
        if path == "/health" or path == "":
            return self._send_json(200, {
                "status": "online",
                "service": "InterSCity Platform Emulator",
                "resources_count": len(catalog_store)
            })

        # 2. GET /catalog/resources
        if path == "/catalog/resources":
            return self._send_json(200, {"resources": list(catalog_store.values())})

        # 3. GET /catalog/resources/{uuid}
        match_cat = re.match(r"^/catalog/resources/([a-zA-Z0-9_-]+)$", path)
        if match_cat:
            res_uuid = match_cat.group(1)
            if res_uuid in catalog_store:
                return self._send_json(200, {"data": catalog_store[res_uuid]})
            return self._send_json(404, {"error": "Resource not found"})

        # 4. GET /collector/resources/data/last (últimos dados de todos os recursos)
        if path == "/collector/resources/data/last":
            all_last = [
                {"uuid": u, **d} for u, d in collector_store.items()
            ]
            return self._send_json(200, {"data": all_last})

        # 5. GET /collector/resources/{uuid}/data/last (último dado de um recurso específico)
        match_col = re.match(r"^/collector/resources/([a-zA-Z0-9_-]+)/data/last$", path)
        if match_col:
            res_uuid = match_col.group(1)
            if res_uuid in collector_store:
                return self._send_json(200, {
                    "data": {
                        "uuid": res_uuid,
                        **collector_store[res_uuid]
                    }
                })
            # Se não houver dados ainda, retorna objeto vazio ou último conhecido do catálogo
            if res_uuid in catalog_store:
                return self._send_json(200, {
                    "data": {
                        "uuid": res_uuid,
                        "lat": catalog_store[res_uuid].get("lat"),
                        "lon": catalog_store[res_uuid].get("lon"),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                })
            return self._send_json(404, {"error": "Resource or telemetry not found"})

        return self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length)

        try:
            body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            return self._send_json(400, {"error": "Invalid JSON body"})

        # 1. POST /catalog/resources -> Cadastro de novo recurso no InterSCity
        if path == "/catalog/resources":
            # Aceita {"data": {...}} ou {"resource": {...}} ou direto {...}
            res_data = body.get("data", body.get("resource", body))
            res_uuid = res_data.get("uuid") or str(uuid.uuid4())

            registered_resource = {
                "uuid": res_uuid,
                "description": res_data.get("description", "Virtual Pet Tracker"),
                "capabilities": res_data.get("capabilities", ["location", "battery", "rssi"]),
                "status": res_data.get("status", "active"),
                "lat": res_data.get("lat", -2.5578),
                "lon": res_data.get("lon", -44.3113),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            catalog_store[res_uuid] = registered_resource

            return self._send_json(201, {"data": registered_resource})

        # 2. POST /collector/resources/{uuid}/data -> Envio de telemetria
        match_col = re.match(r"^/collector/resources/([a-zA-Z0-9_-]+)/data$", path)
        if match_col:
            res_uuid = match_col.group(1)
            # Aceita {"data": {...}} ou dados diretos
            telemetry_data = body.get("data", body)
            now_iso = datetime.now(timezone.utc).isoformat()

            if isinstance(telemetry_data, dict):
                telemetry_data["updated_at"] = now_iso
                collector_store[res_uuid] = telemetry_data
            else:
                collector_store[res_uuid] = {
                    "value": telemetry_data,
                    "updated_at": now_iso
                }

            return self._send_json(201, {"status": "ok", "uuid": res_uuid})

        return self._send_json(404, {"error": "Endpoint not found"})

def run(host: str = "0.0.0.0", port: int = 8000):
    server = HTTPServer((host, port), InterSCityHandler)
    logger.info(f"InterSCity Platform Emulator rodando em http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Encerrando InterSCity...")
        server.server_close()

if __name__ == "__main__":
    run()
