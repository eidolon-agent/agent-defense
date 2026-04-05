/**
 * Agent Defense — Multiplayer Game Server (WebSocket)
 * Server-authoritative game loop: 20 ticks/sec
 * Multi-lane MOBA-style tower defense
 * 
 * Usage: cd /root/agent-defense/backend && npx tsx server-ws.ts
 * Or: pm2 start --name ad-ws "npx tsx backend/server-ws.ts"
 * Port: 8765
 */

import { WebSocketServer, WebSocket } from "ws";
import http from "http";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

type Lane = "top" | "mid" | "bot";
type HeroClass = "knight" | "archer" | "mage" | "rogue";
type EnemyVariant = "melee" | "ranged" | "caster" | "tank" | "boss";

interface HeroState {
  uid: string;          // player ID
  nick: string;         // display name
  heroClass: HeroClass;
  lane: Lane;
  x: number; y: number; // position within lane
  hp: number; maxHp: number;
  damage: number;
  range: number;
  speed: number;        // movement speed
  cooldown: number;     // attack cooldown (ms remaining)
  atkSpeed: number;     // ms between attacks
  killCount: number;
  deathCount: number;
  level: number;
  xp: number;
  xpNext: number;
  gold: number;         // personal gold
  items: string[];
  alive: boolean;
  respawnTimer: number;
  hitFlash: number;
}

interface EnemyState {
  uid: number;
  variant: EnemyVariant;
  lane: Lane;
  x: number; y: number;
  hp: number; maxHp: number;
  damage: number;
  speed: number;
  reward: number;
  rewardXp: number;
  hitFlash: number;
}

interface TurretState {
  lane: Lane;
  hp: number; maxHp: number;
  damage: number;
  range: number;
  cooldown: number;
  cooldownMax: number;
  alive: boolean;
  x: number; y: number;
}

interface GameState {
  heroes: HeroState[];
  enemies: EnemyState[];
  turrets: TurretState[];
  wave: number;
  phase: "lobby" | "playing" | "between_waves" | "game_over";
  waveTimer: number;    // ms until next wave spawns
  lobbyTimer: number;   // ms countdown in lobby
  score: number;
  baseHP: number;       // per-lane base HP tracked separately
  waveAnnounce: string;
  readyCount: number;
  maxPlayers: number;
  tickAccumulator: number;
  lastEnemySpawn: number;
  spawnQueue: Array<{ lane: Lane; variant: EnemyVariant; count: number }>;
}

interface Room {
  code: string;
  state: GameState;
  clients: Array<{ ws: WebSocket; uid: string }>;
  uidCounter: number;
  tickInterval: ReturnType<typeof setInterval>;
  lastTick: number;
}

// ═══════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════

const HERO_DEFS: Record<HeroClass, {
  hp: number; damage: number; range: number; speed: number; atkSpeed: number; color: string;
}> = {
  knight: { hp: 150, damage: 12, range: 60, speed: 1.8, atkSpeed: 900, color: "#3b82f6" },
  archer: { hp: 80, damage: 15, range: 200, speed: 1.5, atkSpeed: 600, color: "#e11d48" },
  mage:   { hp: 60, damage: 20, range: 220, speed: 1.2, atkSpeed: 1200, color: "#a855f7" },
  rogue:  { hp: 90, damage: 18, range: 100, speed: 2.2, atkSpeed: 500, color: "#10b981" },
};

const ENEMY_DEFS: Record<EnemyVariant, {
  hp: number; damage: number; speed: number; reward: number; xp: number;
}> = {
  melee:  { hp: 30, damage: 5, speed: 1.2, reward: 10, xp: 15 },
  ranged: { hp: 20, damage: 8, speed: 1.0, reward: 15, xp: 20 },
  caster: { hp: 25, damage: 12, speed: 0.8, reward: 20, xp: 30 },
  tank:   { hp: 80, damage: 10, speed: 0.6, reward: 30, xp: 40 },
  boss:   { hp: 500, damage: 25, speed: 0.4, reward: 100, xp: 150 },
};

