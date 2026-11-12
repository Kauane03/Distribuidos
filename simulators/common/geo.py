import math
import random
from typing import Tuple, List, Dict, Any

# Coordenadas geográficas reais dos principais bairros e pontos de São Luís - MA
SAO_LUIS_NEIGHBORHOODS: List[Dict[str, Any]] = [
    {"name": "Centro Histórico", "lat": -2.5290, "lon": -44.3028},
    {"name": "Ponta d'Areia", "lat": -2.4850, "lon": -44.3120},
    {"name": "São Francisco", "lat": -2.5020, "lon": -44.2980},
    {"name": "Renascença", "lat": -2.4990, "lon": -44.2950},
    {"name": "Lagoa da Jansen", "lat": -2.4960, "lon": -44.3050},
    {"name": "Calhau / Litorânea", "lat": -2.4880, "lon": -44.2650},
    {"name": "Olho d'Água", "lat": -2.4830, "lon": -44.2380},
    {"name": "Araçagy", "lat": -2.4650, "lon": -44.1950},
    {"name": "Turu", "lat": -2.5020, "lon": -44.2250},
    {"name": "Cohama", "lat": -2.5210, "lon": -44.2480},
    {"name": "Vinhais", "lat": -2.5180, "lon": -44.2620},
    {"name": "Bequimão", "lat": -2.5280, "lon": -44.2550},
    {"name": "Maranhão Novo", "lat": -2.5350, "lon": -44.2600},
    {"name": "Monte Castelo", "lat": -2.5400, "lon": -44.2850},
    {"name": "João Paulo", "lat": -2.5450, "lon": -44.2700},
    {"name": "Alemanha", "lat": -2.5480, "lon": -44.2780},
    {"name": "Cohab Anil", "lat": -2.5410, "lon": -44.2180},
    {"name": "Cohatrac", "lat": -2.5350, "lon": -44.2000},
    {"name": "Parque Piauí", "lat": -2.5700, "lon": -44.2550},
    {"name": "Cidade Operária", "lat": -2.5680, "lon": -44.1900},
    {"name": "Anjo da Guarda", "lat": -2.5650, "lon": -44.3200},
    {"name": "Vila Embratel", "lat": -2.5600, "lon": -44.3180},
    {"name": "UFMA Bacanga", "lat": -2.5578, "lon": -44.3113},
    {"name": "Sá Viana", "lat": -2.5520, "lon": -44.3080},
    {"name": "Madre Deus", "lat": -2.5380, "lon": -44.3000},
    {"name": "Coroadinho", "lat": -2.5500, "lon": -44.2800},
    {"name": "São Cristóvão", "lat": -2.5600, "lon": -44.2280},
    {"name": "Tirirical / Aeroporto", "lat": -2.5850, "lon": -44.2350},
    {"name": "Maracanã", "lat": -2.6050, "lon": -44.2900},
    {"name": "Tibiri", "lat": -2.6200, "lon": -44.2500},
]

# Centro da ilha de São Luís
SAO_LUIS_CENTER_LAT = -2.5300
SAO_LUIS_CENTER_LON = -44.2700

UFMA_CAMPUS_LAT = -2.557812
UFMA_CAMPUS_LON = -44.311345

def get_sao_luis_coordinates(index: int) -> Tuple[float, float, str]:
    """
    Distribui os pets uniformemente entre os 30 principais bairros de São Luís.
    Gera um espalhamento espacial dentro do bairro para evitar sobreposição.
    """
    bairro = SAO_LUIS_NEIGHBORHOODS[index % len(SAO_LUIS_NEIGHBORHOODS)]
    
    # Sub-dispersão determinística e pseudo-aleatória dentro do bairro (~100m a 800m)
    seed_offset_lat = (((index * 7) % 31) - 15) * 0.0006
    seed_offset_lon = (((index * 13) % 31) - 15) * 0.0006
    
    lat = round(bairro["lat"] + seed_offset_lat, 6)
    lon = round(bairro["lon"] + seed_offset_lon, 6)
    return lat, lon, bairro["name"]

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
    def __init__(self, start_lat: float = SAO_LUIS_CENTER_LAT, start_lon: float = SAO_LUIS_CENTER_LON, radius_meters: float = 800.0):
        self.center_lat = start_lat
        self.center_lon = start_lon
        self.current_lat = start_lat + random.uniform(-0.0008, 0.0008)
        self.current_lon = start_lon + random.uniform(-0.0008, 0.0008)
        self.radius_meters = radius_meters
        self.heading_degrees = random.uniform(0, 360)
        self.step_mode = "walking"
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

        if self.step_mode == "sniffing":
            speed = random.uniform(0.0, 0.5)
            self.heading_degrees += random.uniform(-40, 40)
        elif self.step_mode == "running":
            speed = random.uniform(3.0, 6.5)
            self.heading_degrees += random.uniform(-15, 15)
        else: # walking
            speed = random.uniform(0.8, 1.8)
            self.heading_degrees += random.uniform(-20, 20)

        distance = speed * 3.0

        dist_from_center = haversine_distance(self.center_lat, self.center_lon, self.current_lat, self.current_lon)
        if dist_from_center > self.radius_meters:
            dlat = self.center_lat - self.current_lat
            dlon = self.center_lon - self.current_lon
            self.heading_degrees = (math.degrees(math.atan2(dlon, dlat)) + 360) % 360

        delta_lat = (distance * math.cos(math.radians(self.heading_degrees))) / 111320.0
        delta_lon = (distance * math.sin(math.radians(self.heading_degrees))) / (111320.0 * math.cos(math.radians(self.current_lat)))

        gps_jitter_lat = random.gauss(0, 0.00001)
        gps_jitter_lon = random.gauss(0, 0.00001)

        self.current_lat += delta_lat + gps_jitter_lat
        self.current_lon += delta_lon + gps_jitter_lon

        return round(self.current_lat, 7), round(self.current_lon, 7), round(speed, 2)
