'use client';
import { useReadContracts } from 'wagmi';
import { Building2, Layers, BookOpen } from 'lucide-react';
import { CONTRACTS, isDeployed, ledgerAbi, playbookAbi, registryAbi } from '../lib/contracts';

const ITEMS = [
  { icon: <Building2 size={16} />, label: 'cooperatives on the ledger' },
  { icon: <Layers size={16} />, label: 'harvest batches traced' },
  { icon: <BookOpen size={16} />, label: 'district playbooks' },
];

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

  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      {ITEMS.map((item, i) => (
        <div key={item.label}>
          <dd className="font-display text-3xl font-bold flex items-center gap-2" style={{ color: 'var(--sorghum)' }}>
            {v(i)}
          </dd>
          <dt className="text-sm flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--muted)' }}>
            {item.icon}{item.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
