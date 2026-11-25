'use client';
import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, ledgerAbi, short } from '../lib/contracts';

/** Shows how a released batch was split between farmers by kg share (member hashes only, no personal data). */
export default function PayoutSplit({ batchId }: { batchId: bigint }) {
  const { data: members } = useReadContract({ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'batchMembers', args: [batchId] });
  const list = (members as `0x${string}`[] | undefined) ?? [];
  const { data } = useReadContracts({
    contracts: list.flatMap((m) => [
      { address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'batchMemberKg', args: [batchId, m] },
      { address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'batchMemberPayout', args: [batchId, m] },
    ]) as any,
    query: { enabled: list.length > 0 },
  });
  if (list.length === 0) return null;
  return (
    <table className="mt-3 w-full text-sm">
      <thead><tr className="text-left" style={{ color: 'var(--muted)' }}><th className="py-1 font-medium">Member</th><th className="font-medium">Kg</th><th className="text-right font-medium">Paid (mRWF)</th></tr></thead>
      <tbody>
        {list.map((m, i) => {
          const kg = (data as any)?.[i * 2]?.result;
          const pay = (data as any)?.[i * 2 + 1]?.result;
          return (
            <tr key={m} className="border-t" style={{ borderColor: 'var(--panel-line)' }}>
              <td className="py-1.5 font-mono text-xs">{short(m, 5)}</td>
              <td>{kg !== undefined ? String(kg) : '–'}</td>
              <td className="text-right font-semibold" style={{ color: 'var(--terrace)' }}>{pay !== undefined ? Number(pay).toLocaleString() : '–'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
