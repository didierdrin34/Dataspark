'use client';
import { useReadContracts } from 'wagmi';
import { CONTRACTS, isDeployed, ledgerAbi, playbookAbi, registryAbi } from '../lib/contracts';

export default function ChainPulse() {
  const { data } = useReadContracts({
    contracts: [
      { address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'cooperativeCount' },
      { address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'batchCount' },
      { address: CONTRACTS.PlaybookRegistry, abi: playbookAbi, functionName: 'playbookCount' },
    ] as any,
    query: { enabled: isDeployed },
  });
  const v = (i: number) => (data && (data as any)[i]?.status === 'success' ? String((data as any)[i].result) : '–');
  const items = [
    { n: v(0), l: 'cooperatives on the ledger' },
    { n: v(1), l: 'harvest batches traced' },
    { n: v(2), l: 'district playbooks' },
  ];
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      {items.map((i) => (
        <div key={i.l}>
          <dd className="font-display text-3xl font-bold" style={{ color: 'var(--sorghum)' }}>{i.n}</dd>
          <dt className="text-sm" style={{ color: 'var(--muted)' }}>{i.l}</dt>
        </div>
      ))}
    </dl>
  );
}
