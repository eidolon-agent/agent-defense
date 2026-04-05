/* eslint-disable */
// Server-authoritative game loop for Agent Defense multiplayer
// Runs on Node.js (no DOM, no browser APIs)

export type PlayerAction = {
  type: string;
  heroId?: number;
  stat?: string;
  class?: string;
  itemId?: string;
};

export interface WSClient {
  id: string;
  playerId: string;
  ws: any;
  room: string;
}

export interface RoomState {
  heroes: GameHero[];
  enemies: GameEnemy[];
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
  maxPlayers: number;
  spawnQueue: string[];
}

export interface GameHero {
  id: number;
  playerId: string;
  heroClass: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  cooldown: number;
  maxCooldown: number;
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

export interface GameEnemy {
  id: number;
  x: number;
  y: number;
  type: string;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  dmgToBase: number;
  hitFlash: number;
  isStealthed: boolean;
  revealed: boolean;
  bossPhase: number;
}

const HERO_STATS: Record<string, { hp: number; damage: number; range: number; cooldown: number }> = {
  knight:  { hp: 18, damage: 4,  range: 120, cooldown: 900 },
  archer:  { hp: 10, damage: 4,  range: 220, cooldown: 500 },
  mage:    { hp: 8,  damage: 3,  range: 250, cooldown: 600 },
  rogue:   { hp: 10, damage: 5,  range: 160, cooldown: 450 },
};

const ECFG: Record<string, { hp: number; speed: number; reward: number; dmg: number }> = {
  fast:    { hp: 3, speed: 2.2, reward: 10, dmg: 2 },
  tank:    { hp: 8, speed: 0.8, reward: 20, dmg: 5 },
  stealth: { hp: 2, speed: 3.0, reward: 25, dmg: 3 },
  healer:  { hp: 5, speed: 1.0, reward: 35, dmg: 1 },
  swarm:   { hp: 1, speed: 2.5, reward: 2,  dmg: 1 },
  boss:    { hp: 120, speed: 0.5, reward: 100, dmg: 15 },
};

const WCOMP: string[][] = [
  ["fast","fast","fast"],
  ["fast","fast","fast","tank"],
  ["fast","fast","tank","tank","stealth","fast"],
  ["fast","tank","swarm","swarm","swarm","swarm","swarm"],
  ["stealth","fast","tank","stealth","tank","healer","fast"],
  ["healer","tank","swarm","fast","stealth","tank","stealth","fast"],
  ["boss","fast","fast","tank","tank"],
  ["boss","stealth","stealth","healer","tank","fast","fast","swarm","swarm"],
];

const AGENT_X = 140, MID_Y = 250, BASE_X = 760;

function uid(): number { return Math.floor(Math.random() * 900000) + 100000; }

export function createRoom(maxPlayers: number): RoomState {
  return {
    heroes: [], enemies: [], wave: 0, gold: 50, score: 0,
    baseHP: 20, maxBaseHP: 20, started: false, gameOver: false, victory: false,
    betweenWaves: false, shopOpen: false, waveAnnounce: "Waiting for players...",
    totalWaves: WCOMP.length, maxPlayers, spawnQueue: [],
  };
}

export function startGame(state: RoomState): void {
  state.started = true;
  const classList = ["knight", "archer", "mage", "rogue"];
  for (let i = 0; i < state.maxPlayers; i++) {
    const cls = classList[i % 4];
    const s = HERO_STATS[cls];
    state.heroes.push({
      id: uid(), playerId: "", heroClass: cls,
      x: AGENT_X + i * 40, y: MID_Y - 20 + i * 15,
      hp: s.hp, maxHp: s.hp, damage: s.damage, range: s.range,
      cooldown: 0, maxCooldown: s.cooldown, level: 1, hitFlash: 0, bobPhase: Math.random() * 6,
      damageDealt: 0, enemiesKilled: 0, critsCount: 0, critChance: 0,
      upgrades: [], isRetreating: false, retreatText: "", retreatTimer: 0,
    });
  }
}

export function gameTick(state: RoomState, dt: number = 50): void {
  if (!state.started || state.gameOver || state.victory) return;

  if (state.betweenWaves) {
    state.shopOpen = true;
    return;
  }

  if (state.spawnQueue.length > 0 && state.wave > 0) {
    const type = state.spawnQueue.shift()!;
    const cfg = ECFG[type];
    const waveScale = 1 + state.wave * 0.15;
    state.enemies.push({
      id: uid(), x: -10, y: MID_Y + (Math.random() - 0.5) * 40,
      type, hp: Math.ceil(cfg.hp * waveScale),
      maxHp: Math.ceil(cfg.hp * waveScale), speed: cfg.speed,
      reward: cfg.reward, dmgToBase: cfg.dmg, hitFlash: 0,
      isStealthed: type === "stealth", revealed: false, bossPhase: type === "boss" ? 0 : -1,
    });
  }

  for (const en of state.enemies) {
    en.x += en.speed * (dt / 16);
    if (en.hitFlash > 0) en.hitFlash -= dt * 0.01;
    if (en.x >= BASE_X) {
      state.baseHP -= en.dmgToBase;
      en.hp = 0;
      if (state.baseHP <= 0) { state.baseHP = 0; state.gameOver = true; }
    }
  }
  state.enemies = state.enemies.filter(e => e.hp > 0);

  for (const h of state.heroes) {
    h.bobPhase += dt * 0.005;
    if (h.hitFlash > 0) h.hitFlash -= dt * 0.008;
    h.cooldown -= dt;
    if (h.cooldown <= 0) {
      let nearest: GameEnemy | null = null;
      let nd = Infinity;
      for (const en of state.enemies) {
        if (en.hp <= 0 || (en.isStealthed && !en.revealed)) continue;
        const d = Math.hypot(en.x - h.x, en.y - h.y);
        if (d < h.range && d < nd) { nd = d; nearest = en; }
      }
      if (nearest) {
        const isCrit = Math.random() < h.critChance;
        const dmg = h.damage * (isCrit ? 2 : 1);
        nearest.hp -= dmg;
        nearest.hitFlash = 1;
        if (nearest.hp <= 0) {
          state.gold += nearest.reward;
          state.score += nearest.reward;
          h.enemiesKilled++;
        }
        h.cooldown = h.maxCooldown;
      }
    }
  }

  if (state.enemies.length === 0 && state.spawnQueue.length === 0 && state.wave > 0 && !state.betweenWaves) {
    state.betweenWaves = true;
    state.shopOpen = true;
    state.wave++;
    if (state.wave <= WCOMP.length) {
      state.spawnQueue = [...WCOMP[state.wave - 1]];
      state.gold += 10 + state.wave * 5;
      state.baseHP = Math.min(state.maxBaseHP, state.baseHP + 2);
      state.waveAnnounce = state.wave === WCOMP.length ? "FINAL WAVE!" : "Wave " + state.wave;
    } else {
      state.victory = true;
    }
  }
}

export function applyAction(state: RoomState, action: PlayerAction, playerId: string): string | null {
  switch (action.type) {
    case "BUY_HERO": {
      if (!action.class || !["knight","archer","mage","rogue"].includes(action.class)) return "Invalid class";
      const hc = action.class;
      const s = HERO_STATS[hc];
      state.heroes.push({
        id: uid(), playerId, heroClass: hc,
        x: AGENT_X + state.heroes.length * 40, y: MID_Y,
        hp: s.hp, maxHp: s.hp, damage: s.damage, range: s.range,
        cooldown: 0, maxCooldown: s.cooldown, level: 1, hitFlash: 0, bobPhase: 0,
        damageDealt: 0, enemiesKilled: 0, critsCount: 0, critChance: 0,
        upgrades: [], isRetreating: false, retreatText: "", retreatTimer: 0,
      });
      return null;
    }
    case "UPGRADE_HERO": {
      if (!action.heroId || !action.stat) return "Missing params";
      const h = state.heroes.find(hr => hr.id === action.heroId);
      if (!h || h.playerId !== playerId) return "Not your hero";
      const costs: Record<string, number> = { damage: 20 + h.level * 10, hp: 15 + h.level * 10, range: 12 + h.level * 8, crit: 25 + h.level * 10 };
      const cost = costs[action.stat];
      if (!cost || state.gold < cost) return "Not enough gold";
      state.gold -= cost;
      h.level++;
      if (action.stat === "damage") { h.damage = Math.ceil(h.damage * 1.25); h.upgrades.push("dmg"); }
      else if (action.stat === "hp") { h.maxHp = Math.round(h.maxHp * 1.2); h.hp = Math.min(h.maxHp, h.hp + 2); h.upgrades.push("hp"); }
      else if (action.stat === "range") { h.range = Math.round(h.range * 1.2); h.upgrades.push("rng"); }
      else if (action.stat === "crit") { h.critChance = Math.min(0.6, h.critChance + 0.08); h.upgrades.push("crit"); }
      return null;
    }
    case "SKIP_WAIT":
      if (state.betweenWaves) {
        state.betweenWaves = false;
        state.shopOpen = false;
        if (state.wave > 0 && state.enemies.length === 0 && state.spawnQueue.length === 0) {
          state.wave++;
          if (state.wave <= WCOMP.length) {
            state.spawnQueue = [...WCOMP[state.wave - 1]];
            state.gold += 10 + state.wave * 5;
            state.waveAnnounce = state.wave === WCOMP.length ? "FINAL WAVE!" : "Wave " + state.wave;
          } else { state.victory = true; }
        }
      }
      return null;
    case "SHOP_BUY": {
      if (!action.itemId) return "Missing item";
      if (state.gold < 25) return "Not enough gold";
      state.gold -= 25;
      if (action.itemId === "heal_all") for (const h2 of state.heroes) h2.hp = h2.maxHp;
      else if (action.itemId === "damage_up") for (const h2 of state.heroes) h2.damage = Math.ceil(h2.damage * 1.15);
      return null;
    }
    default:
      return "Unknown action";
  }
}

export const rooms = new Map<string, {
  state: RoomState;
  clients: WSClient[];
  tickTimer: ReturnType<typeof setInterval> | null;
}>();
