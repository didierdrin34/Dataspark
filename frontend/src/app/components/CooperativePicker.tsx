'use client';

import { useMemo, useState } from 'react';
import { BadgeCheck, Building2, Search, UserCheck } from 'lucide-react';
import { short, type CoopInfo } from '../lib/contracts';
import { useCooperatives } from '../hooks/useCooperatives';

/**
 * Directory of every cooperative registered on-chain.
 *
 * Any wallet can browse and select any cooperative: the DataSpark deployer uses it to approve
 * cooperatives it does not chair, and cooperative members use it to reach their own desk.
 */
export default function CooperativePicker({
  value,
  onChange,
  mine = [],
  label = 'Cooperative',
}: {
  value: bigint;
  onChange: (id: bigint) => void;
  /** Cooperatives where the connected wallet is chairperson or officer. */
  mine?: bigint[];
  label?: string;
}) {
  const { items, isLoading } = useCooperatives();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        String(c.id) === q ||
        `#${String(c.id)}` === q,
    );
  }, [items, query]);

  return (
    <div>
      <p className="mb-1 text-sm font-medium flex items-center gap-1.5">
        <Building2 size={13} style={{ color: 'var(--rain)' }} /> {label}
      </p>
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
        <input
          className="field pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, district or #id"
        />
      </div>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
        {isLoading && <li className="text-sm" style={{ color: 'var(--muted)' }}>Loading cooperatives…</li>}
        {!isLoading && filtered.length === 0 && (
          <li className="text-sm" style={{ color: 'var(--muted)' }}>No cooperative matches that search.</li>
        )}
        {filtered.map((c) => (
          <li key={String(c.id)}>
            <button
              type="button"
              onClick={() => onChange(c.id)}
              aria-pressed={c.id === value}
              className="w-full rounded-lg px-3 py-2 text-left text-sm flex items-center justify-between gap-2"
              style={
                c.id === value
                  ? { background: 'var(--rain)', color: '#06222b' }
                  : { background: 'rgba(255,255,255,0.05)' }
              }
            >
              <span className="min-w-0 flex items-center gap-2">
                <span className="font-mono text-xs opacity-80">#{String(c.id)}</span>
                <span className="truncate">{c.name}</span>
                <span className="text-xs opacity-75">· {c.district}</span>
              </span>
              <span className="flex flex-shrink-0 items-center gap-1.5">
                {mine.includes(c.id) && <UserCheck size={12} aria-label="Your cooperative" />}
                {c.verified ? <BadgeCheck size={12} aria-label="Verified" /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
        Every registered cooperative is listed. Chair of <span className="font-mono">{short(mine.length ? `#${String(mine[0])}` : '—')}</span>
        {mine.length > 1 ? ` and ${mine.length - 1} more` : ''}.
      </p>
    </div>
  );
}

export type { CoopInfo };
