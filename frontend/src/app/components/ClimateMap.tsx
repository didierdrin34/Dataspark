'use client';
import { useEffect, useRef, useState } from 'react';

const OVERLAYS = [
  { id: 'wind', label: 'Wind' },
  { id: 'rain', label: 'Rain' },
  { id: 'temp', label: 'Temperature' },
  { id: 'clouds', label: 'Clouds' },
];

export default function ClimateMap({ lat, lon, label }: { lat: number; lon: number; label: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [overlay, setOverlay] = useState('rain');
  const [full, setFull] = useState(false);

  useEffect(() => {
    const h = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) box.current?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  };

  // The embed needs no API key, so there is no secret in the browser.
  const src =
    `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}` +
    `&zoom=8&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=&marker=true&calendar=now` +
    `&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1`;

  return (
    <div ref={box} className={full ? 'bg-black' : ''}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="tablist" aria-label="Map layer">
          {OVERLAYS.map((o) => (
            <button key={o.id} role="tab" aria-selected={overlay === o.id} onClick={() => setOverlay(o.id)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium"
              style={overlay === o.id ? { background: 'var(--rain)', color: '#06222b' } : { background: 'rgba(255,255,255,0.07)', color: 'var(--mist)' }}>
              {o.label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={toggle}>{full ? 'Exit fullscreen' : 'Fullscreen'}</button>
      </div>
      <iframe key={`${lat}-${lon}-${overlay}`} title={`Weather map centred on ${label}`} src={src}
        className="w-full rounded-2xl" style={{ border: 'none', height: full ? 'calc(100vh - 70px)' : 440 }} />
    </div>
  );
}
