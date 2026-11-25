'use client';
import { useState } from 'react';
import { formatUnits } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { Sprout, Bean, Wheat, Leaf, Coffee, FlaskConical, Droplets, TreePine, TrendingUp, TrendingDown, Minus, Clock, Users } from 'lucide-react';
import { CONTRACTS, PLAYBOOK_STATUS, playbookAbi, registryAbi, seasonLabel, short, type PlaybookView } from '../lib/contracts';
import { Pill, TxButton } from './ui';

const tone = (s: number) => (['sorghum', 'terrace', 'mist', 'storm', 'mist'] as const)[s];

function CropIcon({ crop, size = 28 }: { crop: string; size?: number }) {
  const c = crop.toLowerCase();
  const style = { color: 'var(--terrace)' };
  if (c === 'maize') return <Wheat size={size} style={style} />;
  if (c === 'beans') return <Bean size={size} style={style} />;
  if (c === 'irish potato') return <Sprout size={size} style={style} />;
  if (c === 'rice') return <Droplets size={size} style={style} />;
  if (c === 'cassava') return <TreePine size={size} style={style} />;
  if (c === 'sorghum') return <Wheat size={size} style={{ color: 'var(--sorghum)' }} />;
  if (c === 'coffee') return <Coffee size={size} style={style} />;
  if (c === 'tea') return <Leaf size={size} style={style} />;
  return <FlaskConical size={size} style={style} />;
}

export default function PlaybookCard({ pb, rank, onChanged }: { pb: PlaybookView; rank?: number; onChanged?: () => void }) {
  const { address } = useAccount();
  const [ha, setHa] = useState('1');
  const now = Math.floor(Date.now() / 1000);

  const [coopIdInput, setCoopIdInput] = useState('');

  const { data: chairCoopId } = useReadContract({
    address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'coopIdOfChair',
    args: [address!], query: { enabled: !!address },
  });
  const coopId = (chairCoopId && chairCoopId > 0n) ? chairCoopId : (coopIdInput ? BigInt(coopIdInput) : 0n);
  const isChair = !!chairCoopId && chairCoopId > 0n;

  const { data: already } = useReadContract({
    address: CONTRACTS.PlaybookRegistry, abi: playbookAbi, functionName: 'hasFollowed',
    args: [pb.id, coopId], query: { enabled: coopId > 0n },
  });
  const { data: score } = useReadContract({
    address: CONTRACTS.PlaybookRegistry, abi: playbookAbi, functionName: 'authorScore', args: [pb.author],
  });

  const active = pb.status === 0;
  const withinWindow = now <= Number(pb.followDeadline);
  const showCoopInput = active && withinWindow && !!address && !isChair;
  const canFollow = active && withinWindow && !!address && coopId > 0n && !already;
  const canSettle = active && now >= Number(pb.settleAfter);
  const bps = Number(pb.resultBps) / 100;
  const days = Math.max(0, Math.ceil((Number(pb.followDeadline) - now) / 86400));

  return (
    <article className="glass-inner p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(143,209,107,0.12)' }}>
          <CropIcon crop={pb.crop} size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold">
                {rank ? <span style={{ color: 'var(--sorghum)' }}>#{rank} </span> : null}
                {pb.crop[0].toUpperCase() + pb.crop.slice(1)} in {pb.district}
              </h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {seasonLabel(pb.season)} · by {short(pb.author)}
                {score !== undefined ? ` · score ${Number(score) >= 0 ? '+' : ''}${Number(score).toFixed(0)}` : ''}
              </p>
            </div>
            <Pill tone={tone(pb.status)}>{PLAYBOOK_STATUS[pb.status]}</Pill>
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="glass-inner p-2 text-center">
          <dt className="text-xs" style={{ color: 'var(--muted)' }}>Staked</dt>
          <dd className="font-semibold mt-0.5" style={{ color: 'var(--sorghum)' }}>{Number(formatUnits(pb.stake, 18)).toLocaleString()} HVST</dd>
        </div>
        <div className="glass-inner p-2 text-center">
          <dt className="flex items-center justify-center gap-1 text-xs" style={{ color: 'var(--muted)' }}><Users size={11} /> Coops</dt>
          <dd className="font-semibold mt-0.5">{pb.followerCount}</dd>
        </div>
        <div className="glass-inner p-2 text-center">
          <dt className="text-xs" style={{ color: 'var(--muted)' }}>vs baseline</dt>
          <dd className="font-semibold mt-0.5 flex items-center justify-center gap-1"
            style={{ color: pb.status === 0 ? 'var(--muted)' : bps >= 0 ? 'var(--terrace)' : 'var(--storm)' }}>
            {pb.status === 0 ? <Minus size={12} /> : bps >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {pb.status === 0 ? 'pending' : pb.status === 4 ? 'n/a' : `${bps >= 0 ? '+' : ''}${bps.toFixed(1)}%`}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm break-all">
        Steps: {pb.uri.startsWith('http') ? <a className="underline" style={{ color: 'var(--rain)' }} href={pb.uri} target="_blank" rel="noreferrer">{pb.uri}</a> : pb.uri}
      </p>

      {showCoopInput && (
        <div className="mt-3">
          <label className="text-xs flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            Your cooperative #
            <input className="field inline-block w-20" type="number" min="1" value={coopIdInput}
              onChange={(e) => setCoopIdInput(e.target.value)} placeholder="1" />
          </label>
        </div>
      )}

      {(canFollow || canSettle) && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {canFollow && (
            <>
              <label className="text-sm flex items-center gap-1">
                <Clock size={13} style={{ color: 'var(--muted)' }} />
                Hectares to plant
                <input className="field mt-1 w-28" type="number" min="0.1" step="0.1" value={ha} onChange={(e) => setHa(e.target.value)} />
              </label>
              <TxButton label={`Follow (${days}d left)`} onDone={onChanged}
                steps={() => [{ address: CONTRACTS.PlaybookRegistry, abi: playbookAbi, functionName: 'follow', args: [pb.id, coopId, Math.round(Number(ha) * 100)] }]}
                disabled={!(Number(ha) > 0)} />
            </>
          )}
          {canSettle && (
            <TxButton label="Settle season" variant="rain" onDone={onChanged}
              steps={() => [{ address: CONTRACTS.PlaybookRegistry, abi: playbookAbi, functionName: 'settle', args: [pb.id] }]} />
          )}
        </div>
      )}
      <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>Advice, not a guarantee. Results are measured against the district baseline.</p>
    </article>
  );
}
