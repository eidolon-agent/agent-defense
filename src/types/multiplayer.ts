export type HeroClass = "knight" | "archer" | "mage" | "rogue";
export type EnemyType = "fast" | "tank" | "stealth" | "healer" | "boss" | "swarm";
export type PlayerAction =
  | { type: "BUY_HERO"; class: HeroClass }
  | { type: "UPGRADE_HERO"; heroId: number; stat: string }
  | { type: "SHOP_BUY"; itemId: string }
  | { type: "SKIP_WAIT" };

export interface HeroStats {
  id: number;
  playerId: string;
  heroClass: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  maxCooldown: number;
  cooldown: number;
  level: number;
  hitFlash: number;
  bobPhase: number;
  damageDealt: number;
  enemiesKilled: number;
  critsCount: number;
  critChance: number;
  upgrades: string[];
  isRetreating: boolean;
  retreatText: string;
  retreatTimer: number;
}

export interface EnemyState {
  id: number; x: number; y: number; type: string;
  hp: number; maxHp: number; speed: number; reward: number; dmgToBase: number;
  hitFlash: number; isStealthed: boolean; revealed: boolean;
  bossPhase: number;
}

export interface GameState {
  heroes: HeroStats[];
  enemies: EnemyState[];
  wave: number;
  gold: number;
  score: number;
  baseHP: number;
  maxBaseHP: number;
  started: boolean;
  gameOver: boolean;
  victory: boolean;
  betweenWaves: boolean;
  shopOpen: boolean;
  waveAnnounce: string;
  totalWaves: number;
  playersReady: number;
  maxPlayers: number;
  spawnQueue: string[];
}
