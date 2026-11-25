'use client';

import { useMemo, useState } from 'react';
import { keccak256, parseUnits, toBytes, formatUnits } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, CROPS, erc20Abi, faucetAbi, playbookAbi, seasonId } from '../lib/contracts';
import { usePlaybooks } from '../hooks/usePlaybooks';
import DistrictSelect from '../components/DistrictSelect';
import PlaybookCard from '../components/PlaybookCard';
import { useForecast } from '../components/ForecastPanel';
import { Card, Field, Heading, NotDeployed, TxButton } from '../components/ui';

const YEAR = new Date().getFullYear();

export default function PlaybooksPage() {
  const { address } = useAccount();
  const { items, isLoading, refetch } = usePlaybooks();
  const [fDistrict, setFDistrict] = useState('all');
  const [fCrop, setFCrop] = useState('all');

  // publish form
  const [district, setDistrict] = useState('Nyagatare');
  const [crop, setCrop] = useState('maize');
  const [idx, setIdx] = useState<1 | 2 | 3>(1);
  const [uri, setUri] = useState('');
  const [stake, setStake] = useState('100');
  const [followDays, setFollowDays] = useState('14');
  const [settleDays, setSettleDays] = useState('150');
  const forecast = useForecast(district);

  const { data: hvstBal, refetch: refetchBal } = useReadContract({
    address: CONTRACTS.HVST, abi: erc20Abi, functionName: 'balanceOf', args: [address!], query: { enabled: !!address },
  });

  const ranked = useMemo(() => {
    const score = (p: (typeof items)[number]) => (p.status === 1 || p.status === 2 || p.status === 3 ? 1e6 + Number(p.resultBps) : p.followerCount);
    return items
      .filter((p) => (fDistrict === 'all' || p.district === fDistrict) && (fCrop === 'all' || p.crop === fCrop))
      .sort((a, b) => score(b) - score(a));
  }, [items, fDistrict, fCrop]);

  const stakeWei = (() => { try { return parseUnits(stake || '0', 18); } catch { return 0n; } })();
  const dataHash = forecast.data ? keccak256(toBytes(JSON.stringify(forecast.data))) : undefined;
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold">District farming plans</h1>
          <p className="mt-2 max-w-2xl" style={{ color: 'var(--muted)' }}>
            Published farming decisions per district, ranked by what cooperatives actually harvested compared with the district
            baseline, so good rains alone don’t win.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Your balance</p>
          <p className="font-display text-2xl font-bold" style={{ color: 'var(--sorghum)' }}>{hvstBal !== undefined ? Number(formatUnits(hvstBal, 18)).toLocaleString() : '–'} HVST</p>
          <div className="mt-2">
            <TxButton variant="ghost" label="Get 500 test HVST" onDone={refetchBal}
              steps={() => [{ address: CONTRACTS.HVSTFaucet, abi: faucetAbi, functionName: 'drip' }]} />
          </div>
        </div>
      </div>

      <NotDeployed />

      <Card>
        <Heading title="Leaderboard" hint="Rewarded and slashed farming plans are settled results. Active ones are ranked by how many cooperatives follow them." />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 md:max-w-lg">
          <select className="field" value={fDistrict} onChange={(e) => setFDistrict(e.target.value)} aria-label="Filter by district">
            <option value="all">All districts</option>
            {Array.from(new Set(items.map((p) => p.district))).map((d) => <option key={d}>{d}</option>)}
          </select>
          <select className="field" value={fCrop} onChange={(e) => setFCrop(e.target.value)} aria-label="Filter by crop">
            <option value="all">All crops</option>
            {CROPS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {isLoading ? <p className="text-sm" role="status">Loading farming plans…</p>
          : ranked.length === 0 ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No farming plans match yet. Publish the first one below.</p>
          : <div className="grid gap-3 md:grid-cols-2">{ranked.map((p, i) => <PlaybookCard key={String(p.id)} pb={p} rank={i + 1} onChanged={() => { refetch(); refetchBal(); }} />)}</div>}
      </Card>

      <Card>
        <Heading title="Publish a farming plan" hint="Stake HVST on your advice. If cooperatives following it beat the district baseline you earn more HVST. If they fall well short, part of your stake is lost." />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="District"><DistrictSelect value={district} onChange={setDistrict} /></Field>
          <Field label="Crop">
            <select className="field" value={crop} onChange={(e) => setCrop(e.target.value)}>{CROPS.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Season">
            <select className="field" value={idx} onChange={(e) => setIdx(Number(e.target.value) as 1 | 2 | 3)}>
              <option value={1}>{YEAR} Season A</option><option value={2}>{YEAR} Season B</option><option value={3}>{YEAR} Season C</option>
            </select>
          </Field>
          <Field label="Link to your action steps" hint="A page or IPFS link with crop variety, planting window and spacing.">
            <input className="field" value={uri} onChange={(e) => setUri(e.target.value)} placeholder="https://… or ipfs://…" />
          </Field>
          <Field label="Stake (HVST)" hint="Minimum 100 HVST.">
            <input className="field" type="number" min="100" value={stake} onChange={(e) => setStake(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Follow window (days)"><input className="field" type="number" min="1" value={followDays} onChange={(e) => setFollowDays(e.target.value)} /></Field>
            <Field label="Settle after (days)"><input className="field" type="number" min="2" value={settleDays} onChange={(e) => setSettleDays(e.target.value)} /></Field>
          </div>
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
          The current {district} forecast is fingerprinted into the farming plans so anyone can later check which data it was based on
          {dataHash ? ` (${dataHash.slice(0, 10)}…).` : '.'}
        </p>
        <div className="mt-4">
          <TxButton label="Approve and publish" labels={['HVST approval', 'farming plans']} onDone={() => { refetch(); refetchBal(); }}
            disabled={!uri.trim() || !dataHash || stakeWei < parseUnits('100', 18) || Number(settleDays) <= Number(followDays)}
            steps={() => [
              { address: CONTRACTS.HVST, abi: erc20Abi, functionName: 'approve', args: [CONTRACTS.PlaybookRegistry, stakeWei] },
              {
                address: CONTRACTS.PlaybookRegistry, abi: playbookAbi, functionName: 'publish',
                args: [{
                  district, crop, season: seasonId(YEAR, idx), uri: uri.trim(), dataHash: dataHash!, stake: stakeWei,
                  followDeadline: BigInt(now + Number(followDays) * 86400), settleAfter: BigInt(now + Number(settleDays) * 86400),
                }],
              },
            ]} />
        </div>
      </Card>
    </div>
  );
}
