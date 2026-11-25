'use client';
import { useEffect, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { readFromNeon, syncToNeon, writeWalletData } from '../lib/walletStorage';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isConnected) { router.push('/'); return; }
    readFromNeon<string>(address, 'profile:notes', '').then(setNotes);
  }, [address, isConnected, router]);

  const save = () => {
    writeWalletData(address, 'profile:notes', notes);
    syncToNeon(address, 'profile:notes', notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isConnected || !address) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <Link href="/" className="text-sm" style={{ color: 'var(--muted)' }}>← Back</Link>
      <h1 className="font-display text-3xl font-extrabold">Profile</h1>

      <div className="glass p-5 space-y-3">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Connected wallet</p>
        <p className="font-mono text-sm break-all">{address}</p>
        <button className="btn btn-ghost" onClick={() => { disconnect(); router.push('/'); }}>Disconnect</button>
      </div>

      <div className="glass p-5 space-y-3">
        <label className="block text-sm font-medium">Notes (saved per wallet)</label>
        <textarea className="field w-full h-28 resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Your private notes…" />
        <button className="btn btn-primary" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
      </div>
    </div>
  );
}
