export interface WeatherInfo {
  icon: string;
  label: string;
}

// WMO weather interpretation codes, as used by the Open-Meteo API.
const WEATHER_CODE_MAP: Record<number, WeatherInfo> = {
  0: { icon: '☀️', label: 'Clear sky' },
  1: { icon: '🌤️', label: 'Mainly clear' },
  2: { icon: '⛅', label: 'Partly cloudy' },
  3: { icon: '☁️', label: 'Overcast' },
  45: { icon: '🌫️', label: 'Fog' },
  48: { icon: '🌫️', label: 'Depositing rime fog' },
  51: { icon: '🌦️', label: 'Light drizzle' },
  53: { icon: '🌦️', label: 'Moderate drizzle' },
  55: { icon: '🌧️', label: 'Dense drizzle' },
  56: { icon: '🌧️', label: 'Light freezing drizzle' },
  57: { icon: '🌧️', label: 'Dense freezing drizzle' },
  61: { icon: '🌦️', label: 'Slight rain' },
  63: { icon: '🌧️', label: 'Moderate rain' },
  65: { icon: '🌧️', label: 'Heavy rain' },
  66: { icon: '🌧️', label: 'Light freezing rain' },
  67: { icon: '🌧️', label: 'Heavy freezing rain' },
  71: { icon: '🌨️', label: 'Slight snow' },
  73: { icon: '🌨️', label: 'Moderate snow' },
  75: { icon: '❄️', label: 'Heavy snow' },
  77: { icon: '❄️', label: 'Snow grains' },
  80: { icon: '🌦️', label: 'Slight rain showers' },
  81: { icon: '🌧️', label: 'Moderate rain showers' },
  82: { icon: '⛈️', label: 'Violent rain showers' },
  85: { icon: '🌨️', label: 'Slight snow showers' },
  86: { icon: '❄️', label: 'Heavy snow showers' },
  95: { icon: '⛈️', label: 'Thunderstorm' },
  96: { icon: '⛈️', label: 'Thunderstorm with hail' },
  99: { icon: '⛈️', label: 'Thunderstorm with heavy hail' },
};

export function getWeatherInfo(code: number): WeatherInfo {
  return WEATHER_CODE_MAP[code] ?? { icon: '❓', label: 'Unknown' };
}

export function getFarmingAdvice(
  code: number,
  precipMm: number,
  precipProb: number,
  tempMax: number
): string {
  if ([95, 96, 99].includes(code)) {
    return 'Thunderstorm risk — secure equipment and avoid open fields.';
  }
  if ([65, 67, 82].includes(code) || precipMm > 20) {
    return 'Heavy rain expected — delay planting/spraying and watch for flooding in low-lying fields.';
  }
  if (precipProb >= 60 || [51, 53, 55, 61, 63, 80, 81].includes(code)) {
    return 'Rain likely — good for newly planted crops, but hold off on spraying pesticides.';
  }
  if (tempMax >= 30 && precipProb < 30) {
    return 'Hot and dry — prioritize irrigation and avoid midday fieldwork.';
  }
  if ([0, 1, 2].includes(code) && precipProb < 30) {
    return 'Good conditions for planting, weeding, harvesting, and drying crops.';
  }
  return 'Mild conditions — normal farming activities can proceed.';
}
