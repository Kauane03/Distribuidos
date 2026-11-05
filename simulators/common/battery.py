import random

class BatterySimulator:
    """
    Simula o decaimento gradual da bateria de um dispositivo em milivolts (mV).
    Típica bateria LiPo / Li-ion / Alcalina com operação entre 1750mV (0%) e 2750mV (100%).
    """
    def __init__(self, initial_percent: float = 95.0, drain_rate: float = 0.05):
        self.vmin = 1750
        self.vmax = 2750
        # Inicializa o valor em mV a partir da porcentagem
        self.current_mv = self.vmin + (initial_percent / 100.0) * (self.vmax - self.vmin)
        self.drain_rate = drain_rate  # mV por passo

    def discharge(self) -> int:
        """Simula um ciclo de consumo de energia e retorna o valor atual em mV."""
        # Consumo variável (pequena oscilação térmica/transmissão de rádio)
        drain = self.drain_rate + random.uniform(0.1, 0.8)
        self.current_mv = max(self.vmin, self.current_mv - drain)
        return int(round(self.current_mv))

    @property
    def percentage(self) -> float:
        """Calcula porcentagem de 0 a 100."""
        pct = ((self.current_mv - self.vmin) / (self.vmax - self.vmin)) * 100.0
        return round(max(0.0, min(100.0, pct)), 1)
