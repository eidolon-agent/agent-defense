export type HeroClass = "knight" | "archer" | "mage" | "rogue";
export type Personality = "balanced" | "aggressive" | "defensive" | "calculated";
export type Command = "FAST" | "STRONG" | "BASE";
export type GamePhase = "lobby" | "playing" | "victory" | "defeat";
export type EnemyType = "fast" | "tank" | "stealth" | "healer" | "boss" | "swarm";

export interface PlayerAgent {
  agentId: number;
  tokenId?: number;
  heroClass: HeroClass;
  personality: Personality;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  behaviorHash?: string;
  isDefault?: boolean;
  upgrades?: string[];
}

export interface GameAgent {
  id: number; x: number; y: number;
  heroClass: HeroClass; personality: Personality;
  hp: number; maxHp: number; damage: number;
  attackRange: number; attackCooldown: number; maxCooldown: number;
  decisionCooldown: number; targetId: number | null;
  thought: string; thoughtTimer: number; bobPhase: number; isNPC: boolean;
  turretAngle: number; hitFlash: number; level: number;
  damageDealt: number; enemiesKilled: number; abilitiesUsed: number; critsCount: number;
  upgrades: string[];
  regenHP: number; critChance: number;
  activeBuffs: Record<string, number>;
  abilityCooldowns: Record<string, number>;
  shadowStepActive: boolean;
  poisonTargets: Map<number, { end: number; dps: number }>;
  isRetreating?: boolean;
}

export interface GameEnemy {
  id: number; x: number; y: number; type: EnemyType;
  hp: number; maxHp: number; speed: number;
  reward: number; dmgToBase: number;
  hitFlash: number; wobble: number;
  isHealer?: boolean; healCooldown?: number;
  isStealthed?: boolean; revealed?: boolean;
  slowedUntil?: number;
  poisonUntil?: number;
}

export interface Projectile {
  id: number; x: number; y: number; targetId: number;
  speed: number; damage: number; color: string;
  trail: { x: number; y: number }[];
  isCrit?: boolean; isAoE?: boolean; aoeRadius?: number;
}

export interface Particle {
  x: number; y: number; life: number; maxLife: number;
  vx: number; vy: number; color: string; size: number;
  gravity?: number; type?: "spark" | "smoke" | "glow" | "text" | "ring";
  text?: string; fontSize?: number;
}

export interface MatchResult {
  score: number; wave: number;
  baseHP: number; maxBaseHP: number;
  enemiesKilled: number; xpEarned: number;
  goldEarned: number; playTime: number;
}
