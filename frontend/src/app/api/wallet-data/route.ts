import { NextRequest, NextResponse } from 'next/server';
import sql from '../../lib/db';

// Ensure table exists (runs once per cold start)
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS wallet_data (
      wallet  TEXT NOT NULL,
      bucket  TEXT NOT NULL,
      value   JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (wallet, bucket)
    )
  `;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.toLowerCase();
  const bucket = searchParams.get('bucket');
  if (!wallet || !bucket) return NextResponse.json({ error: 'missing params' }, { status: 400 });

  await ensureTable();
  const rows = await sql`SELECT value FROM wallet_data WHERE wallet = ${wallet} AND bucket = ${bucket}`;
  return NextResponse.json({ value: rows[0]?.value ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const wallet = body.wallet?.toLowerCase();
  const { bucket, value } = body;
  if (!wallet || !bucket || value === undefined) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  await ensureTable();
  await sql`
    INSERT INTO wallet_data (wallet, bucket, value, updated_at)
    VALUES (${wallet}, ${bucket}, ${JSON.stringify(value)}, now())
    ON CONFLICT (wallet, bucket) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}
