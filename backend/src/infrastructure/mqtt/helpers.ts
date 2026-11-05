/**
 * Converte tensão da bateria em milivolts para porcentagem (0-100%).
 * Caso o valor já venha como porcentagem (ex: <= 100), apenas formata.
 */
export function voltageToPercent(value: number | null | undefined, vmin = 1750, vmax = 2750): number | null {
  if (value === null || value === undefined) return null;

  // Se já for uma porcentagem (0 a 100)
  if (value >= 0 && value <= 100) {
    return Math.round(value * 10) / 10;
  }

  // Se for milivolts (ex: 2500mV)
  const percent = ((value - vmin) / (vmax - vmin)) * 100;
  const clamped = Math.max(0, Math.min(percent, 100));
  return Math.round(clamped * 10) / 10;
}

/**
 * Fórmula de Haversine para calcular distância entre dois pontos geográficos em metros.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadius = 6371000; // metros

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

/**
 * Qualifica a força do sinal RSSI (dBm ou escala 0-100)
 */
export function getSignalQuality(rssi: number | null | undefined): "Excelente" | "Bom" | "Fraco" {
  if (rssi === null || rssi === undefined) return "Fraco";

  // Se for dBm negativo (ex: -65 dBm)
  if (rssi < 0) {
    if (rssi >= -70) return "Excelente";
    if (rssi >= -85) return "Bom";
    return "Fraco";
  }

  // Se for valor absoluto positivo (escala de sinal 0-100)
  if (rssi >= 75) return "Excelente";
  if (rssi >= 50) return "Bom";
  return "Fraco";
}
