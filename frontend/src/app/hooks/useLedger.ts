'use client';
import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, isDeployed, ledgerAbi, type BatchView, type DeliveryView } from '../lib/contracts';

function useCount(fn: 'batchCount' | 'deliveryCount') {
  const { data, refetch } = useReadContract({
    address: CONTRACTS.HarvestLedger,
    abi: ledgerAbi,
    functionName: fn,
    query: { enabled: isDeployed },
  });
  return { n: Number(data ?? 0n), refetch };
}

export function useBatches(coopId?: bigint) {
  const { n, refetch: refetchCount } = useCount('batchCount');
  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  const { data, refetch } = useReadContracts({
    contracts: ids.map((id) => ({ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'getBatch', args: [id] })) as any,
    query: { enabled: isDeployed && n > 0 },
  });
  const all: BatchView[] = ((data as any[]) ?? [])
    .map((r, i) => (r?.status === 'success' ? ({ id: ids[i], ...(r.result as object) } as BatchView) : null))
    .filter(Boolean) as BatchView[];
  const items = coopId ? all.filter((b) => b.coopId === coopId) : all;
  return { items: items.reverse(), total: n, refetch: () => { refetchCount(); refetch(); } };
}

export function useDeliveries(batchIds: bigint[]) {
  const { n, refetch: refetchCount } = useCount('deliveryCount');
  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  const { data, refetch } = useReadContracts({
    contracts: ids.map((id) => ({ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'getDelivery', args: [id] })) as any,
    query: { enabled: isDeployed && n > 0 },
  });
  const set = new Set(batchIds.map(String));
  const items: DeliveryView[] = ((data as any[]) ?? [])
    .map((r, i) => (r?.status === 'success' ? ({ id: ids[i], ...(r.result as object) } as DeliveryView) : null))
    .filter((d): d is DeliveryView => !!d && set.has(String(d.batchId)));
  return { items: items.reverse(), total: n, refetch: () => { refetchCount(); refetch(); } };
}
