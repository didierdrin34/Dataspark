import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  // Set NEXT_PUBLIC_SEPOLIA_RPC_URL (Alchemy / Infura) for reliable reads. Falls back to a public RPC.
  transports: { [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined) },
  ssr: true,
});
