import json
import logging
import time
from typing import Callable, Optional
import paho.mqtt.client as mqtt

logger = logging.getLogger("SimulatorMQTT")

class DeviceMqttClient:
    """
    Cliente MQTT padronizado para dispositivos simulados (Sticks e Trackers).
    Implementa Last Will & Testament (LWT) para sinalização distribuída de status offline.
    """
    def __init__(
        self,
        client_id: str,
        broker_host: str = "localhost",
        broker_port: int = 1883,
        device_type: str = "tracker",
        device_ref: str = "DEV_01",
        on_message_callback: Optional[Callable[[str, dict], None]] = None
    ):
        self.client_id = client_id
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.device_type = device_type
        self.device_ref = device_ref
        self.on_message_callback = on_message_callback
        self.is_connected = False

        # Tópicos padronizados
        self.category = "trackers" if device_type == "tracker" else "sticks"
        self.telemetry_topic = f"pawsition/{self.category}/{self.device_ref}/telemetry"
        self.status_topic = f"pawsition/{self.category}/{self.device_ref}/status"
        self.command_topic = f"pawsition/{self.category}/{self.device_ref}/command"
        self.config_topic = f"pawsition/{self.category}/{self.device_ref}/config"

        # Compatibilidade com paho-mqtt 2.x e 1.x
        try:
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=self.client_id
            )
        except AttributeError:
            self.client = mqtt.Client(client_id=self.client_id)

        self._setup_callbacks()

    def _setup_callbacks(self):
        # Configura Last Will & Testament (LWT)
        # O broker publicará automaticamente caso a conexão TCP caia sem aviso
        lwt_payload = json.dumps({
            "status": "offline",
            "deviceType": self.device_type,
            "deviceRef": self.device_ref,
            "timestamp": time.time(),
            "reason": "unexpected_disconnect"
        })
        self.client.will_set(self.status_topic, payload=lwt_payload, qos=1, retain=True)

        def on_connect(client, userdata, flags, rc, properties=None):
            if rc == 0 or (hasattr(rc, "is_failure") and not rc.is_failure):
                self.is_connected = True
                logger.info(f"[{self.device_ref}] Conectado ao broker MQTT {self.broker_host}:{self.broker_port}")

                # Publica presença online
                online_payload = json.dumps({
                    "status": "online",
                    "deviceType": self.device_type,
                    "deviceRef": self.device_ref,
                    "timestamp": time.time()
                })
                client.publish(self.status_topic, payload=online_payload, qos=1, retain=True)

                # Assina tópicos de comando/configuração
                client.subscribe([(self.command_topic, 1), (self.config_topic, 1)])
            else:
                logger.error(f"[{self.device_ref}] Falha ao conectar: código {rc}")

        def on_disconnect(client, userdata, flags_or_rc, *args):
            self.is_connected = False
            logger.warning(f"[{self.device_ref}] Desconectado do broker MQTT.")

        def on_message(client, userdata, msg):
            try:
                payload = json.loads(msg.payload.decode("utf-8"))
                logger.info(f"[{self.device_ref}] Mensagem recebida em [{msg.topic}]: {payload}")
                if self.on_message_callback:
                    self.on_message_callback(msg.topic, payload)
            except Exception as e:
                logger.error(f"[{self.device_ref}] Erro ao decodificar mensagem: {e}")

        self.client.on_connect = on_connect
        self.client.on_disconnect = on_disconnect
        self.client.on_message = on_message

    def start(self):
        """Inicia conexão em thread de segundo plano com reconexão automática."""
        try:
            self.client.connect(self.broker_host, self.broker_port, keepalive=30)
            self.client.loop_start()
        except Exception as e:
            logger.error(f"[{self.device_ref}] Erro ao iniciar conexão MQTT: {e}")

    def stop(self):
        """Encerra graciosamente, avisando que está offline."""
        if self.is_connected:
            offline_payload = json.dumps({
                "status": "offline",
                "deviceType": self.device_type,
                "deviceRef": self.device_ref,
                "timestamp": time.time(),
                "reason": "graceful_shutdown"
            })
            self.client.publish(self.status_topic, payload=offline_payload, qos=1, retain=True)
            time.sleep(0.2)
        self.client.loop_stop()
        self.client.disconnect()

    def publish_telemetry(self, payload: dict) -> bool:
        """Publica mensagem de telemetria no tópico do dispositivo."""
        if not self.is_connected:
            return False
        res = self.client.publish(self.telemetry_topic, json.dumps(payload), qos=1)
        return res.rc == mqtt.MQTT_ERR_SUCCESS
