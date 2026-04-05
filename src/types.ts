// ===== Agent Defense — Game Type Definitions =====

export interface Vec2 {
  x: number;
  y: number;
}

// --- Defenders (towers) ---
export interface Defender {
  id: number;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  range: number;
  fireRate: number;       // ms between shots
  damage: number;
  lastFired: number;
  targetId: number | null;
  defenderType: DefenderType;
}

export type DefenderType = "rifleman" | "machinegun" | "mortar" | "sniper";

export interface DefenderBlueprint {
  type: DefenderType;
  cost: number;
  range: number;
  fireRate: number;
  damage: number;
  color: string;
}

export const DEFENDER_BLUEPRINTS: Record<DefenderType, DefenderBlueprint> = {
  rifleman:    { type: "rifleman",    cost: 10, range: 80, fireRate: 800,  damage: 1,  color: "#44dd44" },
  machinegun:  { type: "machinegun",  cost: 25, range: 70, fireRate: 200,  damage: 0.5,color: "#ddaa22" },
  mortar:      { type: "mortar",      cost: 40, range: 120,fireRate: 1500, damage: 3,  color: "#dd4444" },
  sniper:      { type: "sniper",      cost: 50, range: 150,fireRate: 2000, damage: 5,  color: "#44ddff" },
};

// --- Enemies ---
export interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  pathIndex: number;  // index in waypoint list
  type: EnemyType;
  hit: boolean;        // visual hit flash
  hitTimer: number;
}

export type EnemyType = "scout" | "soldier" | "tank" | "boss";

export interface EnemyBlueprint {
  type: EnemyType;
  hp: number;
  speed: number;
  reward: number;
  color: string;
  size: number;
}

// --- Wave definition ---
export interface WaveSpawner {
  type: EnemyType;
  count: number;
  interval: number;  // ms between spawns
}

export interface Wave {
  number: number;
  spawners: WaveSpawner[];
}

// --- Projectiles ---
export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
  type: "bullet" | "mortar" | "sniper";
  color: string;
}

// --- Particles ---
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// --- Game State ---
export interface GameState {
  money: number;
  lives: number;
  wave: number;
  waveActive: boolean;
  waveComplete: boolean;
  gameOver: boolean;
  gameWon: boolean;
  selectedDefenderType: DefenderType | null;
  defenders: Map<number, Defender>;
  enemies: Map<number, Enemy>;
  projectiles: Map<number, Projectile>;
  particles: Map<number, Particle>;
  nextId: number;
  lastTick: number;
  spawnQueue: { type: EnemyType; time: number }[];
}

// --- Map ---
export const GAME_W = 200;
export const GAME_H = 125;
export const GRID_COLS = 20;
export const GRID_ROWS = 12;
export const CELL_W = GAME_W / GRID_COLS;   // 10
export const CELL_H = GAME_H / GRID_ROWS;   // ~10.42

// Waypoints — enemies follow this left→right path
export const WAYPOINTS: Vec2[] = [
  { x: 0,    y: 60  },
  { x: 40,   y: 60  },
  { x: 40,   y: 30  },
  { x: 90,   y: 30  },
  { x: 90,   y: 90  },
  { x: 150,  y: 90  },
  { x: 150,  y: 50  },
  { x: 195,  y: 50  },
];

// Buildable grid cells (blocked near path)
export function buildableCols(): Set<string> {
  const cols = new Set<string>();
  // Simple heuristic: block cells close to the waypoint path
  for (let gx = 0; gx < GRID_COLS; gx++) {
    for (let gy = 0; gy < GRID_ROWS; gy++) {
      const cx = gx * CELL_W + CELL_W / 2;
      const cy = gy * CELL_H + CELL_H / 2;
      const blocked = isNearPath(cx, cy, 14);
      if (!blocked) cols.add(`${gx},${gy}`);
    }
  }
  return cols;
}

function isNearPath(x: number, y: number, threshold: number): boolean {
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i];
    const b = WAYPOINTS[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const dist = Math.hypot(x - px, y - py);
    if (dist < threshold) return true;
  }
  return false;
}
