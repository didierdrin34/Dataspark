'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import WalletButton from './WalletButton';

const LINKS = [
  { href: '/', label: 'Climate' },
  { href: '/playbooks', label: 'Farming plans' },
  { href: '/cooperative', label: 'Cooperatives' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address } = useAccount();

  return (
    <header className="sticky top-0 z-40" style={{ background: 'rgba(12,27,31,0.82)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--panel-line)' }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display text-2xl font-extrabold" style={{ color: 'var(--mist)' }}>
            Data<span style={{ color: 'var(--rain)' }}>Spark</span>
          </Link>
          <nav className="flex gap-1" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={pathname === l.href ? { background: 'rgba(92,200,232,0.16)', color: 'var(--rain)' } : { color: 'var(--muted)' }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <WalletButton />
          {address && (
            <>
              <Link href="/notifications" className="btn btn-ghost hidden sm:inline-flex">Notifications</Link>
              <Link href="/profile" aria-label="Profile"
                className="flex h-10 w-10 items-center justify-center rounded-full font-mono text-xs font-bold"
                style={{ background: 'var(--rain)', color: '#06222b' }}>
                {address.slice(2, 4).toUpperCase()}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
