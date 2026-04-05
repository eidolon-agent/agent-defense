/**
 * Agent Defense Backend — Shared brain engine
 *
 * In-memory storage for agent brains + evolution logic.
 */
import { randomBytes } from "crypto";

export interface Brain {
  traits: Record<string, number>;
  memory: string[];
  strategyBias: Record<string, number>;
}

const brainStore = new Map<string, Brain>();
const ipfsStore = new Map<string, Brain>();

export function defaultBrain(type: string, pers: string): Brain {
  const isA = pers === "aggressive";
  const isD = pers === "defensive";
  const isC = pers === "calculated";
  return {
    traits: {
      aggression: isA ? 0.9 : isC ? 0.6 : isD ? 0.3 : 0.5,
      caution: isD ? 0.8 : isC ? 0.6 : isA ? 0.2 : 0.4,
      adaptability: isC ? 0.9 : 0.5,
    },
    memory: [],
    strategyBias: {
      fastTargeting: isA ? 0.7 : 0.4,
      baseProtection: isD ? 0.8 : 0.3,
    },
  };
}

export function evolveBrain(b: Brain, won: boolean, score: number): Brain {
  const n = JSON.parse(JSON.stringify(b)) as Brain;
  n.traits.aggression = Math.min(1, Math.max(0, n.traits.aggression + (won ? 0.05 : -0.05)));
  n.traits.caution = Math.min(1, Math.max(0, n.traits.caution + (won ? -0.02 : 0.05)));
  n.strategyBias.fastTargeting = n.traits.aggression;
  n.strategyBias.baseProtection = n.traits.caution;
  n.memory.push(won ? `Won (score:${score})` : `Lost (score:${score})`);
  if (n.memory.length > 10) n.memory = n.memory.slice(-10);
  return n;
}

export function mkHash(): string { return "0x" + randomBytes(32).toString("hex"); }
export function getBrain(key: string) { return brainStore.get(key); }
export function setBrain(key: string, b: Brain) { brainStore.set(key, b); }
export function storeHash(hash: string, b: Brain) { ipfsStore.set(hash, b); }
