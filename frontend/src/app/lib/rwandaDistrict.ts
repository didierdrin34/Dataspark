export interface RwandaDistrict {
  name: string;
  province: string;
  lat: number;
  lon: number;
}

// Approximate district-center coordinates, sufficient for district-level weather forecasting.
export const RWANDA_DISTRICTS: RwandaDistrict[] = [
  // Kigali City
  { name: 'Gasabo', province: 'Kigali City', lat: -1.9146, lon: 30.1127 },
  { name: 'Kicukiro', province: 'Kigali City', lat: -1.9667, lon: 30.1000 },
  { name: 'Nyarugenge', province: 'Kigali City', lat: -1.9536, lon: 30.0606 },
  // Northern Province
  { name: 'Burera', province: 'Northern', lat: -1.4846, lon: 29.8700 },
  { name: 'Gakenke', province: 'Northern', lat: -1.6912, lon: 29.7809 },
  { name: 'Gicumbi', province: 'Northern', lat: -1.5528, lon: 30.1067 },
  { name: 'Musanze', province: 'Northern', lat: -1.4996, lon: 29.6338 },
  { name: 'Rulindo', province: 'Northern', lat: -1.7325, lon: 30.0678 },
  // Southern Province
  { name: 'Gisagara', province: 'Southern', lat: -2.5947, lon: 29.8386 },
  { name: 'Huye', province: 'Southern', lat: -2.5967, lon: 29.7392 },
  { name: 'Kamonyi', province: 'Southern', lat: -2.0167, lon: 29.8833 },
  { name: 'Muhanga', province: 'Southern', lat: -2.0850, lon: 29.7564 },
  { name: 'Nyamagabe', province: 'Southern', lat: -2.4508, lon: 29.4547 },
  { name: 'Nyanza', province: 'Southern', lat: -2.3508, lon: 29.7500 },
  { name: 'Nyaruguru', province: 'Southern', lat: -2.6167, lon: 29.5333 },
  { name: 'Ruhango', province: 'Southern', lat: -2.1972, lon: 29.7822 },
  // Eastern Province
  { name: 'Bugesera', province: 'Eastern', lat: -2.2167, lon: 30.2333 },
  { name: 'Gatsibo', province: 'Eastern', lat: -1.5906, lon: 30.4419 },
  { name: 'Kayonza', province: 'Eastern', lat: -1.8833, lon: 30.6167 },
  { name: 'Kirehe', province: 'Eastern', lat: -2.2578, lon: 30.7844 },
  { name: 'Ngoma', province: 'Eastern', lat: -2.1608, lon: 30.5297 },
  { name: 'Nyagatare', province: 'Eastern', lat: -1.2942, lon: 30.3258 },
  { name: 'Rwamagana', province: 'Eastern', lat: -1.9489, lon: 30.4347 },
  // Western Province
  { name: 'Karongi', province: 'Western', lat: -2.0608, lon: 29.3444 },
  { name: 'Ngororero', province: 'Western', lat: -1.8617, lon: 29.5833 },
  { name: 'Nyabihu', province: 'Western', lat: -1.6469, lon: 29.5203 },
  { name: 'Nyamasheke', province: 'Western', lat: -2.3411, lon: 29.1236 },
  { name: 'Rubavu', province: 'Western', lat: -1.6791, lon: 29.2653 },
  { name: 'Rusizi', province: 'Western', lat: -2.4846, lon: 28.9075 },
  { name: 'Rutsiro', province: 'Western', lat: -1.8283, lon: 29.3389 },
];
