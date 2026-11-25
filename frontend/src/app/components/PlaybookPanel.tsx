'use client';
import Link from 'next/link';
import { usePlaybooks } from '../hooks/usePlaybooks';
import { isDeployed } from '../lib/contracts';
import PlaybookCard from './PlaybookCard';

export default function PlaybookPanel({ district }: { district: string }) {
  const { items, isLoading, refetch } = usePlaybooks();
  const local = items.filter((p) => p.district === district).sort((a, b) => b.followerCount - a.followerCount);

  if (!isDeployed) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Deploy the contracts to see on-chain farming plans here.</p>;
  if (isLoading) return <p className="text-sm" role="status">Loading farming plans…</p>;
  if (local.length === 0) {
    return (
      <div className="glass-inner p-5 text-sm">
        <p className="font-semibold">No farming plans for {district} yet.</p>
        <p className="mt-1" style={{ color: 'var(--muted)' }}>Agronomists and experienced farmers can publish the first one and stake HVST on it.</p>
        <Link href="/playbooks" className="btn btn-primary mt-3">Publish a farming plan</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {local.slice(0, 4).map((p) => <PlaybookCard key={String(p.id)} pb={p} onChanged={refetch} />)}
    </div>
  );
}
