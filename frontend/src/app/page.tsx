'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RWANDA_DISTRICTS } from './lib/rwandaDistrict';
import DistrictSelect from './components/DistrictSelect';
import ForecastPanel from './components/ForecastPanel';
import ClimateMap from './components/ClimateMap';
import Hotspots from './components/Hotspots';
import PlaybookPanel from './components/PlaybookPanel';
import ChainPulse from './components/ChainPulse';
import { Card, Heading, NotDeployed } from './components/ui';

const LOOP = [
  { t: 'Forecast', d: 'DataSpark reads weather and storm signals for each of Rwanda’s 30 districts.' },
  { t: 'Playbook', d: 'An agronomist publishes what to plant and when, and stakes HVST on being right.' },
  { t: 'Action', d: 'Cooperatives follow the farming plan and receive inputs in the right planting window.' },
  { t: 'Proof', d: 'The cooperative records every delivery. A second signer confirms it on the ledger.' },
  { t: 'Reward', d: 'Buyers pay into escrow, farmers are paid by their share, and playbooks that beat the district baseline earn HVST.' },
];

export default function Home() {
  const [district, setDistrict] = useState('Nyagatare');
  const d = RWANDA_DISTRICTS.find((x) => x.name === district) ?? RWANDA_DISTRICTS[0];

  return (
    <div>
      <section className="hero-glow">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="rise">
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] md:text-6xl">
              Know what the sky will do before you plant.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
              DataSpark turns real-time weather and climate data into actions for farmers, cooperatives, businesses and
              governments: anticipate climate risk, protect lives and harvests, and adapt to a changing climate.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/playbooks" className="btn btn-primary">Browse district playbooks</Link>
              <Link href="/cooperative" className="btn btn-ghost">Open the cooperative desk</Link>
            </div>
            <div className="mt-10"><ChainPulse /></div>
          </div>

          <Card className="rise" >
            <label htmlFor="district" className="mb-2 block text-sm font-medium">Choose your district</label>
            <DistrictSelect id="district" value={district} onChange={setDistrict} />
            <div className="mt-6"><ForecastPanel district={district} /></div>
          </Card>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-6 pb-8">
        <NotDeployed />

        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <Card>
            <Heading title={`Live map around ${district}`} hint="Switch layers to see rain, wind, temperature and cloud cover moving across the region." />
            <ClimateMap lat={d.lat} lon={d.lon} label={district} />
          </Card>
          <Card>
            <Heading title="Where to watch this week" hint="Districts ranked by storm risk over the next 3 days. Select one to open its forecast." />
            <Hotspots selected={district} onSelect={(n) => { setDistrict(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </Card>
        </div>

        <Card>
          <Heading title={`Farming plans for ${district}`} hint="Farming decisions published for this district. Cooperatives can follow one, and results are checked against real delivery records." />
          <PlaybookPanel district={district} />
        </Card>

        <Card>
          <Heading title="How a season works on DataSpark" hint="Climate data guides the decision, and the cooperative’s own records prove whether it worked." />
          <ol className="grid gap-3 md:grid-cols-5">
            {LOOP.map((s, i) => (
              <li key={s.t} className="glass-inner p-4">
                <span className="font-display text-2xl font-bold" style={{ color: 'var(--rain)' }}>{i + 1}</span>
                <h3 className="mt-1 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{s.d}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
