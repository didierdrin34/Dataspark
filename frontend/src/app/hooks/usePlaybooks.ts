'use client';
import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, isDeployed, playbookAbi, type PlaybookView } from '../lib/contracts';

export function usePlaybooks() {
  const { data: count } = useReadContract({
    address: CONTRACTS.PlaybookRegistry,
    abi: playbookAbi,
    functionName: 'playbookCount',
    query: { enabled: isDeployed },
  });
  const n = Number(count ?? 0n);
  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  const { data, refetch, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACTS.PlaybookRegistry,
      abi: playbookAbi,
      functionName: 'getPlaybook',
      args: [id],
    })) as any,
    query: { enabled: isDeployed && n > 0 },
  });
  const items: PlaybookView[] = ((data as any[]) ?? [])
    .map((r, i) => (r?.status === 'success' ? ({ id: ids[i], ...(r.result as object) } as PlaybookView) : null))
    .filter(Boolean) as PlaybookView[];
  return { items, count: n, isLoading, refetch };
}
