'use client';
import { useAccount, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { EXPLORER, isDeployed } from '../lib/contracts';
import { useTx } from '../hooks/useTx';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass p-5 md:p-6 ${className}`}>{children}</section>;
}

export function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl md:text-2xl font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm max-w-prose" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs" style={{ color: 'var(--muted)' }}>{hint}</span>}
    </label>
  );
}

export function Pill({ children, tone = 'mist' }: { children: React.ReactNode; tone?: 'mist' | 'rain' | 'terrace' | 'sorghum' | 'storm' }) {
  const c = { mist: 'var(--muted)', rain: 'var(--rain)', terrace: 'var(--terrace)', sorghum: 'var(--sorghum)', storm: 'var(--storm)' }[tone];
  return (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: c, background: 'rgba(255,255,255,0.06)', border: `1px solid ${c}55` }}>
      {children}
    </span>
  );
}

export function NotDeployed() {
  if (isDeployed) return null;
  return (
    <div className="glass-inner mb-6 p-4 text-sm" style={{ borderColor: 'var(--sorghum)' }}>
      <strong>Contracts are not deployed yet.</strong> Run <code>npm run deploy:sepolia</code> in <code>/hardhat-contract</code>.
      It writes <code>frontend/lib/deployments.json</code> automatically, then reload this page.
    </div>
  );
}

export function TxStatus({ state }: { state: ReturnType<typeof useTx>['state'] }) {
  if (state.status === 'idle') return null;
  const link = state.hash && (
    <a className="underline ml-1" style={{ color: 'var(--rain)' }} href={`${EXPLORER}/tx/${state.hash}`} target="_blank" rel="noreferrer">
      view on Etherscan
    </a>
  );
  if (state.status === 'wallet') return <p className="mt-2 text-sm" role="status">Confirm {state.step?.toLowerCase()} in your wallet…</p>;
  if (state.status === 'pending') return <p className="mt-2 text-sm" role="status">Waiting for the network to confirm…{link}</p>;
  if (state.status === 'done') return <p className="mt-2 text-sm" role="status" style={{ color: 'var(--terrace)' }}>Done.{link}</p>;
  return <p className="mt-2 text-sm" role="alert" style={{ color: 'var(--storm)' }}>{state.error}</p>;
}

/** One button for any contract write: handles wallet + network checks, multi-step flows and status. */
export function TxButton({
  label, steps, labels, onDone, disabled, variant = 'primary', className = '',
}: {
  label: string;
  steps: () => any[];
  labels?: string[];
  onDone?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'rain';
  className?: string;
}) {
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { run, state } = useTx();
  const wrong = isConnected && chainId !== sepolia.id;
  const cls = `btn ${variant === 'primary' ? 'btn-primary' : variant === 'rain' ? 'btn-rain' : 'btn-ghost'} ${className}`;

  if (!isConnected) return <button className={cls} disabled>Connect wallet to continue</button>;
  if (wrong) return <button className={cls} onClick={() => switchChain({ chainId: sepolia.id })}>Switch to Sepolia</button>;
  return (
    <div>
      <button
        className={cls}
        disabled={disabled || !isDeployed || state.status === 'wallet' || state.status === 'pending'}
        onClick={async () => { if (await run(steps(), labels)) onDone?.(); }}
      >
        {state.status === 'wallet' || state.status === 'pending' ? 'Working…' : label}
      </button>
      <TxStatus state={state} />
    </div>
  );
}
