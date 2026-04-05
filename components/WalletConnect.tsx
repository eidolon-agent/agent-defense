"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function WalletConnect() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const s = address ? `${address.slice(0,6)}...${address.slice(-4)}` : "";

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-900/30 border border-indigo-800 rounded-lg">
        <span className="text-green-400">●</span>
        <span className="text-sm font-mono text-indigo-200">{s}</span>
        <button onClick={()=>disconnect()} className="text-xs text-gray-400 hover:text-gray-200">✕</button>
      </div>
    );
  }
  return (
    <button onClick={()=>connect({connector:injected()})}
      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition shadow-lg shadow-indigo-600/25">
      Connect Wallet
    </button>
  );
}
