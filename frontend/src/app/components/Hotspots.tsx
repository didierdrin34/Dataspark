'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchHotspots } from '../lib/forecast';

export default function Hotspots({ onSelect, selected }: { onSelect: (d: string) => void; selected: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['hotspots'], queryFn: fetchHotspots, staleTime: 10 * 60_000 });
  if (isLoading) return <p className="text-sm" role="status">Scanning all 30 districts…</p>;
  if (error || !data) return <p className="text-sm" role="alert" style={{ color: 'var(--storm)' }}>{(error as Error)?.message}</p>;

  return (
    <ul className="space-y-2">
      {data.slice(0, 8).map(({ district, risk, rain3dMm }) => {
        const c = risk.score >= 50 ? 'var(--storm)' : risk.score >= 25 ? 'var(--sorghum)' : 'var(--terrace)';
        return (
          <li key={district.name}>
            <button onClick={() => onSelect(district.name)} className="glass-inner w-full p-3 text-left transition-colors hover:bg-white/5"
              style={selected === district.name ? { borderColor: 'var(--rain)' } : undefined}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{district.name} <span className="font-normal" style={{ color: 'var(--muted)' }}>· {district.province}</span></span>
                <span style={{ color: c }}>{risk.label}</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(4, risk.score)}%`, background: c }} />
              </div>
              <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>{rain3dMm.toFixed(0)} mm rain in the next 3 days</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
