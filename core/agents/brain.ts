import type { GameAgent, GameEnemy, Command } from "../game/types";

const IDLE = {
  balanced: ["Scanning area...", "Standing by.", "Patrol active.", "Monitoring sector."],
  aggressive: ["Let's go!", "I'm ready!", "Bring them on!", "Time to fight!"],
  defensive: ["Holding the line.", "Shield up.", "Base is safe.", "Fortress mode."],
  calculated: ["Analyzing vectors...", "Processing...", "Calculating...", "Evaluating threats..."],
};

const COMBAT = {
  balanced: ["Target locked.", "Engaging.", "Firing.", "On it."],
  aggressive: ["Take that!", "Destroy!", "Full power!", "Die!"],
  defensive: ["Covering!", "Hold position!", "Protecting!", "Shield active!"],
  calculated: ["Threat prioritized.", "Optimal shot.", "Trajectory set.", "Firing solution computed."],
};

const BOSS_REACTION = ["Boss incoming!", "Big one!", "Focus fire!", "All attention here!"];
const STEALTH_ALERT = ["Did you see that?", "Movement detected!", "Cloaked enemy!", "Hidden threat!"];

export interface Decision {
  targetId: number | null;
  thought: string;
}

export class RuleBasedBrain {
  decide(agent: GameAgent, enemies: GameEnemy[], command: Command): Decision {
    const inRange = enemies.filter((e) => Math.abs(e.x - agent.x) <= agent.attackRange);

    if (inRange.length === 0) {
      // Boss anywhere in map → track it even if out of range
      const bossAnywhere = enemies.find(e => e.type === "boss");
      if (bossAnywhere) {
        return { targetId: bossAnywhere.id, thought: "Boss spotted... tracking..." };
      }
      const t = IDLE[agent.personality] || IDLE.balanced;
      return { targetId: null, thought: t[Math.floor(Math.random() * t.length)] };
    }

    // Boss is ALWAYS the highest priority target
    const bossTarget = inRange.find(e => e.type === "boss");
    if (bossTarget) {
      return { targetId: bossTarget.id, thought: BOSS_REACTION[Math.floor(Math.random() * BOSS_REACTION.length)] };
    }

    // Stealth enemy alert
    const stealthInArea = enemies.some(e => (e as any).isStealthed && !(e as any).revealed);

    // Combat thoughts
    let thoughtPool = [...(inRange.length >= 3 ? ["Too many!", "Overwhelmed!", "Need backup!", "Incoming!"] : []),
      ...(COMBAT[agent.personality] || COMBAT.balanced)];

    if (command === "FAST") thoughtPool = ["Rushing!", "Speed mode!", ...thoughtPool];
    else if (command === "STRONG") thoughtPool = ["Hit the heavy one!", "Maximum power!", ...thoughtPool];
    else if (command === "BASE") thoughtPool = ["Protect at all costs!", "Wall formation!", ...thoughtPool];

    if (stealthInArea) thoughtPool = [...STEALTH_ALERT, ...thoughtPool];

    const thought = thoughtPool[Math.floor(Math.random() * thoughtPool.length)];

    // Sort enemies by command
    let sorted: GameEnemy[];
    if (command === "FAST") sorted = [...inRange].sort((a, b) => b.speed - a.speed);
    else if (command === "STRONG") sorted = [...inRange].sort((a, b) => b.hp - a.hp);
    else sorted = [...inRange].sort((a, b) => a.x - b.x);

    // Healer priority (after boss)
    const healerTarget = sorted.find(e => (e as any).isHealer);
    if (healerTarget) sorted.unshift(sorted.splice(sorted.indexOf(healerTarget), 1)[0]);

    let targetId = sorted[0]?.id ?? null;
    if (sorted.length > 1 && Math.random() < 0.1) targetId = sorted[1].id;

    return { targetId, thought };
  }
}
