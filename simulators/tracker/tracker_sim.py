"""
Simulador de Tracker IoT para Pets com envio via InterSCity Data Collector
Disciplina: Sistemas Distribuídos - UFMA
Projeto: Pet Tracker
"""

import os
import time
import random
import logging
from typing import Optional, Dict, Any

try:
    import requests
except ImportError:
    requests = None

from simulators.common.geo import PetTrajectoryGenerator, UFMA_CAMPUS_LAT, UFMA_CAMPUS_LON
from simulators.common.battery import BatterySimulator

logger = logging.getLogger("TrackerSim")

class TrackerSimulator:
    """
    Representa a coleira inteligente instalada em um Pet Virtual.
    Gera dinâmica de movimento, descarga gradual de bateria e envia
    as métricas via HTTP POST para o Data Collector da plataforma InterSCity.
    """

    def __init__(
        self,
        tracker_ref: str,
        resource_uuid: str,
        interscity_url: str = "http://interscity:8000",
        stick_ref: Optional[str] = "STICK_CCET_UFMA",
        center_lat: float = UFMA_CAMPUS_LAT,
        center_lon: float = UFMA_CAMPUS_LON,
        start_lat: Optional[float] = None,
        start_lon: Optional[float] = None,
        interval_seconds: float = 3.0,
        initial_battery_pct: float = 85.0
    ):
        self.tracker_ref = tracker_ref
        self.resource_uuid = resource_uuid
        self.interscity_url = interscity_url.rstrip("/")
        self.stick_ref = stick_ref
        self.interval_seconds = interval_seconds
        self.is_running = False

        # Endpoint do InterSCity Data Collector para este recurso
        self.collector_url = f"{self.interscity_url}/collector/resources/{self.resource_uuid}/data"

        # Geradores de dinâmica física do animal espalhado por São Luís
        initial_lat = start_lat if start_lat is not None else center_lat
        initial_lon = start_lon if start_lon is not None else center_lon
        self.geo = PetTrajectoryGenerator(start_lat=initial_lat, start_lon=initial_lon, radius_meters=1200.0)
        self.battery = BatterySimulator(initial_percent=initial_battery_pct)

    def start(self):
        """Ativa o estado operacional do rastreador."""
        self.is_running = True

    def stop(self):
        """Desativa o rastreador."""
        self.is_running = False

    def generate_telemetry_payload(self) -> Dict[str, Any]:
        """Gera o payload de telemetria no padrão de recursos do InterSCity."""
        lat, lon, speed = self.geo.step()
        bat_mv = self.battery.discharge()
        rssi_value = round(random.uniform(55.0, 92.0), 1)

        return {
            "data": {
                "t_id": self.tracker_ref,
                "s_id": self.stick_ref,
                "lat": lat,
                "lon": lon,
                "battery": round(self.battery.percentage, 1),
                "bat": bat_mv,
                "sbat": 2720,
                "rssi": rssi_value,
                "speed": speed,
                "timestamp": int(time.time() * 1000)
            }
        }

    def tick(self, session: Optional[Any] = None) -> bool:
        """
        Executa um ciclo de envio de telemetria via HTTP POST para o InterSCity.
        Utiliza a sessão HTTP recebida para reaproveitamento de conexões TCP.
        """
        payload = self.generate_telemetry_payload()

        try:
            # Envio otimizado via HTTP POST para o InterSCity Data Collector
            if session:
                resp = session.post(self.collector_url, json=payload, timeout=2.5)
            elif requests:
                resp = requests.post(self.collector_url, json=payload, timeout=2.5)
            else:
                return False

            return resp.status_code in (200, 201)
        except Exception:
            return False