const LANES: Lane[] = ["top", "mid", "bot"];
const MAX_PLAYERS = 4;
const LANES_START_X = { top: 150, mid: 250, bot: 350 }; // pixel Y positions within lane zone
const TURRET_DEF_X = 50; // where turret defends from base
const TURRET_DAMAGE_X = 650; // X position of turret (right side, near base)

// ═══════════════════════════════════════════════
// ROOM MANAGEMENT
// ═══════════════════════════════════════════════

const rooms = new Map<string, Room>();

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  if (rooms.has(code)) return genCode();
  return code;
}

function createRoom(): Room {
  const code = genCode();
  const room: Room = {
    code,
    state: {
      heroes: [], enemies: [], turrets: [],
      wave: 0, phase: "lobby", waveTimer: 0, lobbyTimer: 0,
      score: 0, baseHP: 100, waveAnnounce: "Waiting for players...",
      readyCount: 0, maxPlayers: MAX_PLAYERS,
      tickAccumulator: 0, lastEnemySpawn: 0, spawnQueue: [],
    },
    clients: [],
    uidCounter: 1,
    tickInterval: null!,
    lastTick: 0,
  };

  // Create defensive turrets (one per lane)
  for (const lane of LANES) {
    room.state.turrets.push({
      lane,
      hp: 200, maxHp: 200, damage: 15, range: 120,
      cooldown: 0, cooldownMax: 1000,
      alive: true, x: TURRET_DAMAGE_X, y: LANES_START_X[lane],
    });
  }

  rooms.set(code, room);
  return room;
}

function broadcast(room: Room, data: any) {
  const payload = JSON.stringify(data);
  for (const c of room.clients) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(payload);
  }
}

function broadcastState(room: Room) {
  const s = room.state;
  broadcast(room, {
    type: "state",
    phase: s.phase,
    wave: s.wave,
    score: s.score,
    baseHP: s.baseHP,
    waveAnnounce: s.waveAnnounce,
    heroes: s.heroes.map(h => ({
      uid: h.uid, nick: h.nick, heroClass: h.heroClass, lane: h.lane,
      x: Math.round(h.x), y: Math.round(h.y),
      hp: Math.max(0, Math.round(h.hp)), maxHp: h.maxHp,
      level: h.level, xp: h.xp, xpNext: h.xpNext,
      damage: h.damage, range: h.range, atkSpeed: h.atkSpeed,
      killCount: h.killCount, deathCount: h.deathCount,
      gold: h.gold, items: h.items,
      alive: h.alive, respawnTimer: h.respawnTimer,
    })),
    enemies: s.enemies.filter(e => e.hp > 0).map(e => ({
      uid: e.uid, variant: e.variant, lane: e.lane,
      x: Math.round(e.x), y: Math.round(e.y),
      hp: Math.max(0, Math.round(e.hp)), maxHp: e.maxHp,
    })),
    turrets: s.turrets.map(t => ({
      lane: t.lane, hp: Math.max(0, Math.round(t.hp)),
      maxHp: t.maxHp, alive: t.alive, x: t.x, y: t.y, damage: t.damage,
    })),
    readyCount: s.readyCount,
    clientCount: s.clients.length,
    maxPlayers: s.maxPlayers,
    lobbyTimer: s.lobbyTimer,
    ts: Date.now(),
  });
}

// ═══════════════════════════════════════════════
// GAME PHYSICS / LOGIC
// ═══════════════════════════════════════════════

function spawnEnemy(room: Room, lane: Lane, variant: EnemyVariant) {
  const def = ENEMY_DEFS[variant];
  const waveScale = 1 + room.state.wave * 0.15;
  const bossScale = variant === "boss" ? (1 + room.state.wave * 0.25) : 1;
  room.state.enemies.push({
    uid: room.uidCounter++,
    variant, lane,
    x: 0, y: LANES_START_X[lane] + (Math.random() - 0.5) * 20,
    hp: Math.round(def.hp * waveScale * bossScale),
    maxHp: Math.round(def.hp * waveScale * bossScale),
    damage: Math.round(def.damage * waveScale * bossScale),
    speed: def.speed,
    reward: Math.round(def.reward * waveScale),
    rewardXp: Math.round(def.xp * waveScale),
    hitFlash: 0,
  });
}

