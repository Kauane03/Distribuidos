import math
import random
from typing import Tuple, List

# Coordenadas de referência: Campus do Bacanga - UFMA (São Luís - MA)
UFMA_CAMPUS_LAT = -2.557812
UFMA_CAMPUS_LON = -44.311345

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula distância em metros entre dois pontos usando Haversine."""
    R = 6371000  # Raio da Terra em metros
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class PetTrajectoryGenerator:
    """
    Gera trajetórias realistas de deslocamento para pets.
    Simula comportamentos: caminhada contínua, paradas para farejar, e pequenas corridas.
    """
    def __init__(self, start_lat: float = UFMA_CAMPUS_LAT, start_lon: float = UFMA_CAMPUS_LON, radius_meters: float = 400.0):
        self.center_lat = start_lat
        self.center_lon = start_lon
        self.current_lat = start_lat + random.uniform(-0.0005, 0.0005)
        self.current_lon = start_lon + random.uniform(-0.0005, 0.0005)
        self.radius_meters = radius_meters
        self.heading_degrees = random.uniform(0, 360)
        self.step_mode = "walking" # walking, sniffing, running
        self.mode_counter = 0

    def step(self) -> Tuple[float, float, float]:
        """
        Calcula o próximo ponto geográfico.
        Retorna (lat, lon, speed_mps).
        """
        self.mode_counter += 1
        if self.mode_counter > random.randint(4, 10):
            self.mode_counter = 0
            self.step_mode = random.choices(["walking", "sniffing", "running"], weights=[0.6, 0.25, 0.15])[0]

        # Velocidade conforme o modo (m/s)
        if self.step_mode == "sniffing":
            speed = random.uniform(0.0, 0.5)
            # Pequeno desvio de rumo
            self.heading_degrees += random.uniform(-40, 40)
        elif self.step_mode == "running":
            speed = random.uniform(3.0, 6.5)
            self.heading_degrees += random.uniform(-15, 15)
        else: # walking
            speed = random.uniform(0.8, 1.8)
            self.heading_degrees += random.uniform(-20, 20)

        # Distância em metros neste passo (assumindo passo de ~3-5s de intervalo)
        distance = speed * 3.0

        # Se estiver se afastando muito do raio delimitado, vira em direção ao centro
        dist_from_center = haversine_distance(self.center_lat, self.center_lon, self.current_lat, self.current_lon)
        if dist_from_center > self.radius_meters:
            # Aponta rumo de volta ao centro
            dlat = self.center_lat - self.current_lat
            dlon = self.center_lon - self.current_lon
            self.heading_degrees = (math.degrees(math.atan2(dlon, dlat)) + 360) % 360

        # Converte deslocamento de metros para graus
        # 1 grau latitude ~ 111.320 metros
        delta_lat = (distance * math.cos(math.radians(self.heading_degrees))) / 111320.0
        # 1 grau longitude ~ 111.320 * cos(lat) metros
        delta_lon = (distance * math.sin(math.radians(self.heading_degrees))) / (111320.0 * math.cos(math.radians(self.current_lat)))

        # Adiciona pequeno ruído de GPS (jitter de ~1-2 metros)
        gps_jitter_lat = random.gauss(0, 0.00001)
        gps_jitter_lon = random.gauss(0, 0.00001)

        self.current_lat += delta_lat + gps_jitter_lat
        self.current_lon += delta_lon + gps_jitter_lon

        return round(self.current_lat, 7), round(self.current_lon, 7), round(speed, 2)
