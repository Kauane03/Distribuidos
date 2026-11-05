import time
import random
import logging
from typing import Optional

from simulators.common.geo import PetTrajectoryGenerator, UFMA_CAMPUS_LAT, UFMA_CAMPUS_LON
from simulators.common.battery import BatterySimulator
from simulators.common.mqtt_client import DeviceMqttClient

logger = logging.getLogger("TrackerSim")

class TrackerSimulator:
    """
    Simulador de dispositivo Tracker (coleira instalada no Pet).
    Gera coordenadas de GPS, nível de bateria e intensidade de sinal (RSSI).
    """
    def __init__(
        self,
        tracker_ref: str,
        broker_host: str = "localhost",
        broker_port: int = 1883,
        stick_ref: Optional[str] = "STICK_CCET_UFMA",
        center_lat: float = UFMA_CAMPUS_LAT,
        center_lon: float = UFMA_CAMPUS_LON,
        interval_seconds: float = 3.0,
        initial_battery_pct: float = 85.0
    ):
        self.tracker_ref = tracker_ref
        self.stick_ref = stick_ref
        self.interval_seconds = interval_seconds
        self.is_running = False

        self.geo = PetTrajectoryGenerator(start_lat=center_lat, start_lon=center_lon)
        self.battery = BatterySimulator(initial_percent=initial_battery_pct)

        self.mqtt = DeviceMqttClient(
            client_id=f"sim_{tracker_ref}",
            broker_host=broker_host,
            broker_port=broker_port,
            device_type="tracker",
            device_ref=tracker_ref,
            on_message_callback=self._on_command
        )

    def _on_command(self, topic: str, payload: dict):
        logger.info(f"[{self.tracker_ref}] Comando recebido: {payload}")
        if "interval" in payload:
            self.interval_seconds = max(1.0, float(payload["interval"]))
            logger.info(f"[{self.tracker_ref}] Intervalo de envio atualizado para {self.interval_seconds}s")

    def start(self):
        self.is_running = True
        self.mqtt.start()

    def stop(self):
        self.is_running = False
        self.mqtt.stop()

    def tick(self):
        """Executa um ciclo de envio de telemetria."""
        if not self.mqtt.is_connected:
            return

        lat, lon, speed = self.geo.step()
        bat_mv = self.battery.discharge()

        # RSSI varia entre 50 e 95 (ou -95 a -50 dBm)
        # Simula pequenas oscilações de relevo / obstáculos
        rssi_value = round(random.uniform(55.0, 92.0), 1)

        payload = {
            "t_id": self.tracker_ref,
            "s_id": self.stick_ref,
            "lat": lat,
            "lon": lon,
            "bat": bat_mv, # milivolts (compatível com a lógica real)
            "sbat": 2720,  # bateria do gateway stick (mV)
            "lr_rssi": rssi_value,
            "speed": speed,
            "timestamp": int(time.time() * 1000)
        }

        sent = self.mqtt.publish_telemetry(payload)
        if sent:
            logger.info(
                f"[{self.tracker_ref}] 📍 lat={lat}, lon={lon} | 🔋 {self.battery.percentage}% ({bat_mv}mV) | 📶 RSSI={rssi_value}"
            )
        else:
            logger.warning(f"[{self.tracker_ref}] Falha ao enviar telemetria MQTT")

    def run_loop(self):
        """Loop de execução síncrono para execução como processo independente."""
        self.start()
        try:
            while self.is_running:
                self.tick()
                time.sleep(self.interval_seconds)
        except KeyboardInterrupt:
            logger.info(f"[{self.tracker_ref}] Interrompido pelo usuário.")
        finally:
            self.stop()
