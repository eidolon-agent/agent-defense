import { create } from "zustand";
import type { PlayerAgent, Command, GamePhase, MatchResult } from "@/core/game/types";

interface GameStore {
  command: Command;
  phase: GamePhase;
  score: number; wave: number; baseHP: number; maxBaseHP: number;
  result: MatchResult | null;
  agents: PlayerAgent[];
  connected: boolean; address: string | null;
  showMint: boolean;
  setCommand: (c: Command) => void;
  setPhase: (p: GamePhase) => void;
  setScore: (n: number) => void; setWave: (n: number) => void;
  setBaseHP: (n: number) => void; setMaxBaseHP: (n: number) => void;
  setResult: (r: MatchResult) => void;
  addAgent: (a: PlayerAgent) => void; removeAgent: (id: number) => void;
  setAgents: (a: PlayerAgent[]) => void;
  setConnected: (v: boolean) => void; setAddress: (v: string | null) => void;
  setShowMint: (v: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  command: "FAST", phase: "lobby", score: 0, wave: 0, baseHP: 20, maxBaseHP: 20, result: null,
  agents: [], connected: false, address: null, showMint: false,
  setCommand: c => set({ command: c }),
  setPhase: p => set({ phase: p }),
  setScore: n => set({ score: n }), setWave: n => set({ wave: n }),
  setBaseHP: n => set({ baseHP: n }), setMaxBaseHP: n => set({ maxBaseHP: n }),
  setResult: r => set({ result: r }),
  addAgent: a => set(s => ({ agents: [...s.agents, a] })),
  removeAgent: id => set(s => ({ agents: s.agents.filter(a => a.agentId !== id) })),
  setAgents: a => set({ agents: a }),
  setConnected: v => set({ connected: v }), setAddress: v => set({ address: v }),
  setShowMint: v => set({ showMint: v }),
  reset: () => set({ score: 0, wave: 0, baseHP: 20, maxBaseHP: 20, result: null, phase: "playing" as GamePhase }),
}));
