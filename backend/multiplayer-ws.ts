/**
 * Agent Defense Multiplayer WebSocket Server
 * Runs as standalone process on VPS (PM2: pm2 start multiplayer-ws.ts -i 1)
 * Port: 8765
 */
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

// ─── Types ───
type HeroClass = "knight" | "archer" | "mage" | "rogue";
type EnemyType = "fast" | "tank" | "stealth" | "healer" | "boss" | "swarm";

interface Hero {
  id: number; playerId: string; heroClass: string;
  x: number; y: number; hp: number; maxHp: number;
  damage: number; range: number; cooldown: number; maxCooldown: number;
  level: number; hitFlash: number; bobPhase: number;
  damageDealt: number; enemiesKilled: number; critChance: number;
}

interface Enemy {
  id: number; x: number; y: number; type: string;
  hp: number; maxHp: number; speed: number; reward: number; dmgToBase: number;
  hitFlash: number; isStealthed: boolean; revealed: boolean; bossPhase: number;
}

interface Room {
  code: string;
  heroes: Hero[];
  enemies: Enemy[];
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
  spawnQueue: string[];
  clients: { ws: WebSocket; playerId: string }[];
  lastSpawn: number;
  lastClientAction: number;
}

// ─── Constants ───
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
let idCounter = 2000;
function uid() { return idCounter++; }

const rooms = new Map<string, Room>();
const PORT = parseInt(process.env.GAME_PORT || "8765");

function createRoom(maxPlayers: number): Room {
  return {
    code: "", heroes: [], enemies: [], wave: 0, gold: 50, score: 0,
    baseHP: 20, maxBaseHP: 20, started: false, gameOver: false, victory: false,
    betweenWaves: false, waveAnnounce: "Waiting...",
    totalWaves: WCOMP.length, maxPlayers, spawnQueue: [],
    clients: [], lastSpawn: 0, lastClientAction: Date.now(),
  };
}

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  if (rooms.has(code)) return genCode();
  return code;
}

function broadcast(room: Room) {
  const payload = JSON.stringify({
    type: "state",
    heroes: room.heroes,
    enemies: room.enemies.filter(e => e.hp > 0),
    wave: room.wave,
    gold: room.gold,
    score: room.score,
    baseHP: room.baseHP,
    maxBaseHP: room.maxBaseHP,
    started: room.started,
    gameOver: room.gameOver,
    victory: room.victory,
    betweenWaves: room.betweenWaves,
    waveAnnounce: room.waveAnnounce,
    totalWaves: room.totalWaves,
    maxPlayers: room.maxPlayers,
    clientCount: room.clients.length,
    ts: Date.now(),
  });
  for (const c of room.clients) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(payload);
  }
}

function spawnEnemy(room: Room, type: string) {
  const cfg = ECFG[type];
  const waveScale = 1 + room.wave * 0.15;
  room.enemies.push({
    id: uid(), x: -20, y: MID_Y + (Math.random() - 0.5) * 60,
    type, hp: Math.ceil(cfg.hp * waveScale), maxHp: Math.ceil(cfg.hp * waveScale),
    speed: cfg.speed, reward: cfg.reward, dmgToBase: cfg.dmg,
    hitFlash: 0, isStealthed: type === "stealth", revealed: false, bossPhase: 0,
  });
}

function startGame(room: Room) {
  room.started = true;
  room.wave = 1;
  room.spawnQueue = [...WCOMP[0]];
  room.waveAnnounce = "Wave 1";
  broadcast(room);
}

// ─── Game Tick (50ms = 20 ticks/sec) ───
setInterval(() => {
  for (const [, room] of rooms) {
    if (!room.started || room.gameOver || room.victory) continue;

    // Between waves - wait for SKIP_WAIT
    if (room.betweenWaves) continue;

    // Spawn from queue
    if (room.spawnQueue.length > 0) {
      const now = Date.now();
      if (now - room.lastSpawn > 600) {
        room.lastSpawn = now;
        spawnEnemy(room, room.spawnQueue.shift()!);
      }
    }

    // Move enemies
    for (const en of room.enemies) {
      if (en.hp <= 0) continue;
      en.x += en.speed * 0.5;
      if (en.hitFlash > 0) en.hitFlash -= 0.02;
      if (en.x >= BASE_X) {
        room.baseHP -= en.dmgToBase;
        en.hp = 0;
        if (room.baseHP <= 0) { room.baseHP = 0; room.gameOver = true; }
      }
    }
    room.enemies = room.enemies.filter(e => e.hp > 0);

    // Hero AI - auto attack
    for (const h of room.heroes) {
      h.bobPhase += 0.004;
      if (h.hitFlash > 0) h.hitFlash -= 0.008;
      h.cooldown -= 1;

      if (h.cooldown <= 0) {
        let nearest: Enemy | null = null;
        let nearDist = Infinity;
        for (const en of room.enemies) {
          if (en.hp <= 0 || (en.isStealthed && !en.revealed)) continue;
          const d = Math.hypot(en.x - h.x, en.y - h.y);
          if (d < h.range && d < nearDist) { nearDist = d; nearest = en; }
        }
        if (nearest) {
          nearest.hp -= h.damage;
          nearest.hitFlash = 1;
          if (nearest.hp <= 0) {
            room.gold += nearest.reward;
            room.score += nearest.reward;
            h.enemiesKilled++;
          }
          h.cooldown = h.maxCooldown;
        }
      }
    }

    // Wave complete check
    if (room.enemies.length === 0 && room.spawnQueue.length === 0 && room.wave > 0) {
      room.betweenWaves = true;
      room.wave++;
      if (room.wave <= room.totalWaves) {
        room.spawnQueue = [...WCOMP[room.wave - 1]];
        room.gold += 10 + room.wave * 5;
        room.baseHP = Math.min(room.maxBaseHP, room.baseHP + 2);
        room.waveAnnounce = room.wave === room.totalWaves ? "FINAL WAVE!" : "Wave " + room.wave + " - Ready!";
      } else {
        room.victory = true;
      }
      broadcast(room);
    }

    // Periodic broadcast (every 10 ticks for bandwidth)
    if (Date.now() % 500 < 50) broadcast(room);

    // Cleanup inactive rooms after 10 min
    if (room.clients.length === 0) continue;
    if (Date.now() - room.lastClientAction > 600000) {
      rooms.delete(room.code);
      console.log("Room", room.code, "cleaned up (inactive)");
    }
  }
}, 50);

