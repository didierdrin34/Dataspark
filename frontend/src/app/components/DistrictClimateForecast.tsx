'use client';

import { useEffect, useRef, useState } from 'react';
import * as domtoimage from 'dom-to-image';
import { RWANDA_DISTRICTS } from '../lib/rwandaDistrict';
import { getWeatherInfo, getFarmingAdvice } from '../lib/weatherCode';

interface DailyForecast {
  dates: string[];
  weathercode: number[];
  tempMax: number[];
  tempMin: number[];
  precipSum: number[];
  precipProb: number[];
  windMax: number[];
}

const FORECAST_DAYS = 7;

export default function DistrictClimateForecast() {
  const [forecasts, setForecasts] = useState<Record<string, DailyForecast>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [provinceFilter, setProvinceFilter] = useState('All');
  const [isExporting, setIsExporting] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const lats = RWANDA_DISTRICTS.map((d) => d.lat).join(',');
        const lons = RWANDA_DISTRICTS.map((d) => d.lon).join(',');
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
          `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
          `&timezone=Africa%2FKigali&forecast_days=${FORECAST_DAYS}`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Weather service returned status ${res.status}`);
        }
        const data = await res.json();
        const results: any[] = Array.isArray(data) ? data : [data];
        if (cancelled) return;

        const next: Record<string, DailyForecast> = {};
        results.forEach((result, i) => {
          const district = RWANDA_DISTRICTS[i];
          if (!district || !result?.daily) return;
          next[district.name] = {
            dates: result.daily.time,
            weathercode: result.daily.weathercode,
            tempMax: result.daily.temperature_2m_max,
            tempMin: result.daily.temperature_2m_min,
            precipSum: result.daily.precipitation_sum,
            precipProb: result.daily.precipitation_probability_max,
            windMax: result.daily.wind_speed_10m_max,
          };
        });
        setForecasts(next);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load climate data. Please try again later.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const provinces = ['All', ...Array.from(new Set(RWANDA_DISTRICTS.map((d) => d.province)))];
  const districtsToShow =
    provinceFilter === 'All' ? RWANDA_DISTRICTS : RWANDA_DISTRICTS.filter((d) => d.province === provinceFilter);

  const referenceForecast = Object.values(forecasts)[0];
  const dayLabels = referenceForecast
    ? referenceForecast.dates.map((dateStr, idx) => {
        if (idx === 0) return 'Today';
        if (idx === 1) return 'Tomorrow';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      })
    : [];

  const exportForecastImage = async () => {
    if (!gridRef.current) return;
    setIsExporting(true);
    try {
      const node = gridRef.current;
      const dataUrl = await domtoimage.toPng(node, {
        bgcolor: '#ffffff',
        width: node.offsetWidth * 2,
        height: node.offsetHeight * 2,
        style: {
          transform: 'scale(2)',
          transformOrigin: 'top left',
          width: `${node.offsetWidth}px`,
          height: `${node.offsetHeight}px`,
        },
      });
      const link = document.createElement('a');
      const dayLabel = (dayLabels[dayIndex] || `day-${dayIndex}`).replace(/\s+/g, '-').toLowerCase();
      link.download = `rwanda-district-climate-${dayLabel}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export forecast image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mt-6 p-4 md:p-6 bg-white/95 rounded-xl shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Rwanda District Climate Outlook</h2>
          <p className="text-sm text-gray-500">
            Daily forecast for all 30 districts to help farmers plan planting, spraying, and harvesting.
          </p>
        </div>
        <button
          onClick={exportForecastImage}
          disabled={loading || isExporting || Object.keys(forecasts).length === 0}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
        >
          {isExporting ? 'Preparing image...' : 'Download as image'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

      {!loading && !error && dayLabels.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {dayLabels.map((label, idx) => (
            <button
              key={idx}
              onClick={() => setDayIndex(idx)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                dayIndex === idx
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-wrap gap-2 mb-4">
          {provinces.map((p) => (
            <button
              key={p}
              onClick={() => setProvinceFilter(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                provinceFilter === p
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="py-12 text-center text-gray-500">Loading climate data for all 30 districts...</div>}

      {!loading && !error && (
        <div ref={gridRef} className="bg-white p-2 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {districtsToShow.map((district) => {
              const forecast = forecasts[district.name];
              if (!forecast) return null;
              const code = forecast.weathercode[dayIndex];
              const { icon, label } = getWeatherInfo(code);
              const tempMax = forecast.tempMax[dayIndex];
              const tempMin = forecast.tempMin[dayIndex];
              const precipMm = forecast.precipSum[dayIndex];
              const precipProb = forecast.precipProb[dayIndex];
              const windMax = forecast.windMax[dayIndex];
              const advice = getFarmingAdvice(code, precipMm, precipProb, tempMax);
              return (
                <div
                  key={district.name}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{district.name}</p>
                      <p className="text-xs text-gray-400">{district.province}</p>
                    </div>
                    <span className="text-3xl" title={label}>
                      {icon}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{label}</p>
                  <div className="grid grid-cols-3 gap-1 text-xs text-gray-600 mb-2">
                    <div>🌡️ {Math.round(tempMin)}–{Math.round(tempMax)}°C</div>
                    <div>💧 {Math.round(precipProb)}%</div>
                    <div>💨 {Math.round(windMax)} km/h</div>
                  </div>
                  <p className="text-xs text-emerald-700 bg-emerald-50 rounded p-1.5 leading-snug">{advice}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Forecast data from Open-Meteo, based on each district&apos;s approximate center — actual conditions may vary
        across sectors.
      </p>
    </div>
  );
}
