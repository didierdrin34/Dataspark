'use client';
import { RWANDA_DISTRICTS } from '../lib/rwandaDistrict';

const PROVINCES = Array.from(new Set(RWANDA_DISTRICTS.map((d) => d.province)));

export default function DistrictSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} aria-label="District">
      {PROVINCES.map((p) => (
        <optgroup key={p} label={p}>
          {RWANDA_DISTRICTS.filter((d) => d.province === p).map((d) => (
            <option key={d.name} value={d.name}>{d.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