// ─── WebSocket Server ───
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, uptime: process.uptime() }));
  }
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", "http://localhost");
  const action = url.searchParams.get("action");
  const roomCode = url.searchParams.get("room");

  if (!roomCode && action !== "create") {
    ws.send(JSON.stringify({ type: "error", error: "Missing room code" }));
    ws.close();
    return;
  }

  const playerId = "p" + Math.random().toString(36).substr(2, 8);

  if (action === "create") {
    const code = genCode();
    const room = createRoom(4);
    room.code = code;
    rooms.set(code, room);
    room.clients.push({ ws, playerId });

    ws.send(JSON.stringify({ type: "joined", playerId, roomCode: code, isNew: true, message: "Room created! Share the code." }));
    broadcast(room);
    console.log(`Room ${code} created by ${playerId}`);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(room, msg, playerId, ws);
      } catch {}
    });
    return;
  }

  // Join existing room
  const room = rooms.get(roomCode!);
  if (!room) {
    ws.send(JSON.stringify({ type: "error", error: "Room not found or expired" }));
    ws.close();
    return;
  }

  // Auto-add hero for first joiner
  const isFirst = room.clients.length === 0;
  room.clients.push({ ws, playerId });
  room.lastClientAction = Date.now();

  ws.send(JSON.stringify({ type: "joined", playerId, roomCode: room.code, isNew: false, message: "Joined! Game starts on first player." }));

  if (isFirst && !room.started) {
    startGame(room);
  } else {
    broadcast(room);
  }

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(room, msg, playerId, ws);
    } catch {}
  });
});

function handleMessage(room: Room, msg: any, playerId: string, ws: WebSocket) {
  room.lastClientAction = Date.now();

  switch (msg.type) {
    case "spawn": {
      // Client request: pick a hero class
      const cls = msg.class || "knight";
      if (!HERO_STATS[cls]) { ws.send(JSON.stringify({ type: "error", error: "Invalid class" })); return; }
      const existing = room.heroes.find(h => h.playerId === playerId);
      if (existing) { ws.send(JSON.stringify({ type: "error", error: "Already spawned" })); return; }
      const s = HERO_STATS[cls];
      room.heroes.push({
        id: uid(), playerId, heroClass: cls,
        x: AGENT_X + room.heroes.length * 40, y: MID_Y,
        hp: s.hp, maxHp: s.hp, damage: s.damage, range: s.range,
        cooldown: 0, maxCooldown: s.cooldown, level: 1, hitFlash: 0, bobPhase: Math.random() * 6,
        damageDealt: 0, enemiesKilled: 0, critChance: 0,
      });
      broadcast(room);
      break;
    }

    case "upgrade": {
      const hero = room.heroes.find(h => h.playerId === playerId);
      if (!hero) return;
      const costs: Record<string, number> = { damage: 20 + hero.level * 10, hp: 15 + hero.level * 10, range: 12 + hero.level * 8, crit: 25 + hero.level * 10 };
      const stat = msg.stat || "damage";
      const cost = costs[stat];
      if (room.gold < cost) { ws.send(JSON.stringify({ type: "error", error: "Not enough gold" })); return; }
      room.gold -= cost;
      hero.level++;
      if (stat === "damage") hero.damage = Math.ceil(hero.damage * 1.25);
      else if (stat === "hp") { hero.maxHp = Math.round(hero.maxHp * 1.2); hero.hp = Math.min(hero.maxHp, hero.hp + 2); }
      else if (stat === "range") hero.range = Math.round(hero.range * 1.2);
      else if (stat === "crit") hero.critChance = Math.min(0.6, hero.critChance + 0.08);
      broadcast(room);
      break;
    }

    case "shop": {
      if (room.gold < 25) { ws.send(JSON.stringify({ type: "error", error: "Not enough gold" })); return; }
      room.gold -= 25;
      for (const h of room.heroes) h.hp = h.maxHp;
      broadcast(room);
      break;
    }

    case "next_wave": {
      if (room.betweenWaves) {
        room.betweenWaves = false;
        broadcast(room);
      }
      break;
    }

    case "start": {
      if (!room.started) startGame(room);
      break;
    }
  }
}

// ─── Start ───
server.listen(PORT, () => {
  console.log(`Agent Defense Multiplayer Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Connect: ws://localhost:${PORT}?action=create`);
  console.log(`Connect: ws://localhost:${PORT}?room=XXXX`);
});