function startWave(room: Room) {
  room.state.phase = "playing";
  room.state.wave++;
  const w = room.state.wave;

  // Build queue based on wave difficulty
  if (w <= 2) {
    for (let i = 0; i < 3 + w; i++) room.state.spawnQueue.push({ lane: LANES[Math.floor(Math.random() * 3)], variant: "melee", count: 1 });
  } else if (w <= 4) {
    for (let i = 0; i < 3; i++) LANES.forEach(l => room.state.spawnQueue.push({ lane: l, variant: "melee", count: 1 }));
    for (let i = 0; i < w - 2; i++) room.state.spawnQueue.push({ lane: LANES[Math.floor(Math.random() * 3)], variant: "ranged", count: 1 });
  } else if (w <= 6) {
    for (let i = 0; i < 4; i++) LANES.forEach(l => room.state.spawnQueue.push({ lane: l, variant: i < 2 ? "melee" : "ranged", count: 1 }));
    for (let i = 0; i < w - 3; i++) room.state.spawnQueue.push({ lane: LANES[Math.floor(Math.random() * 3)], variant: "caster", count: 1 });
    if (w >= 5) room.state.spawnQueue.push({ lane: LANES[Math.floor(Math.random() * 3)], variant: "tank", count: 1 });
  } else {
    LANES.forEach(l => room.state.spawnQueue.push({ lane: l, variant: "melee", count: 2 }));
    LANES.forEach(l => room.state.spawnQueue.push({ lane: l, variant: "ranged", count: 1 }));
    room.state.spawnQueue.push({ lane: LANES[Math.floor(Math.random() * 3)], variant: "tank", count: 2 });
    room.state.spawnQueue.push({ lane: LANES[Math.floor(Math.random() * 3)], variant: "caster", count: 1 });
    if (w % 3 === 0) room.state.spawnQueue.push({ lane: "mid" as Lane, variant: "boss", count: 1 });
  }

  room.state.lastEnemySpawn = 0;
  room.state.waveAnnounce = `Wave ${w}`;
  broadcastState(room);
}

