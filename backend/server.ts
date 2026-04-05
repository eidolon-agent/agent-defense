/**
 * Agent Defense Backend (MVP)
 *
 * POST /agent/evolve  — generate evolved brain after match
 * POST /llm/decide    — stub for future LLM integration
 *
 * Storage: mock IPFS (in-memory)
 */
import { createServer } from "http";
import { randomBytes } from "crypto";

interface Brain {
  traits: Record<string, number>;
  memory: string[];
  strategyBias: Record<string, number>;
}

const brainStore = new Map<string, Brain>();
const ipfsStore = new Map<string, Brain>();

function defaultBrain(type: string, pers: string): Brain {
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

function evolve(b: Brain, won: boolean, score: number): Brain {
  const n = JSON.parse(JSON.stringify(b)) as Brain;
  n.traits.aggression = Math.min(1, Math.max(0, n.traits.aggression + (won ? 0.05 : -0.05)));
  n.traits.caution = Math.min(1, Math.max(0, n.traits.caution + (won ? -0.02 : 0.05)));
  n.strategyBias.fastTargeting = n.traits.aggression;
  n.strategyBias.baseProtection = n.traits.caution;
  n.memory.push(won ? `Won (score:${score})` : `Lost (score:${score})`);
  if (n.memory.length > 10) n.memory = n.memory.slice(-10);
  return n;
}

function mkHash(): string { return "0x" + randomBytes(32).toString("hex"); }

const PORT = process.env.PORT || 3001;

createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const respond = (code: number, body: object) => { res.writeHead(code); res.end(JSON.stringify(body)); };

  if (req.method === "POST" && req.url === "/agent/evolve") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const d = JSON.parse(body);
        const key = `${d.agentType}-${d.personality}`;
        let brain = brainStore.get(key) || defaultBrain(d.agentType, d.personality);
        brain = evolve(brain, d.matchResult.won, d.matchResult.score);
        brainStore.set(key, brain);
        const hash = mkHash();
        ipfsStore.set(hash, brain);
        respond(200, { success: true, behaviorHash: hash, brain });
      } catch { respond(400, { error: "Invalid payload" }); }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/llm/decide") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        respond(200, { targetId: null, thought: "LLM brain analyzing...", note: "Stub — RuleBasedBrain active in MVP" });
      } catch { respond(400, { error: "Invalid" }); }
    });
    return;
  }

  respond(404, { error: "Not found" });
}).listen(PORT, () => console.log(`Backend :${PORT}`));
