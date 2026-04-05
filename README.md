# Agent Defense

A tower defense game where your towers are autonomous AI agents.

## Quick Start

```bash
# Install deps
npm install

# Start frontend
npm run dev

# (Optional) Start backend
cd backend && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- **Frontend:** Next.js 15 + Canvas + Zustand
- **Web3:** wagmi + viem (Base/Sepolia)
- **Game Engine:** Custom HTML5 Canvas engine
- **Contract:** ERC-721 AgentNFT with evolution tracking
- **Backend:** Node.js mock IPFS + brain evolution API

## How it Works

1. Connect wallet (or play without one)
2. Mint an Agent NFT (type + personality)
3. Deploy agents to defend the lane
4. Choose command strategy: FAST / STRONG / BASE
5. Agents think and fight autonomously
6. After each match, agents evolve!

## Smart Contract

- `AgentNFT.sol` — ERC-721 with Agent struct
- Functions: `mint`, `getAgent`, `updateProgress`, `updateBehavior`
- Game server controlled evolution (onlyGameServer modifier)