function tickRoom(room: Room, dt: number) {
  const s = room.state;

  // Lobby countdown
  if (s.phase === "lobby") {
    s.lobbyTimer = Math.max(0, s.lobbyTimer - dt);
    if (s.lobbyTimer <= 0 && s.readyCount >= 1) {
      startWave(room);
    }
    return;
  }

  if (s.phase !== "playing") return;

  // ── Spawn enemies from queue ──
  if (s.spawnQueue.length > 0) {
    s.tickAccumulator += dt;
    if (s.tickAccumulator > 800) {
      s.tickAccumulator -= 800;
      const item = s.spawnQueue.shift()!;
      for (let i = 0; i < item.count; i++) {
        spawnEnemy(room, item.lane, item.variant);
      }
    }
  }

  // ── Move enemies toward base ──
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    e.x += e.speed * (dt / 16) * 60; // normalize to ~60fps
    e.y += Math.sin(Date.now() * 0.003 + e.uid) * 0.1; // slight wobble
    if (e.hitFlash > 0) e.hitFlash -= dt * 0.003;

    // Reached base/turret area
    if (e.x >= TURRET_DAMAGE_X - 20) {
      s.baseHP -= e.damage;
      e.hp = 0;
      if (s.baseHP <= 0) {
        s.baseHP = 0;
        s.phase = "game_over";
        broadcast(room, { type: "game_over", phase: "game_over", score: s.score, wave: s.wave });
        broadcastState(room);
      }
    }
  }
  s.enemies = s.enemies.filter(e => e.hp > 0);

  // ── Turret auto-attack ──
  for (const t of s.turrets) {
    if (!t.alive) continue;
    t.cooldown -= dt;
    if (t.cooldown <= 0) {
      let target = s.enemies.find(e => {
        if (e.hp <= 0 || e.lane !== t.lane) return false;
        const dx = t.x - e.x;
        return dx >= 0 && dx < t.range;
      });
      if (target) {
        target.hp -= t.damage;
        target.hitFlash = 1;
        t.cooldown = t.cooldownMax;
      }
    }
  }

  // ── Hero auto-attack (server-side for sync) ──
  for (const h of s.heroes) {
    if (!h.alive) {
      h.respawnTimer -= dt;
      if (h.respawnTimer <= 0) {
        h.alive = true;
        h.hp = h.maxHp;
        h.x = 80;
        h.respawnTimer = 0;
        broadcastState(room);
      }
      continue;
    }

    h.hitFlash -= dt * 0.005;
    if (h.hitFlash < 0) h.hitFlash = 0;
    h.cooldown -= dt;

    // Auto-attack nearest enemy in same lane
    if (h.cooldown <= 0) {
      let nearest: typeof s.enemies[0] | null = null;
      let nd = Infinity;
      for (const e of s.enemies) {
        if (e.hp <= 0 || e.lane !== h.lane) continue;
        const d = Math.abs(e.x - h.x);
        if (d < h.range && d < nd) { nd = d; nearest = e; }
      }
      if (nearest) {
        nearest.hp -= h.damage;
        nearest.hitFlash = 1;
        h.cooldown = h.atkSpeed;

        // XP + kill credit
        if (nearest.hp <= 0) {
          h.xp += nearest.rewardXp;
          h.gold += nearest.reward;
          h.killCount++;
          s.score += nearest.reward;

          // Level up check
          while (h.xp >= h.xpNext) {
            h.xp -= h.xpNext;
            h.level++;
            h.xpNext = Math.round(h.xpNext * 1.3);
            h.maxHp += 15;
            h.hp = Math.min(h.maxHp, h.hp + 20);
            h.damage += 2;
            h.atkSpeed = Math.max(200, h.atkSpeed - 30);
            broadcastState(room); // announce level up
          }
        }
      }
    }

    // Slight lane positioning toward enemies
    if (s.enemies.some(e => e.hp > 0 && e.lane === h.lane)) {
      const laneEnemies = s.enemies.filter(e => e.hp > 0 && e.lane === h.lane);
      const closest = laneEnemies.reduce((a, b) => Math.abs(a.x - h.x) < Math.abs(b.x - h.x) ? a : b);
      const desiredX = Math.min(TURRET_DAMAGE_X - 30, closest.x - h.range + 20);
      h.x += Math.sign(desiredX - h.x) * Math.min(h.speed * (dt / 16) * 60, Math.abs(desiredX - h.x));
    } else {
      // Return to turret defense position
      h.x += Math.sign(TURRET_DAMAGE_X - 40 - h.x) * h.speed * (dt / 16) * 60 * 0.5;
    }
  }

  // ── Wave complete check ──
  if (s.enemies.length === 0 && s.spawnQueue.length === 0 && s.wave > 0) {
    s.phase = "between_waves";
    s.waveAnnounce = "Wave complete! Preparing next...";
    // Bonus gold
    for (const h of s.heroes) {
      if (h.alive) h.gold += 10 + s.wave * 5;
    }
    broadcastState(room);
    // Auto-start next wave after 5s
    s.waveTimer = 5000;
  }

  // ── Between waves countdown ──
  if (s.phase === "between_waves") {
    s.waveTimer -= dt;
    if (s.waveTimer <= 0) {
      startWave(room);
    }
  }

  broadcastState(room);
}

// ═══════════════════════════════════════════════
// PLAYER ACTIONS
// ═══════════════════════════════════════════════

