'use client';
import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, DEPLOYER, isDeployed, registryAbi, type CoopInfo } from '../lib/contracts';

/**
 * The full on-chain cooperative directory.
 *
 * Any connected wallet may read it — a farmer, a buyer, a chairperson or the DataSpark deployer —
 * so the app is never limited to the cooperatives a single wallet happens to chair.
 *
 * `listCooperatives` returns the whole directory in one call. If the registry deployed on chain
 * predates that view, the hook falls back to `cooperativeCount` + `getCooperative` per id so the UI
 * keeps working across contract upgrades.
 */
export function useCooperatives() {
  const list = useReadContract({
    address: CONTRACTS.CooperativeRegistry,
    abi: registryAbi,
    functionName: 'listCooperatives',
    query: { enabled: isDeployed },
  });

  const viewMissing = !!list.error;
  const { data: count } = useReadContract({
    address: CONTRACTS.CooperativeRegistry,
    abi: registryAbi,
    functionName: 'cooperativeCount',
    query: { enabled: isDeployed && viewMissing },
  });

  const total = Number(count ?? 0n);
  const ids = Array.from({ length: viewMissing ? total : 0 }, (_, i) => BigInt(i + 1));
  const fallback = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACTS.CooperativeRegistry,
      abi: registryAbi,
      functionName: 'getCooperative',
      args: [id],
    })) as any,
    query: { enabled: isDeployed && viewMissing && total > 0 },
  });

  const rows: CoopInfo[] = viewMissing
    ? ((fallback.data as any[]) ?? [])
        .map((r, i) =>
          r?.status === 'success'
            ? ({ id: ids[i], members: 0n, ...(r.result as object) } as CoopInfo)
            : null,
        )
        .filter(Boolean) as CoopInfo[]
    : ((list.data as CoopInfo[] | undefined) ?? []);

  const items = rows
    .filter((c) => c.chair !== '0x0000000000000000000000000000000000000000')
    .map((c) => ({ ...c, id: BigInt(c.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const verifiedOnly = items.filter((c) => c.verified && c.active);

  return {
    items,
    verifiedOnly,
    isLoading: list.isLoading || (viewMissing && (fallback.isLoading || total === 0)),
    refetch: () => {
      list.refetch();
      fallback.refetch();
    },
  };
}

/** Per-wallet flags used to decide which controls a page should show. */
export function useRegistryRoles(address?: `0x${string}`) {
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'coopIdOfChair', args: [address!] },
      { address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'isAdmin', args: [address!] },
    ] as any,
    query: { enabled: isDeployed && !!address },
  });

  const rows = (data as any[] | undefined) ?? [];
  const chairedCoopId = rows[0]?.status === 'success' ? (rows[0].result as bigint) : 0n;
  const onChainAdmin = rows[1]?.status === 'success' ? (rows[1].result as boolean) : false;
  // The wallet that deployed the contracts is always DataSpark staff, even against an older registry
  // that has no `isAdmin` view.
  const isDeployer = !!address && address.toLowerCase() === DEPLOYER.toLowerCase();

  return { chairedCoopId: chairedCoopId ?? 0n, isAdmin: onChainAdmin || isDeployer, refetch };
}
