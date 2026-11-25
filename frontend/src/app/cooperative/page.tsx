'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useReadContracts, useWatchContractEvent } from 'wagmi';
import {
  BATCH_STATUS, CONTRACTS, CROPS, addressMemberKey, erc20Abi, ledgerAbi,
  mockRwfAbi, registryAbi, seasonId, seasonLabel, short, voucherAbi,
} from '../lib/contracts';
import { readFromNeon, syncToNeon } from '../lib/walletStorage';
import { useBatches, useDeliveries } from '../hooks/useLedger';
import { useRegistryRoles } from '../hooks/useCooperatives';
import CooperativePicker from '../components/CooperativePicker';
import DistrictSelect from '../components/DistrictSelect';
import PayoutSplit from '../components/PayoutSplit';
import { Card, Field, Heading, NotDeployed, Pill, TxButton } from '../components/ui';
import {
  Users, UserCheck, ShieldCheck, Truck, Package, Wallet,
  BadgeCheck, AlertTriangle, CheckCircle2, XCircle, ClipboardList,
  Coins, UserPlus, Building2,
} from 'lucide-react';

const YEAR = new Date().getFullYear();
type Tab = 'overview' | 'deliveries' | 'batches' | 'vouchers';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Building2 size={14} /> },
  { id: 'deliveries', label: 'Deliveries', icon: <Truck size={14} /> },
  { id: 'batches', label: 'Batches & payment', icon: <Package size={14} /> },
  { id: 'vouchers', label: 'Input vouchers', icon: <Coins size={14} /> },
];