function handleAction(room: Room, action: any, uid: string): string | null {
  const s = room.state;

  switch (action.type) {
    case "READY":
      if (s.phase !== "lobby") return null;
      if (!s.readyCount) s.readyCount = 1;
      if (s.readyCount < s.readyCount + 1) {
        // This is a simple check - in production, track per-player ready state
      }
      s.lobbyTimer = s.lobbyTimer > 3000 ? s.lobbyTimer : 2000;
      if (s.readyCount >= 1 && s.lobbyTimer > 2000) s.lobbyTimer = Math.min(s.lobbyTimer, 2000);
      // Auto-start when at least one player ready (single player friendly)
      if (s.heroes.length >= 1) s.lobbyTimer = Math.min(s.lobbyTimer, 1500);
      broadcastState(room);
      return null;

    case "CHOOSE_HERO": {
      const cls = action.heroClass as HeroClass;
      if (!HERO_DEFS[cls]) return "Invalid hero class";
      const existing = s.heroes.find(h => h.uid === uid);
      if (existing) {
        // Allow re-switching if not started yet
        if (s.phase !== "lobby") return "Game already in progress";
        existing.heroClass = cls;
        const def = HERO_DEFS[cls];
        existing.maxHp = def.hp;
        existing.hp = def.hp;
        existing.damage = def.damage;
        existing.range = def.range;
        existing.speed = def.speed;
        existing.atkSpeed = def.atkSpeed;
        broadcastState(room);
        return null;
      }

      if (s.heroes.length >= s.maxPlayers) return "Room full";
      const def = HERO_DEFS[cls];
      const lane = action.lane && LANES.includes(action.lane) ? action.lane as Lane : LANES[s.heroes.length % 3];
      s.heroes.push({
        uid, nick: action.nick || `Player`,
        heroClass: cls, lane,
        x: 80, y: LANES_START_X[lane],
        hp: def.hp, maxHp: def.hp,
        damage: def.damage, range: def.range, speed: def.speed,
        cooldown: 0, atkSpeed: def.atkSpeed,
        killCount: 0, deathCount: 0,
        level: 1, xp: 0, xpNext: 50,
        gold: 0, items: [],
        alive: true, respawnTimer: 0, hitFlash: 0,
      });
      s.readyCount++;
      if (s.readyCount >= 1 && s.heroes.length >= 1) {
        s.lobbyTimer = 1500;
      }
      broadcastState(room);
      return null;
    }

    case "MOVE":
    case "MOVE_TO": {
      const h = s.heroes.find(h => h.uid === uid);
      if (!h || !h.alive) return null;
      if (action.lane && LANES.includes(action.lane)) {
        h.lane = action.lane as Lane;
        h.y = LANES_START_X[action.lane as Lane];
      }
      if (typeof action.x === "number") {
        h.x = Math.max(20, Math.min(TURRET_DAMAGE_X - 10, action.x));
      }
      broadcastState(room);
      return null;
    }

    case "BUY_ITEM": {
      // Simplified: heal potion, damage boost, etc.
      const h = s.heroes.find(h => h.uid === uid);
      if (!h) return "No hero";

      const itemDefs: Record<string, { cost: number; effect: string }> = {
        "health_potion": { cost: 25, effect: "heal" },
        "damage_boost":  { cost: 50, effect: "damage" },
        "range_boost":   { cost: 30, effect: "range" },
      };
      const item = itemDefs[action.itemId];
      if (!item) return "Invalid item";
      if (h.gold < item.cost) return "Not enough gold";

      h.gold -= item.cost;
      if (item.effect === "heal") h.hp = h.maxHp;
      else if (item.effect === "damage") h.damage += 3;
      else if (item.effect === "range") h.range += 20;
      h.items.push(action.itemId);
      broadcastState(room);
      return null;
    }

    case "SKIP_WAIT":
      if (s.phase === "between_waves") {
        startWave(room);
      }
      return null;

    case "START_NOW":
      if (s.phase === "lobby" && s.heroes.length >= 1) {
        startWave(room);
      }
      return null;

    default:
      return "Unknown action";
  }
}

// ═══════════════════════════════════════════════
// WEBSOCKET SERVER
// ═══════════════════════════════════════════════

