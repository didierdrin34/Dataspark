'use client';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { short } from '../lib/contracts';

export default function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="text-right">
        <button className="btn btn-ghost" disabled={isPending} onClick={() => connect({ connector: connectors[0] })}>
          {isPending ? 'Connecting…' : 'Connect wallet'}
        </button>
        {error && <p className="mt-1 text-xs" style={{ color: 'var(--storm)' }}>No wallet found. Install MetaMask.</p>}
      </div>
    );
  }
  if (chainId !== sepolia.id) {
    return <button className="btn btn-primary" onClick={() => switchChain({ chainId: sepolia.id })}>Switch to Sepolia</button>;
  }
  return (
    <button className="btn btn-ghost" onClick={() => disconnect()} title="Disconnect wallet">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--terrace)' }} />
      {short(address ?? '')}
    </button>
  );
}
