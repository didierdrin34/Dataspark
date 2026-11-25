import { FlaskConical } from 'lucide-react';

export default function TestnetBanner() {
  return (
    <div className="flex items-center justify-center gap-2 text-center text-xs md:text-sm py-1.5 px-4" style={{ background: 'rgba(232,176,74,0.14)', color: 'var(--sorghum)' }}>
      <FlaskConical size={13} />
      Sepolia testnet — HVST and mRWF are test tokens with no monetary value.
    </div>
  );
}
