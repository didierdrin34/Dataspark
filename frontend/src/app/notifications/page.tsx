'use client';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { readFromNeon, syncToNeon, writeWalletData } from '../lib/walletStorage';

interface LightningRiskZone {
  lat: number;
  lon: number;
  riskLevel: number;
  windSpeed: number;
  windDirection: number;
}

export default function NotificationsPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [zones, setZones] = useState<LightningRiskZone[]>([]);

  useEffect(() => {
    if (!isConnected) { router.push('/'); return; }
    readFromNeon<LightningRiskZone[]>(address, 'notifications:zones', []).then(setZones);
  }, [address, isConnected, router]);

  useEffect(() => {
    if (!isConnected) return;
    const generate = () => {
      const zone: LightningRiskZone = {
        lat: -1.9403 + (Math.random() * 2 - 1),
        lon: 29.8739 + (Math.random() * 2 - 1),
        windSpeed: Math.floor(Math.random() * 41) + 10,
        windDirection: Math.floor(Math.random() * 361),
        riskLevel: Math.min(100, Math.floor(Math.random() * 80 + 20)),
      };
      setZones((prev) => {
        const next = [zone, ...prev].slice(0, 5).sort((a, b) => b.riskLevel - a.riskLevel);
        writeWalletData(address, 'notifications:zones', next);
        syncToNeon(address, 'notifications:zones', next);
        return next;
      });
    };
    generate();
    const id = setInterval(generate, 3_600_000);
    return () => clearInterval(id);
  }, [address, isConnected]);

  if (!isConnected) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <Link href="/" className="text-sm" style={{ color: 'var(--muted)' }}>← Back</Link>
      <h1 className="font-display text-3xl font-extrabold">Lightning Risk Notifications</h1>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Wallet: <span className="font-mono">{address}</span></p>

      {zones.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Analysing wind patterns…</p>
      ) : (
        <ul className="space-y-3">
          {zones.map((z, i) => (
            <li key={i} className="glass p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Zone {i + 1}</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{z.lat.toFixed(4)}, {z.lon.toFixed(4)} · {z.windSpeed} kn from {z.windDirection}°</p>
              </div>
              <span className="rounded px-3 py-1 text-sm font-medium"
                style={{ background: z.riskLevel > 70 ? 'rgba(240,113,90,0.2)' : z.riskLevel > 40 ? 'rgba(255,180,50,0.2)' : 'rgba(92,200,232,0.15)', color: z.riskLevel > 70 ? 'var(--storm)' : z.riskLevel > 40 ? 'var(--sorghum)' : 'var(--rain)' }}>
                {z.riskLevel}% risk
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
