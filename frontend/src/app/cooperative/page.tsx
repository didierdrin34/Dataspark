'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import {
  BATCH_STATUS, CONTRACTS, CROPS, erc20Abi, ledgerAbi, memberKey, mockRwfAbi, registryAbi, seasonId, seasonLabel, short, voucherAbi,
} from '../lib/contracts';
import { useBatches, useDeliveries } from '../hooks/useLedger';
import DistrictSelect from '../components/DistrictSelect';
import PayoutSplit from '../components/PayoutSplit';
import { Card, Field, Heading, NotDeployed, Pill, TxButton } from '../components/ui';

const YEAR = new Date().getFullYear();
type Tab = 'overview' | 'deliveries' | 'batches' | 'vouchers';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'batches', label: 'Batches and payment' },
  { id: 'vouchers', label: 'Input vouchers' },
];

export default function CooperativePage() {
  const { address } = useAccount();
  const [tab, setTab] = useState<Tab>('overview');
  const [manualId, setManualId] = useState('1');

  const { data: myId, refetch: refetchMine } = useReadContract({
    address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'coopIdOfChair', args: [address!], query: { enabled: !!address },
  });
  const coopId = myId && myId > 0n ? myId : BigInt(Number(manualId) > 0 ? Number(manualId) : 0);

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

  const isChair = !!address && exists && coop!.chair.toLowerCase() === address.toLowerCase();
  const isStaff = isChair || !!officerFlag;
  const ready = exists && coop!.verified && coop!.active;
  const role = isChair ? 'Chairperson' : officerFlag ? 'Officer' : 'Viewer';
  const members = (stats as any)?.[0]?.result as bigint | undefined;
  const score = (stats as any)?.[1]?.result as bigint | undefined;
  const twoSigner = (stats as any)?.[2]?.result as boolean | undefined;

  const batches = useBatches(exists ? coopId : undefined);
  const deliveries = useDeliveries(batches.items.map((b) => b.id));
  const refreshAll = () => { refetchCoop(); refetchMine(); refetchStats(); batches.refetch(); deliveries.refetch(); };

  // forms
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('Nyagatare');
  const [memberCode, setMemberCode] = useState('');
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
  const lookupKey = lookup.trim() ? memberKey(lookup) : undefined;
  const { data: usable } = useReadContract({
    address: CONTRACTS.InputVoucher, abi: voucherAbi, functionName: 'usableBalance', args: [coopId, lookupKey!], query: { enabled: coopId > 0n && !!lookupKey },
  });
  const { data: vouchers } = useReadContract({
    address: CONTRACTS.InputVoucher, abi: voucherAbi, functionName: 'vouchersOf', args: [coopId, lookupKey!], query: { enabled: coopId > 0n && !!lookupKey },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-4xl font-extrabold">Cooperative desk</h1>
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
                <p className="font-display text-xl font-bold">{coop!.name}</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>#{String(coopId)} · {coop!.district} · chair {short(coop!.chair)}</p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{address ? 'This wallet has no cooperative yet. Register one on the Overview tab, or look up an existing one.' : 'Connect a wallet to act as a cooperative chair or officer.'}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exists && <Pill tone={coop!.verified ? 'terrace' : 'sorghum'}>{coop!.verified ? 'Verified' : 'Awaiting verification'}</Pill>}
            {exists && <Pill tone="rain">{role}</Pill>}
            {score !== undefined && <Pill tone="sorghum">Score {String(score)}</Pill>}
            {!myId || myId === 0n ? (
              <label className="text-sm">Cooperative #
                <input className="field ml-2 inline-block w-20" type="number" min="1" value={manualId} onChange={(e) => setManualId(e.target.value)} />
              </label>
            ) : null}
          </div>
        </div>
        {exists && twoSigner === false && (
          <p className="mt-3 text-xs" style={{ color: 'var(--sorghum)' }}>Demo mode: one wallet may record and confirm. Turn the two-signer rule back on before any real use.</p>
        )}
      </Card>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="rounded-lg px-4 py-2 text-sm font-medium"
            style={tab === t.id ? { background: 'var(--rain)', color: '#06222b' } : { background: 'rgba(255,255,255,0.07)' }}>{t.label}</button>
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
              <Heading title={`Members (${members !== undefined ? String(members) : '–'})`} hint="Use a code like RW-NYA-0001. Only its hash is stored on-chain." />
              {!ready ? <p className="text-sm" style={{ color: 'var(--sorghum)' }}>Members can be added once DataSpark verifies this cooperative.</p> : !isStaff ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Only the chairperson and officers can add members.</p> : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Member code"><input className="field" value={memberCode} onChange={(e) => setMemberCode(e.target.value)} placeholder="RW-NYA-0006" /></Field>
                    <Field label="Plot size (ha)"><input className="field" type="number" min="0.01" step="0.01" value={plotHa} onChange={(e) => setPlotHa(e.target.value)} /></Field>
                  </div>
                  <TxButton label="Save member" disabled={!memberCode.trim() || !(Number(plotHa) > 0)} onDone={refreshAll}
                    steps={() => [{ address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'setMember', args: [coopId, memberKey(memberCode), Math.round(Number(plotHa) * 100)] }]} />
                </div>
              )}
            </Card>
          )}
          {isChair && (
            <Card>
              <Heading title="Add an officer" hint="Officers record deliveries. You, as chairperson, confirm them. That is the second signature." />
              <div className="space-y-4">
                <Field label="Officer wallet address"><input className="field font-mono text-sm" value={officer} onChange={(e) => setOfficer(e.target.value)} placeholder="0x…" /></Field>
                <TxButton label="Add officer" disabled={!/^0x[a-fA-F0-9]{40}$/.test(officer)} onDone={refreshAll}
                  steps={() => [{ address: CONTRACTS.CooperativeRegistry, abi: registryAbi, functionName: 'setOfficer', args: [coopId, officer, true] }]} />
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="space-y-6">
          {!ready || !isStaff ? <Card><p className="text-sm" style={{ color: 'var(--muted)' }}>{!exists ? 'Select or register a cooperative first.' : !ready ? 'This cooperative is waiting for verification.' : 'Only cooperative staff can record deliveries.'}</p></Card> : (
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
                  <Field label="Member code"><input className="field" value={dMember} onChange={(e) => setDMember(e.target.value)} placeholder="RW-NYA-0001" /></Field>
                  <Field label="Weight (kg)"><input className="field" type="number" min="1" value={kg} onChange={(e) => setKg(e.target.value)} /></Field>
                  <Field label="Grade"><select className="field" value={grade} onChange={(e) => setGrade(Number(e.target.value))}><option value={1}>1 (best)</option><option value={2}>2</option><option value={3}>3</option></select></Field>
                </div>
                <div className="mt-4"><TxButton label="Record delivery" onDone={refreshAll} disabled={!batchSel || !dMember.trim() || !(Number(kg) > 0)}
                  steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'recordDelivery', args: [BigInt(batchSel), memberKey(dMember), Number(kg), grade] }]} /></div>
              </Card>
            </div>
          )}
          <Card>
            <Heading title="Delivery log" />
            {deliveries.items.length === 0 ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No deliveries yet.</p> : (
              <ul className="space-y-2">
                {deliveries.items.slice(0, 25).map((d) => (
                  <li key={String(d.id)} className="glass-inner flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <span><strong>#{String(d.id)}</strong> · batch #{String(d.batchId)} · {d.kg.toLocaleString()} kg · grade {d.grade} · <span className="font-mono text-xs">{short(d.memberId, 4)}</span></span>
                    {d.flagged ? <Pill tone="storm">Flagged by auditor</Pill> : d.confirmed ? <Pill tone="terrace">Confirmed</Pill> : isChair ? (
                      <TxButton label="Confirm" variant="rain" onDone={refreshAll}
                        steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'confirmDelivery', args: [d.id] }]} />
                    ) : <Pill tone="sorghum">Waiting for chairperson</Pill>}
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
                Buyers pay into escrow. On release the full amount goes to the cooperative, and each farmer’s share is recorded by kg so the cooperative can pay by mobile money.
              </p>
              <TxButton variant="ghost" label="Get 5,000,000 test mRWF (buyer)" steps={() => [{ address: CONTRACTS.MockRWF, abi: mockRwfAbi, functionName: 'faucet' }]} />
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
                    <h3 className="font-display text-lg font-bold">Batch #{key}: {b.crop}</h3>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>{seasonLabel(b.season)} · {b.totalKg.toLocaleString()} kg confirmed{b.pendingDeliveries ? ` · ${b.pendingDeliveries} waiting for confirmation` : ''}</p>
                  </div>
                  <Pill tone={b.status === 3 ? 'terrace' : b.status === 2 ? 'rain' : b.status === 4 ? 'storm' : 'sorghum'}>{BATCH_STATUS[b.status]}</Pill>
                </div>
                {b.amount > 0n && <p className="mt-2 text-sm">Escrow: <strong style={{ color: 'var(--sorghum)' }}>{b.amount.toLocaleString()} mRWF</strong> from {short(b.buyer)}</p>}

                {b.status === 0 && isStaff && (
                  <div className="mt-4"><TxButton label="Seal batch" onDone={refreshAll} disabled={b.pendingDeliveries > 0 || b.totalKg === 0}
                    steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'sealBatch', args: [b.id] }]} />
                    {(b.pendingDeliveries > 0 || b.totalKg === 0) && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Confirm all deliveries first. A batch needs at least one confirmed delivery.</p>}</div>
                )}
                {b.status === 1 && (
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="text-sm">Offer price (mRWF)
                      <input className="field mt-1 w-48" type="number" min="1" value={amt} onChange={(e) => setPay({ ...pay, [key]: e.target.value })} /></label>
                    <TxButton label="Approve and fund escrow" labels={['mRWF approval', 'escrow funding']} onDone={refreshAll} disabled={!(Number(amt) > 0)}
                      steps={() => [
                        { address: CONTRACTS.MockRWF, abi: erc20Abi, functionName: 'approve', args: [CONTRACTS.HarvestLedger, BigInt(amt)] },
                        { address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'fundBatch', args: [b.id, BigInt(amt)] },
                      ]} />
                  </div>
                )}
                {b.status === 2 && (
                  <div className="mt-4">
                    <TxButton label={isBuyer ? 'Confirm receipt and release payment' : 'Release payment'} onDone={refreshAll} disabled={!isBuyer && !(isChair && timeoutOk)}
                      steps={() => [{ address: CONTRACTS.HarvestLedger, abi: ledgerAbi, functionName: 'releaseBatch', args: [b.id] }]} />
                    {!isBuyer && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>The buyer releases payment. If they stay silent for 14 days, the chairperson can.</p>}
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
          <Heading title="Input vouchers" hint="Spend-only credit for seed and fertilizer. It cannot be transferred, only redeemed at registered dealers inside its valid dates." />
          <div className="grid gap-4 md:max-w-md">
            <Field label="Member code"><input className="field" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="RW-NYA-0001" /></Field>
          </div>
          {lookupKey && (
            <div className="mt-5">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Usable now</p>
              <p className="font-display text-3xl font-bold" style={{ color: 'var(--terrace)' }}>{usable !== undefined ? Number(usable).toLocaleString() : '–'} mRWF</p>
              <ul className="mt-4 space-y-2">
                {((vouchers as any[]) ?? []).map((v, i) => (
                  <li key={i} className="glass-inner p-3 text-sm">
                    {Number(v.amount).toLocaleString()} mRWF left · valid {new Date(Number(v.notBefore) * 1000).toLocaleDateString()} to {new Date(Number(v.expiresAt) * 1000).toLocaleDateString()}{' '}
                    {v.emergency && <Pill tone="storm">Climate emergency</Pill>}
                  </li>
                ))}
                {((vouchers as any[]) ?? []).length === 0 && <li className="text-sm" style={{ color: 'var(--muted)' }}>No vouchers issued to this member yet.</li>}
              </ul>
            </div>
          )}
          <p className="mt-5 text-xs" style={{ color: 'var(--muted)' }}>Emergency vouchers are released by DataSpark’s climate oracle after a drought or flood trigger is declared for the district.</p>
        </Card>
      )}
    </div>
  );
}
