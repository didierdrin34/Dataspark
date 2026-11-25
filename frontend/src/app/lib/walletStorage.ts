export function normalizeWallet(address?: string | null): string | null {
  if (!address) return null;
  return address.trim().toLowerCase();
}

export function walletKey(address: string, bucket: string): string {
  return `dataspark:v1:${normalizeWallet(address)}:${bucket}`;
}

export function readWalletData<T>(address: string | undefined, bucket: string, fallback: T): T {
  const wallet = normalizeWallet(address);
  if (!wallet || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(walletKey(wallet, bucket));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeWalletData<T>(address: string | undefined, bucket: string, value: T): void {
  const wallet = normalizeWallet(address);
  if (!wallet || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(walletKey(wallet, bucket), JSON.stringify(value));
  } catch {
    // ignore quota / private-mode errors
  }
}

export function syncToNeon(address: string | undefined, bucket: string, value: unknown): void {
  const wallet = normalizeWallet(address);
  if (!wallet) return;
  fetch('/api/wallet-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, bucket, value }),
  }).catch(() => {});
}

export async function readFromNeon<T>(address: string | undefined, bucket: string, fallback: T): Promise<T> {
  const wallet = normalizeWallet(address);
  if (!wallet) return fallback;
  try {
    const res = await fetch(`/api/wallet-data?wallet=${wallet}&bucket=${bucket}`);
    if (!res.ok) return readWalletData(address, bucket, fallback);
    const json = await res.json();
    return (json.value ?? fallback) as T;
  } catch {
    return readWalletData(address, bucket, fallback);
  }
}
