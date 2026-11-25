'use client';
import { useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { sepolia } from 'wagmi/chains';

export type TxState = {
  status: 'idle' | 'wallet' | 'pending' | 'done' | 'error';
  step?: string;
  hash?: `0x${string}`;
  error?: string;
};

function friendly(e: any): string {
  const msg: string = e?.shortMessage || e?.message || 'Transaction failed';
  if (/user rejected|denied/i.test(msg)) return 'You cancelled the transaction in your wallet.';
  const m = msg.match(/reverted with the following reason:\s*(.+?)(\n|$)/i);
  if (m) return `The contract rejected it: ${m[1]}`;
  return msg.split('\n')[0];
}

/** Runs one or more contract writes in order, waiting for each receipt. */
export function useTx() {
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: sepolia.id });
  const [state, setState] = useState<TxState>({ status: 'idle' });

  const run = async (steps: any[], labels?: string[]): Promise<boolean> => {
    try {
      for (let i = 0; i < steps.length; i++) {
        const label = labels?.[i] ?? `Step ${i + 1} of ${steps.length}`;
        setState({ status: 'wallet', step: label });
        const hash = await writeContractAsync({ ...steps[i], chainId: sepolia.id });
        setState({ status: 'pending', step: label, hash });
        await client!.waitForTransactionReceipt({ hash });
        if (i === steps.length - 1) setState({ status: 'done', hash });
      }
      return true;
    } catch (e) {
      setState({ status: 'error', error: friendly(e) });
      return false;
    }
  };

  return { run, state, reset: () => setState({ status: 'idle' }) };
}
