import { RWANDA_DISTRICTS, type RwandaDistrict } from './rwandaDistrict';

export interface DayForecast {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  precipMm: number;
  precipProb: number;
  windMax: number; // km/h
  capeMax: number; // J/kg: thunderstorm fuel
}

export interface StormRisk {
  score: number; // 0-100
  label: 'Low' | 'Moderate' | 'High' | 'Severe';
}

/** Real convective-storm signal from CAPE (Open-Meteo) plus thunderstorm weather codes. No random numbers. */
export function stormRisk(capeMax: number, code: number): StormRisk {
  let score = Math.min(100, Math.round((capeMax / 2500) * 100));
  if ([95, 96, 99].includes(code)) score = Math.max(score, 70);
  const label = score >= 75 ? 'Severe' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low';
  return { score, label };
}

const API = 'https://api.open-meteo.com/v1/forecast';

function dailyCapeMax(hourlyCape: number[], days: number): number[] {
  return Array.from({ length: days }, (_, d) =>
    Math.max(0, ...hourlyCape.slice(d * 24, d * 24 + 24).map((v) => v ?? 0))
  );
}

function parseDaily(json: any): DayForecast[] {
  const d = json.daily;
  const cape = dailyCapeMax(json.hourly?.cape ?? [], d.time.length);
  return d.time.map((date: string, i: number) => ({
    date,
    code: d.weather_code[i],
    tMax: d.temperature_2m_max[i],
    tMin: d.temperature_2m_min[i],
    precipMm: d.precipitation_sum[i] ?? 0,
    precipProb: d.precipitation_probability_max?.[i] ?? 0,
    windMax: d.wind_speed_10m_max[i],
    capeMax: cape[i],
  }));
}

export async function fetchDistrictForecast(d: RwandaDistrict): Promise<DayForecast[]> {
  const url =
    `${API}?latitude=${d.lat}&longitude=${d.lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&hourly=cape&timezone=Africa%2FKigali&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Forecast service is unavailable. Try again in a minute.');
  return parseDaily(await res.json());
}

export interface Hotspot {
  district: RwandaDistrict;
  rain3dMm: number;
  capeMax3d: number;
  risk: StormRisk;
}

/** One request for all 30 districts: ranks the next 3 days by storm risk and rainfall. */
export async function fetchHotspots(): Promise<Hotspot[]> {
  const lats = RWANDA_DISTRICTS.map((d) => d.lat).join(',');
  const lons = RWANDA_DISTRICTS.map((d) => d.lon).join(',');
  const url =
    `${API}?latitude=${lats}&longitude=${lons}&daily=weather_code,precipitation_sum&hourly=cape` +
    `&timezone=Africa%2FKigali&forecast_days=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Hotspot data is unavailable. Try again in a minute.');
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];
  return list
    .map((j: any, i: number) => {
      const capes = dailyCapeMax(j.hourly?.cape ?? [], 3);
      const capeMax3d = Math.max(...capes);
      const rain3dMm = (j.daily.precipitation_sum as number[]).reduce((a, b) => a + (b ?? 0), 0);
      const stormCode = (j.daily.weather_code as number[]).find((c) => [95, 96, 99].includes(c)) ?? 0;
      return { district: RWANDA_DISTRICTS[i], rain3dMm, capeMax3d, risk: stormRisk(capeMax3d, stormCode) };
    })
    .sort((a, b) => b.risk.score - a.risk.score || b.rain3dMm - a.rain3dMm);
}
