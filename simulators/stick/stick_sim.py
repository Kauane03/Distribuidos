import time
import logging
from typing import Optional

from simulators.common.battery import BatterySimulator
from simulators.common.mqtt_client import DeviceMqttClient

logger = logging.getLogger("StickSim")

class StickSimulator:
    """
    Simulador de dispositivo Stick (Gateway / Ponto de Acesso e Coleta).
    Permite receber comandos de configuração Wi-Fi e emitir status de conectividade.
    """
    def __init__(
        self,
        stick_ref: str,
        broker_host: str = "localhost",
        broker_port: int = 1883,
        initial_wifi: str = "UFMA_EDUROAM",
        interval_seconds: float = 10.0,
        initial_battery_pct: float = 98.0
    ):
        self.stick_ref = stick_ref
        self.wifi_ssid = initial_wifi
        self.interval_seconds = interval_seconds
        self.is_running = False
        self.start_time = time.time()

        self.battery = BatterySimulator(initial_percent=initial_battery_pct, drain_rate=0.01)

        self.mqtt = DeviceMqttClient(
            client_id=f"sim_{stick_ref}",
            broker_host=broker_host,
            broker_port=broker_port,
            device_type="stick",
            device_ref=stick_ref,
            on_message_callback=self._on_config_received
        )

    def _on_config_received(self, topic: str, payload: dict):
        logger.info(f"[{self.stick_ref}] ⚙️ Nova configuração recebida via MQTT: {payload}")
        if "wf1" in payload and payload["wf1"]:
            self.wifi_ssid = payload["wf1"]
            logger.info(f"[{self.stick_ref}] Wi-Fi reconfigurado para SSID: '{self.wifi_ssid}'")

    def start(self):
        self.is_running = True
        self.mqtt.start()

    def stop(self):
        self.is_running = False
        self.mqtt.stop()

    def tick(self):
        """Emite telemetria de integridade do gateway stick."""
        if not self.mqtt.is_connected:
            return

        sbat_mv = self.battery.discharge()
        uptime_seconds = int(time.time() - self.start_time)

        payload = {
            "s_id": self.stick_ref,
            "sbat": sbat_mv,
            "bateria": self.battery.percentage,
            "wifi_ssid": self.wifi_ssid,
            "uptime_seconds": uptime_seconds,
            "timestamp": int(time.time() * 1000)
        }

        sent = self.mqtt.publish_telemetry(payload)
        if sent:
            logger.info(
                f"[{self.stick_ref}] 📡 Gateway ativo | Wi-Fi: {self.wifi_ssid} | Bateria: {self.battery.percentage}% | Uptime: {uptime_seconds}s"
            )

    def run_loop(self):
        """Loop de execução síncrono para execução como processo independente."""
        self.start()
        try:
            while self.is_running:
                self.tick()
                time.sleep(self.interval_seconds)
        except KeyboardInterrupt:
            logger.info(f"[{self.stick_ref}] Interrompido pelo usuário.")
        finally:
            self.stop()
