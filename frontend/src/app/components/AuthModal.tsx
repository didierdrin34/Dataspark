'use client';
import { useConnect } from 'wagmi';

export default function AuthModal({ onClose }: { mode?: string; onClose: () => void; onSwitch?: (m: string) => void }) {
  const { connectors, connect } = useConnect();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,12,14,0.7)', backdropFilter: 'blur(6px)' }}
      role="dialog" aria-modal="true" aria-label="Connect wallet">
      <div className="glass w-full max-w-md p-6">
        <h2 className="font-display text-2xl font-bold mb-1">Connect your wallet</h2>
        <p className="mb-5 text-sm" style={{ color: 'var(--muted)' }}>
          Your Sepolia wallet address is your identity on DataSpark. No email or password needed.
        </p>
        <div className="space-y-2">
          {connectors.map((c) => (
            <button key={c.id} className="btn btn-primary w-full"
              onClick={() => { connect({ connector: c }); onClose(); }}>
              {c.name}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost mt-4 w-full" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
