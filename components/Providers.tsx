"use client";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import type { ReactNode } from "react";

export const config = createConfig({
  chains: [base, sepolia],
  connectors: [injected()],
  transports: { [base.id]:http(), [sepolia.id]:http() },
});
const qc = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