const PORT = parseInt(process.env.GAME_PORT || "8765");

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, uptime: process.uptime() }));
    return;
  }
  if (req.url === "/rooms") {
    const list = Array.from(rooms.entries()).map(([code, r]) => ({
      code,
      players: r.state.heroes.length,
      maxPlayers: r.state.maxPlayers,
      phase: r.state.phase,
      wave: r.state.wave,
    }));
    res.writeHead(200);
    res.end(JSON.stringify({ rooms: list }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", "http://localhost");
  const action = url.searchParams.get("action");
  const roomCode = url.searchParams.get("room");

  if (!action || (!roomCode && action !== "create")) {
    ws.send(JSON.stringify({ type: "error", error: "Missing parameters. Use: ws://host:port?action=create&nick=Name" }));
    ws.close();
    return;
  }

  const nick = url.searchParams.get("nick") || `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
  const uid = "p_" + Math.random().toString(36).substr(2, 10);

  if (action === "create") {
    const room = createRoom();
    room.clients.push({ ws, uid });

    ws.send(JSON.stringify({
      type: "room_created",
      roomCode: room.code,
      uid,
      message: "Room created! Share the 4-char code.",
    }));
    broadcastState(room);
    console.log(`🎮 Room ${room.code} created by ${nick}`);

    // Start game loop
    room.tickInterval = setInterval(() => {
      const now = Date.now();
      const dt = room.lastTick ? now - room.lastTick : 50;
      room.lastTick = now;
      tickRoom(room, dt);
    }, 50);

    setupClientHandlers(ws, room, uid, nick);
    return;
  }

  // Join existing room
  const room = rooms.get(roomCode!);
  if (!room) {
    ws.send(JSON.stringify({ type: "error", error: "Room not found" }));
    ws.close();
    return;
  }

  room.clients.push({ ws, uid });
  ws.send(JSON.stringify({
    type: "room_joined",
    roomCode: room.code,
    uid,
    message: `Joined room ${room.code}`,
  }));
  broadcastState(room);
  console.log(`👤 ${nick} joined room ${room.code} (${room.clients.length} players)`);

  // Start tick if not running
  if (!room.tickInterval) {
    room.tickInterval = setInterval(() => {
      const now = Date.now();
      const dt = room.lastTick ? now - room.lastTick : 50;
      room.lastTick = now;
      tickRoom(room, dt);
    }, 50);
  }

  setupClientHandlers(ws, room, uid, nick);
});

function setupClientHandlers(ws: WebSocket, room: Room, uid: string, nick: string) {
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "action") {
        const err = handleAction(room, msg.data, uid);
        if (err) {
          ws.send(JSON.stringify({ type: "error", error: err }));
        }
      } else if (msg.type === "ready") {
        handleAction(room, { type: "READY" }, uid);
      }
    } catch (e: any) {
      console.log(`Message error: ${e.message}`);
    }
  });

  ws.on("close", () => {
    const idx = room.clients.findIndex(c => c.uid === uid);
    if (idx !== -1) room.clients.splice(idx, 1);
    console.log(`👋 ${nick} left room ${room.code} (${room.clients.length} remaining)`);

    // Mark hero as disconnected
    const hero = room.state.heroes.find(h => h.uid === uid);
    if (hero) hero.alive = false;

    if (room.clients.length === 0) {
      console.log(`🗑️ Room ${room.code} removed (no clients)`);
      rooms.delete(room.code);
    } else {
      broadcastState(room);
    }
  });

  ws.on("error", (err: any) => {
    console.log(`Socket error for ${nick}: ${err.message}`);
  });
}

// ═══════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════

server.listen(PORT, () => {
  console.log(`\n⚔️  Agent Defense Multiplayer Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Rooms:  http://localhost:${PORT}/rooms`);
  console.log(`   Create: ws://localhost:${PORT}?action=create&nick=PlayerName`);
  console.log(`   Join:   ws://localhost:${PORT}?action=join&room=XXXX&nick=PlayerName`);
  console.log(`\n   VPS Public: 139.59.100.26:${PORT}`);
  console.log(`   Create: wss://139.59.100.26/ws?action=create&nick=Name`);
  console.log(`   Join:   wss://139.59.100.26/ws?action=join&room=XXXX&nick=Name\n`);
});
