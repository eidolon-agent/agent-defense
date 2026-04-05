/* eslint-disable */
// Multiplayer room store — shared in-memory state for Next.js API routes

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
  id: number; x: number; y: number; type: string;
  hp: number; maxHp: number; speed: number; reward: number; dmgToBase: number;
  hitFlash: number; isStealthed: boolean; revealed: boolean; bossPhase: number;
}

export interface MultiplayerState {
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
  waveAnnounce: string;
  totalWaves: number;
  maxPlayers: number;
  playersOnline: string[];
  playersReady: string[];
  spawnQueue: string[];
  lastAction: string;
  lastActionResult: string | null;
  updatedAt: number;
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
let uidCounter = 1000;
function uid() { return uidCounter++; }

export const rooms = new Map<string, MultiplayerState>();

export function createRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export function createNewRoom(playerId: string, maxPlayers: number = 4): MultiplayerState {
  return {
    heroes: [], enemies: [], wave: 0, gold: 50, score: 0,
    baseHP: 20, maxBaseHP: 20, started: false, gameOver: false, victory: false,
    betweenWaves: false, waveAnnounce: "Ready to start",
    totalWaves: WCOMP.length, maxPlayers,
    playersOnline: [playerId], playersReady: [],
    spawnQueue: [], lastAction: "", lastActionResult: null, updatedAt: Date.now(),
  };
}

export function startGame(state: MultiplayerState): void {
  if (state.started) return;
  state.started = true;
  state.wave = 1;
  state.spawnQueue = [...WCOMP[0]];
  state.waveAnnounce = "Wave 1";

  const classes = ["knight", "archer", "mage", "rogue"];
  for (let i = 0; i < state.playersOnline.length; i++) {
    const cls = classes[i % 4];
    const s = HERO_STATS[cls];
    state.heroes.push({
      id: uid(), playerId: state.playersOnline[i], heroClass: cls,
      x: AGENT_X + i * 40, y: MID_Y - 20 + i * 15,
      hp: s.hp, maxHp: s.hp, damage: s.damage, range: s.range,
      cooldown: 0, maxCooldown: s.cooldown, level: 1, hitFlash: 0, bobPhase: Math.random() * 6,
      damageDealt: 0, enemiesKilled: 0, critsCount: 0, critChance: 0,
      upgrades: [], isRetreating: false, retreatText: "", retreatTimer: 0,
    });
  }
}

export function gameTick(state: MultiplayerState): void {
  if (!state.started || state.gameOver || state.victory) return;

  if (state.betweenWaves) return; // wait for player to press next wave

  // Spawn
  if (state.spawnQueue.length > 0 && state.wave > 0) {
    const type = state.spawnQueue.shift()!;
    const cfg = ECFG[type];
    const waveScale = 1 + state.wave * 0.15;
    state.enemies.push({
      id: uid(), x: -10, y: MID_Y + (Math.random() - 0.5) * 40,
      type, hp: Math.ceil(cfg.hp * waveScale), maxHp: Math.ceil(cfg.hp * waveScale),
      speed: cfg.speed, reward: cfg.reward, dmgToBase: cfg.dmg,
      hitFlash: 0, isStealthed: type === "stealth", revealed: false, bossPhase: 0,
    });
  }

  // Move
  for (const en of state.enemies) {
    en.x += en.speed * 0.4; // ~20px/sec at 50fps
    if (en.hitFlash > 0) en.hitFlash -= 0.02;
    if (en.x >= BASE_X) {
      state.baseHP -= en.dmgToBase;
      en.hp = 0;
      if (state.baseHP <= 0) { state.baseHP = 0; state.gameOver = true; }
    }
  }
  state.enemies = state.enemies.filter(e => e.hp > 0);

  // Hero AI auto-attack
  for (const h of state.heroes) {
    h.bobPhase += 0.005;
    if (h.hitFlash > 0) h.hitFlash -= 0.008;
    h.cooldown -= 1;
    if (h.cooldown <= 0) {
      let nearest: GameEnemy | null = null;
      let nd = Infinity;
      for (const en of state.enemies) {
        if (en.hp <= 0 || (en.isStealthed && !en.revealed)) continue;
        const d = Math.hypot(en.x - h.x, en.y - h.y);
        if (d < h.range && d < nd) { nd = d; nearest = en; }
      }
      if (nearest) {
        const dmg = h.damage;
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
    // Retreat/return
    if (h.x > AGENT_X + h.heroes.length * 40) {
      h.x -= 0.5;
      h.hp = Math.min(h.maxHp, h.hp + 0.02);
    }
  }

  // Wave complete
  if (state.enemies.length === 0 && state.spawnQueue.length === 0 && state.wave > 0 && !state.betweenWaves) {
    state.betweenWaves = true;
    state.wave++;
    state.gold += 10 + state.wave * 5;
    state.baseHP = Math.min(state.maxBaseHP, state.baseHP + 2);
    if (state.wave <= WCOMP.length) {
      state.spawnQueue = [...WCOMP[state.wave - 1]];
      state.waveAnnounce = state.wave === WCOMP.length ? "FINAL WAVE!" : "Wave " + state.wave + " - Ready!";
    } else {
      state.victory = true;
    }
  }

  state.updatedAt = Date.now();
}

export function applyAction(state: MultiplayerState, action: any, playerId: string): string | null {
  switch (action.type) {
    case "JOIN":
      if (!state.playersOnline.includes(playerId)) {
        if (state.playersOnline.length >= state.maxPlayers) return "Room full";
        state.playersOnline.push(playerId);
      }
      if (!state.playersReady.includes(playerId)) state.playersReady.push(playerId);
      if (state.playersReady.length >= 1 && !state.started && state.playersOnline.length > 0) {
        startGame(state);
      }
      state.lastAction = "join";
      state.lastActionResult = `Player ${playerId.slice(-4)} joined. ${state.playersOnline.length}/${state.maxPlayers} ready.`;
      return null;

    case "BUY_HERO": {
      if (!action.heroClass || !HERO_STATS[action.heroClass]) return "Invalid hero class";
      if (state.heroes.find(h => h.playerId === playerId)) return "You already have a hero";
      const cls = action.heroClass;
      const s = HERO_STATS[cls];
      state.heroes.push({
        id: uid(), playerId, heroClass: cls,
        x: AGENT_X + state.heroes.length * 40, y: MID_Y,
        hp: s.hp, maxHp: s.hp, damage: s.damage, range: s.range,
        cooldown: 0, maxCooldown: s.cooldown, level: 1, hitFlash: 0, bobPhase: 0,
        damageDealt: 0, enemiesKilled: 0, critsCount: 0, critChance: 0,
        upgrades: [], isRetreating: false, retreatText: "", retreatTimer: 0,
      });
      state.lastAction = "buy_hero";
      state.lastActionResult = `${cls} purchased for ${playerId.slice(-4)}`;
      return null;
    }
    case "UPGRADE_HERO": {
      const h = state.heroes.find(hr => hr.id === action.heroId && hr.playerId === playerId);
      if (!h) return "Hero not found";
      const costs: Record<string, number> = { damage: 20 + h.level * 10, hp: 15 + h.level * 10, range: 12 + h.level * 8, crit: 25 + h.level * 10 };
      const cost = costs[action.stat];
      if (!cost || state.gold < cost) return "Not enough gold";
      state.gold -= cost;
      h.level++;
      if (action.stat === "damage") { h.damage = Math.ceil(h.damage * 1.25); h.upgrades.push("dmg"); }
      else if (action.stat === "hp") { h.maxHp = Math.round(h.maxHp * 1.2); h.hp = Math.min(h.maxHp, h.hp + 2); h.upgrades.push("hp"); }
      else if (action.stat === "range") { h.range = Math.round(h.range * 1.2); h.upgrades.push("rng"); }
      else if (action.stat === "crit") { h.critChance = Math.min(0.6, h.critChance + 0.08); h.upgrades.push("crit"); }
      state.lastAction = "upgrade";
      state.lastActionResult = `${h.heroClass} -> Lv${h.level}`;
      return null;
    }
    case "SKIP_WAIT":
      if (state.betweenWaves) {
        state.betweenWaves = false;
        state.lastAction = "next_wave";
        state.lastActionResult = "Next wave incoming!";
      }
      return null;
    case "HEAL":
      if (state.gold < 25) return "Not enough gold";
      state.gold -= 25;
      for (const h2 of state.heroes) h2.hp = h2.maxHp;
      state.lastAction = "heal";
      state.lastActionResult = "All heroes healed!";
      return null;
    default:
      return "Unknown action: " + action.type;
  }
}