export default function CooperativePage() {
  const { address } = useAccount();
  const [tab, setTab] = useState<Tab>('overview');
  /** Cooperative the wallet is looking at. Defaults to the one it chairs; any wallet may pick another. */
  const [pickedId, setPickedId] = useState<bigint | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [officers, setOfficers] = useState<string[]>([]);
  const [memberWallets, setMemberWallets] = useState<string[]>([]);

  const { chairedCoopId, isAdmin, refetch: refetchRoles } = useRegistryRoles(address);
  const myId = chairedCoopId;
  const coopId = pickedId ?? (myId > 0n ? myId : 0n);

  const { data: coopRaw, refetch: refetchCoop } = useReadContract({
    address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'getCooperative', args: [coopId], query: { enabled: coopId > 0n },
  });
  const coop = coopRaw as { name: string; district: string; chair: `0x${string}`; verified: boolean; active: boolean } | undefined;
  const exists = !!coop && coop.chair !== '0x0000000000000000000000000000000000000000';

  const { data: officerFlag } = useReadContract({
    address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'isOfficer', args: [coopId, address!], query: { enabled: coopId > 0n && !!address },
  });
  const { data: stats, refetch: refetchStats } = useReadContracts({
    contracts: [
      { address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'memberCount', args: [coopId] },
      { address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'coopScore', args: [coopId] },
      { address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'twoSignerRequired' },
    ] as any,
    query: { enabled: coopId > 0n },
  });

  // Watch OfficerSet events to build officer list
  useWatchContractEvent({
    address: CONTRACTS.CooperativeRegistry,
    abi: registryAbi,
    eventName: 'OfficerSet',
    onLogs(logs) {
      const updated: string[] = [];
      for (const log of logs as any[]) {
        const { id, officer, allowed } = log.args ?? {};
        if (id === coopId) {
          if (allowed && !updated.includes(officer)) updated.push(officer);
        }
      }
      if (updated.length) setOfficers((prev) => Array.from(new Set([...prev, ...updated])));
    },
  });

  // Load persisted member wallets from Neon keyed by chair wallet + coopId
  useEffect(() => {
    if (!exists || !coop) return;
    readFromNeon<string[]>(coop.chair, `coop:members:${String(coopId)}`, []).then(setMemberWallets);
  }, [exists, coop?.chair, String(coopId)]);

  const saveMemberWallets = (list: string[]) => {
    setMemberWallets(list);
    if (coop) syncToNeon(coop.chair, `coop:members:${String(coopId)}`, list);
  };

  const isChair = !!address && exists && coop!.chair.toLowerCase() === address.toLowerCase();
  const isStaff = isChair || !!officerFlag;
  /** Cooperative staff or DataSpark staff: both may record, approve and seal on any cooperative. */
  const canOperate = isStaff || isAdmin;
  const ready = exists && coop!.verified && coop!.active;
  const role = isChair ? 'Chairperson' : officerFlag ? 'Officer' : isAdmin ? 'DataSpark admin' : 'Viewer';
  const myCoopIds = myId > 0n ? [myId] : [];
  const members = (stats as any)?.[0]?.result as bigint | undefined;
  const score = (stats as any)?.[1]?.result as bigint | undefined;
  const twoSigner = (stats as any)?.[2]?.result as boolean | undefined;

  const batches = useBatches(exists ? coopId : undefined);
  const deliveries = useDeliveries(batches.items.map((b) => b.id));
  const refreshAll = () => { refetchCoop(); refetchRoles(); refetchStats(); batches.refetch(); deliveries.refetch(); };

  const [name, setName] = useState('');
  const [district, setDistrict] = useState('Nyagatare');
  const [memberWallet, setMemberWallet] = useState('');
  const [plotHa, setPlotHa] = useState('1');
  const [officer, setOfficer] = useState('');
  const [crop, setCrop] = useState('maize');
  const [idx, setIdx] = useState<1 | 2 | 3>(1);
  const [batchSel, setBatchSel] = useState('');
  const [dMember, setDMember] = useState('');
  const [kg, setKg] = useState('');
  const [grade, setGrade] = useState(1);
  const [pay, setPay] = useState<Record<string, string>>({});
  const [lookup, setLookup] = useState('');

  const openBatches = batches.items.filter((b) => b.status === 0);
  const lookupKey = lookup.trim() ? addressMemberKey(lookup) : undefined;
  const { data: usable } = useReadContract({
    address: CONTRACTS.InputVoucher, abi: voucherAbi, functionName: 'usableBalance', args: [coopId, lookupKey!], query: { enabled: coopId > 0n && !!lookupKey },
  });
  const { data: vouchers } = useReadContract({
    address: CONTRACTS.InputVoucher, abi: voucherAbi, functionName: 'vouchersOf', args: [coopId, lookupKey!], query: { enabled: coopId > 0n && !!lookupKey },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-4xl font-extrabold flex items-center gap-3">
          <Building2 size={32} style={{ color: 'var(--rain)' }} /> Cooperative desk
        </h1>
        <p className="mt-2 max-w-2xl" style={{ color: 'var(--muted)' }}>
          Record deliveries, group them into batches, and let escrow pay every farmer their share. Farmers appear only as member
          codes: names and phone numbers stay off the blockchain.
        </p>
      </div>
      <NotDeployed />

      {/* identity strip */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {exists ? (
              <>
                <p className="font-display text-xl font-bold flex items-center gap-2">
                  <Building2 size={18} style={{ color: 'var(--rain)' }} />{coop!.name}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  #{String(coopId)} · {coop!.district} · chair <span className="font-mono">{short(coop!.chair)}</span>
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {address ? 'This wallet has no cooperative yet. Register one on the Overview tab, or look up an existing one.' : 'Connect a wallet to act as a cooperative chair or officer.'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exists && <Pill tone={coop!.verified ? 'terrace' : 'sorghum'}>{coop!.verified ? <span className="flex items-center gap-1"><BadgeCheck size={11} /> Verified</span> : <span className="flex items-center gap-1"><AlertTriangle size={11} /> Awaiting verification</span>}</Pill>}
            {exists && <Pill tone="rain"><span className="flex items-center gap-1"><UserCheck size={11} />{role}</span></Pill>}
            {score !== undefined && <Pill tone="sorghum">Score {String(score)}</Pill>}
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="btn btn-ghost text-sm"
              aria-expanded={showPicker}
            >
              <Building2 size={13} className="mr-1 inline" /> {showPicker ? 'Hide directory' : 'Browse cooperatives'}
            </button>
          </div>
        </div>

        {(showPicker || !exists) && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--panel-line)' }}>
            <CooperativePicker
              value={coopId}
              onChange={(id) => { setPickedId(id); setShowPicker(false); setOfficers([]); }}
              mine={myCoopIds}
              label="Every cooperative on chain"
            />
          </div>
        )}

        {exists && twoSigner === false && (
          <p className="mt-3 text-xs flex items-center gap-1" style={{ color: 'var(--sorghum)' }}>
            <AlertTriangle size={12} /> Demo mode: one wallet may record and confirm. Turn the two-signer rule back on before any real use.
          </p>
        )}

        {/* Admin verification controls */}
        {isAdmin && exists && !coop!.verified && (
          <div className="mt-4 flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--panel-line)' }}>
            <p className="w-full text-xs flex items-center gap-1" style={{ color: 'var(--sorghum)' }}>
              <ShieldCheck size={13} /> DataSpark admin controls
            </p>
            <TxButton variant="rain" label="✓ Verify cooperative" onDone={refreshAll}
              steps={() => [{ address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'verifyCooperative', args: [coopId, true] }]} />
          </div>
        )}
        {isAdmin && exists && twoSigner && (
          <div className="mt-2">
            <TxButton variant="ghost" label="Disable two-signer (demo)" onDone={refreshAll}
              steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'setTwoSignerRequired', args: [false] }]} />
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className="rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5"
            style={tab === t.id ? { background: 'var(--rain)', color: '#06222b' } : { background: 'rgba(255,255,255,0.07)', color: 'var(--muted)' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          {!myId || myId === 0n ? (
            <Card>
              <Heading title="Register your cooperative" hint="Your connected wallet becomes the chairperson. DataSpark verifies real cooperatives before they can record anything." />
              <div className="space-y-4">
                <Field label="Cooperative name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Twigire Maize Cooperative" /></Field>
                <Field label="District"><DistrictSelect value={district} onChange={setDistrict} /></Field>
                <TxButton label="Register cooperative" disabled={!name.trim()} onDone={refreshAll}
                  steps={() => [{ address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'registerCooperative', args: [name.trim(), district] }]} />
              </div>
            </Card>
          ) : null}

          {exists && (
            <Card>
              <Heading title="Cooperative roster" hint="Chairperson and registered member wallets for this cooperative." />
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                    <UserCheck size={12} /> Chairperson
                  </p>
                  <p className="glass-inner px-3 py-2 font-mono text-xs flex items-center gap-2">
                    <Wallet size={12} style={{ color: 'var(--rain)' }} />{coop!.chair}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                    <Users size={12} /> Members ({memberWallets.length})
                  </p>
                  {memberWallets.length === 0
                    ? <p className="text-xs" style={{ color: 'var(--muted)' }}>No members added yet.</p>
                    : (
                      <ul className="space-y-1">
                        {memberWallets.map((w) => (
                          <li key={w} className="glass-inner px-3 py-2 font-mono text-xs flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2"><Wallet size={12} style={{ color: 'var(--terrace)' }} />{w}</span>
                            {canOperate && (
                              <TxButton label="Remove" variant="ghost" className="text-xs py-0.5 px-2"
                                onDone={() => { refreshAll(); saveMemberWallets(memberWallets.filter((x) => x !== w)); }}
                                steps={() => [{ address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'setMember', args: [coopId, addressMemberKey(w), 0] }]} />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              </div>
            </Card>
          )}

          {exists && (
            <Card>
              <Heading title={`Members (${members !== undefined ? String(members) : '–'})`} hint="Enter the member's wallet address. Only its hash is stored on-chain; no personal data touches the blockchain." />
              {!ready ? <p className="text-sm flex items-center gap-1" style={{ color: 'var(--sorghum)' }}><AlertTriangle size={13} /> Members can be added once DataSpark verifies this cooperative.</p>
                : !canOperate ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Only the chairperson, an officer or a DataSpark admin can add members.</p>
                : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Member wallet address">
                        <input className="field font-mono text-sm" value={memberWallet} onChange={(e) => setMemberWallet(e.target.value)} placeholder="0x…" />
                      </Field>
                      <Field label="Plot size (ha)"><input className="field" type="number" min="0.01" step="0.01" value={plotHa} onChange={(e) => setPlotHa(e.target.value)} /></Field>
                    </div>
                    <TxButton label="Save member" disabled={!/^0x[a-fA-F0-9]{40}$/.test(memberWallet) || !(Number(plotHa) > 0)}
                      onDone={() => { refreshAll(); const w = memberWallet.toLowerCase(); if (!memberWallets.includes(w)) saveMemberWallets([...memberWallets, w]); setMemberWallet(''); }}
                      steps={() => [{ address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'setMember', args: [coopId, addressMemberKey(memberWallet), Math.round(Number(plotHa) * 100)] }]} />
                  </div>
                )}
            </Card>
          )}

          {(isChair || isAdmin) && (
            <Card>
              <Heading title="Officers" hint="Officers record deliveries. The chairperson confirms them — that is the second signature." />
              <div className="space-y-4">
                <Field label="Officer wallet address">
                  <input className="field font-mono text-sm" value={officer} onChange={(e) => setOfficer(e.target.value)} placeholder="0x…" />
                </Field>
                <TxButton label="Add officer" disabled={!/^0x[a-fA-F0-9]{40}$/.test(officer)} onDone={() => { refreshAll(); setOfficers((p) => Array.from(new Set([...p, officer.toLowerCase()]))); setOfficer(''); }}
                  steps={() => [{ address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'setOfficer', args: [coopId, officer, true] }]} />
                {officers.length > 0 && (
                  <ul className="space-y-1.5 mt-2">
                    {officers.map((o) => (
                      <li key={o} className="glass-inner flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2"><Wallet size={13} style={{ color: 'var(--rain)' }} /><span className="font-mono text-xs">{o}</span></span>
                        <TxButton label="Remove" variant="ghost" className="text-xs py-1 px-2" onDone={() => { refreshAll(); setOfficers((p) => p.filter((x) => x !== o)); }}
                          steps={() => [{ address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'setOfficer', args: [coopId, o, false] }]} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="space-y-6">
          {!ready || !canOperate
            ? <Card><p className="text-sm" style={{ color: 'var(--muted)' }}>{!exists ? 'Select or register a cooperative first.' : !ready ? 'This cooperative is waiting for verification.' : 'Only cooperative staff or a DataSpark admin can record deliveries.'}</p></Card>
            : (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <Heading title="Start a batch" hint="A batch groups deliveries of one crop and season for sale to one buyer." />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Crop"><select className="field" value={crop} onChange={(e) => setCrop(e.target.value)}>{CROPS.map((c) => <option key={c}>{c}</option>)}</select></Field>
                    <Field label="Season"><select className="field" value={idx} onChange={(e) => setIdx(Number(e.target.value) as 1 | 2 | 3)}>
                      <option value={1}>{YEAR} A</option><option value={2}>{YEAR} B</option><option value={3}>{YEAR} C</option></select></Field>
                  </div>
                  <div className="mt-4"><TxButton label="Create batch" onDone={refreshAll}
                    steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'createBatch', args: [coopId, crop, seasonId(YEAR, idx)] }]} /></div>
                </Card>
                <Card>
                  <Heading title="Record a delivery" hint="Quality grade: 1 is best. The chairperson must confirm it before it counts." />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Batch"><select className="field" value={batchSel} onChange={(e) => setBatchSel(e.target.value)}>
                      <option value="">Select…</option>{openBatches.map((b) => <option key={String(b.id)} value={String(b.id)}>#{String(b.id)} {b.crop} {seasonLabel(b.season)}</option>)}</select></Field>
                    <Field label="Member wallet address"><input className="field font-mono text-sm" value={dMember} onChange={(e) => setDMember(e.target.value)} placeholder="0x…" /></Field>
                    <Field label="Weight (kg)"><input className="field" type="number" min="1" value={kg} onChange={(e) => setKg(e.target.value)} /></Field>
                    <Field label="Grade"><select className="field" value={grade} onChange={(e) => setGrade(Number(e.target.value))}><option value={1}>1 (best)</option><option value={2}>2</option><option value={3}>3</option></select></Field>
                  </div>
                  <div className="mt-4"><TxButton label="Record delivery" onDone={refreshAll} disabled={!batchSel || !/^0x[a-fA-F0-9]{40}$/.test(dMember) || !(Number(kg) > 0)}
                    steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'recordDelivery', args: [BigInt(batchSel), addressMemberKey(dMember), Number(kg), grade] }]} /></div>
                </Card>
              </div>
            )}
          <Card>
            <Heading title="Delivery log" />
            {deliveries.items.length === 0
              ? <p className="text-sm flex items-center gap-1" style={{ color: 'var(--muted)' }}><ClipboardList size={14} /> No deliveries yet.</p>
              : (
                <ul className="space-y-2">
                  {deliveries.items.slice(0, 25).map((d) => (
                    <li key={String(d.id)} className="glass-inner flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Truck size={13} style={{ color: 'var(--rain)' }} />
                        <strong>#{String(d.id)}</strong> · batch #{String(d.batchId)} · {d.kg.toLocaleString()} kg · grade {d.grade} · <span className="font-mono text-xs">{short(d.memberId, 4)}</span>
                      </span>
                      {d.flagged
                        ? <Pill tone="storm"><span className="flex items-center gap-1"><XCircle size={11} /> Flagged</span></Pill>
                        : d.confirmed
                          ? <Pill tone="terrace"><span className="flex items-center gap-1"><CheckCircle2 size={11} /> Confirmed</span></Pill>
                          : canOperate
                            ? <TxButton label="Confirm" variant="rain" onDone={refreshAll}
                                steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'confirmDelivery', args: [d.id] }]} />
                            : <Pill tone="sorghum">Waiting for the cooperative to approve</Pill>}
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </div>
      )}

      {tab === 'batches' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-sm" style={{ color: 'var(--muted)' }}>
                Buyers pay into escrow. On release the full amount goes to the cooperative, and each farmer's share is recorded by kg.
              </p>
              <TxButton variant="ghost" label="Get 5,000,000 test mRWF" steps={() => [{ address: CONTRACTS.MockRWF, abi: mockRwfAbi, functionName: 'faucet' }]} />
            </div>
          </Card>
          {batches.items.length === 0 && <Card><p className="text-sm" style={{ color: 'var(--muted)' }}>No batches yet. Create one on the Deliveries tab.</p></Card>}
          {batches.items.map((b) => {
            const key = String(b.id);
            const amt = pay[key] ?? '';
            const isBuyer = !!address && b.buyer.toLowerCase() === address.toLowerCase();
            const timeoutOk = Date.now() / 1000 >= Number(b.fundedAt) + 14 * 86400;
            return (
              <Card key={key}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold flex items-center gap-2"><Package size={16} style={{ color: 'var(--rain)' }} />Batch #{key}: {b.crop}</h3>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>{seasonLabel(b.season)} · {b.totalKg.toLocaleString()} kg confirmed{b.pendingDeliveries ? ` · ${b.pendingDeliveries} waiting` : ''}</p>
                  </div>
                  <Pill tone={b.status === 3 ? 'terrace' : b.status === 2 ? 'rain' : b.status === 4 ? 'storm' : 'sorghum'}>{BATCH_STATUS[b.status]}</Pill>
                </div>
                {b.amount > 0n && <p className="mt-2 text-sm flex items-center gap-1"><Coins size={13} style={{ color: 'var(--sorghum)' }} />Escrow: <strong style={{ color: 'var(--sorghum)' }}>{b.amount.toLocaleString()} mRWF</strong> from <span className="font-mono text-xs">{short(b.buyer)}</span></p>}

                {/* Step guide visible to all */}
                {b.status === 0 && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-xs flex items-start gap-2" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)' }}>
                    <span className="mt-0.5">①</span>
                    <span>Waiting for the cooperative chairperson (<span className="font-mono">{exists ? short(coop!.chair) : ''}</span>) to seal this batch. Once sealed, any buyer can fund escrow.</span>
                  </div>
                )}
                {b.status === 1 && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-xs flex items-start gap-2" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)' }}>
                    <span className="mt-0.5">②</span>
                    <span>Batch sealed — <strong>{b.totalKg.toLocaleString()} kg</strong> of {b.crop} ready for purchase. Enter your offer below to lock funds in escrow.</span>
                  </div>
                )}
                {b.status === 2 && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-xs flex items-start gap-2" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)' }}>
                    <span className="mt-0.5">③</span>
                    <span>{isBuyer ? 'You funded this escrow. Confirm receipt below to release payment to the cooperative.' : `Buyer ${short(b.buyer)} must confirm receipt. If silent for 14 days the chairperson can release.`}</span>
                  </div>
                )}

                {/* Seal — cooperative staff or a DataSpark admin */}
                {b.status === 0 && canOperate && (
                  <div className="mt-4">
                    <TxButton label="Seal batch" onDone={refreshAll} disabled={b.pendingDeliveries > 0 || b.totalKg === 0}
                      steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'sealBatch', args: [b.id] }]} />
                    {(b.pendingDeliveries > 0 || b.totalKg === 0) && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Confirm all deliveries first.</p>}
                  </div>
                )}

                {/* Fund escrow — any connected wallet */}
                {b.status === 1 && !!address && (
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="text-sm">Your offer price (mRWF)
                      <input className="field mt-1 w-48" type="number" min="1" value={amt} onChange={(e) => setPay({ ...pay, [key]: e.target.value })} />
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>≈ {amt && b.totalKg ? (Number(amt) / b.totalKg).toFixed(2) : '–'} mRWF / kg</p>
                    </label>
                    <TxButton label="Approve and fund escrow" labels={['mRWF approval', 'escrow funding']} onDone={refreshAll} disabled={!(Number(amt) > 0)}
                      steps={() => [
                        { address: CONTRACTS.MockRWF, abi: erc20Abi, functionName: 'approve', args: [CONTRACTS.HarvestLedger, BigInt(amt)] },
                        { address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'fundBatch', args: [b.id, BigInt(amt)] },
                      ]} />
                  </div>
                )}
                {b.status === 1 && !address && (
                  <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Connect a wallet to fund escrow for this batch.</p>
                )}

                {/* Release — buyer or chair after timeout */}
                {b.status === 2 && (
                  <div className="mt-4">
                    <TxButton label={isBuyer ? 'Confirm receipt & release payment' : isAdmin ? 'Release payment (DataSpark admin)' : 'Release payment (14-day timeout)'} onDone={refreshAll}
                      disabled={!address || (!isBuyer && !isAdmin && !(isChair && timeoutOk))}
                      steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'releaseBatch', args: [b.id] }]} />
                    {!isBuyer && isChair && !timeoutOk && !isAdmin && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>You can release after the 14-day buyer timeout.</p>}
                    {!isBuyer && !isChair && !isAdmin && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Only the buyer, the chairperson (after 14 days) or a DataSpark admin can release.</p>}
                  </div>
                )}

                {b.status === 3 && <PayoutSplit batchId={b.id} />}
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'vouchers' && (
        <Card>
          <Heading title="Input vouchers" hint="Spend-only credit for seed and fertilizer. Cannot be transferred, only redeemed at registered dealers inside its valid dates." />
          <div className="grid gap-4 md:max-w-md">
            <Field label="Member wallet address"><input className="field font-mono text-sm" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="0x…" /></Field>
          </div>
          {lookupKey && (
            <div className="mt-5">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Usable now</p>
              <p className="font-display text-3xl font-bold" style={{ color: 'var(--terrace)' }}>{usable !== undefined ? Number(usable).toLocaleString() : '–'} mRWF</p>
              <ul className="mt-4 space-y-2">
                {((vouchers as any[]) ?? []).map((v, i) => (
                  <li key={i} className="glass-inner p-3 text-sm flex items-center justify-between gap-3">
                    <span>{Number(v.amount).toLocaleString()} mRWF left · valid {new Date(Number(v.notBefore) * 1000).toLocaleDateString()} to {new Date(Number(v.expiresAt) * 1000).toLocaleDateString()}</span>
                    {v.emergency && <Pill tone="storm"><span className="flex items-center gap-1"><AlertTriangle size={11} /> Climate emergency</span></Pill>}
                  </li>
                ))}
                {((vouchers as any[]) ?? []).length === 0 && <li className="text-sm" style={{ color: 'var(--muted)' }}>No vouchers issued to this member yet.</li>}
              </ul>
            </div>
          )}
          <p className="mt-5 text-xs" style={{ color: 'var(--muted)' }}>Emergency vouchers are released by DataSpark's climate oracle after a drought or flood trigger is declared for the district.</p>
        </Card>
      )}
    </div>
  );
}
