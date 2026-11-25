import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import Navbar from './components/Navbar';
import TestnetBanner from './components/TestnetBanner';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'] });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'DataSpark: climate intelligence for Rwanda’s farmers',
  description: 'Real-time climate data, district farming plan and a transparent harvest ledger for cooperatives.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <TestnetBanner />
          <Navbar />
          <main>{children}</main>
          <footer className="mx-auto max-w-6xl px-6 py-10 text-sm" style={{ color: 'var(--muted)' }}>
            DataSpark turns weather and climate data into decisions farmers can act on. HVST and mRWF run on Ethereum
            Sepolia and have no monetary value. Farming plan are advice, not guarantees.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
