'use client';
import { useQuery } from '@tanstack/react-query';
import { RWANDA_DISTRICTS } from '../lib/rwandaDistrict';
import { fetchDistrictForecast, stormRisk } from '../lib/forecast';
import { getFarmingAdvice, getWeatherInfo } from '../lib/weatherCode';
import { Pill } from './ui';

const riskTone = (l: string) => (l === 'Severe' || l === 'High' ? 'storm' : l === 'Moderate' ? 'sorghum' : 'terrace') as 'storm' | 'sorghum' | 'terrace';
const dayName = (iso: string, i: number) => (i === 0 ? 'Today' : new Date(iso + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }));

export function useForecast(district: string) {
  const d = RWANDA_DISTRICTS.find((x) => x.name === district) ?? RWANDA_DISTRICTS[0];
  return useQuery({ queryKey: ['forecast', d.name], queryFn: () => fetchDistrictForecast(d) });
}

export default function ForecastPanel({ district }: { district: string }) {
  const { data, isLoading, error } = useForecast(district);

  if (isLoading) return <div className="glass-inner p-6 text-sm" role="status">Loading the {district} forecast…</div>;
  if (error || !data) return <div className="glass-inner p-6 text-sm" role="alert" style={{ color: 'var(--storm)' }}>{(error as Error)?.message ?? 'No forecast available.'}</div>;

  const today = data[0];
  const info = getWeatherInfo(today.code);
  const risk = stormRisk(today.capeMax, today.code);
  const weekRain = data.reduce((a, d) => a + d.precipMm, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{district} today</p>
          <p className="font-display text-6xl md:text-7xl font-extrabold leading-none">
            {Math.round(today.tMax)}°<span className="text-3xl" style={{ color: 'var(--muted)' }}> / {Math.round(today.tMin)}°</span>
          </p>
          <p className="mt-2 text-lg">{info.icon} {info.label}</p>
        </div>
        <div className="text-right space-y-1.5">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Rain this week</p>
          <p className="font-display text-3xl font-bold" style={{ color: 'var(--rain)' }}>{weekRain.toFixed(0)} mm</p>
          <Pill tone={riskTone(risk.label)}>Storm risk: {risk.label}</Pill>
        </div>
      </div>

      <p className="glass-inner mt-5 p-4 text-sm leading-relaxed">
        <strong>Farming advice:</strong> {getFarmingAdvice(today.code, today.precipMm, today.precipProb, today.tMax)}
      </p>

      <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {data.map((d, i) => {
          const w = getWeatherInfo(d.code);
          return (
            <div key={d.date} className="glass-inner p-2.5 text-center" title={w.label}>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{dayName(d.date, i)}</p>
              <p className="text-2xl my-1" aria-hidden>{w.icon}</p>
              <p className="text-sm font-semibold">{Math.round(d.tMax)}°</p>
              <p className="text-xs" style={{ color: 'var(--rain)' }}>{d.precipMm.toFixed(0)} mm</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{d.precipProb}%</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>Source: Open-Meteo. Storm risk is derived from convective energy (CAPE) and thunderstorm forecasts.</p>
    </div>
  );
}
