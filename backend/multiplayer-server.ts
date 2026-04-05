/**
 * Agent Defense Multiplayer WebSocket Server
 * Run: npx ts-node backend/multiplayer-server.ts
 * Or: npm start  (from backend/ dir)
 */
import { WebSocketServer, WebSocket } from "ws";
import {
  createRoom, startGame, gameTick, applyAction,
  rooms, RoomState, WSClient, PlayerAction,
} from "./game-engine";

const SERVER_PORT = Number(process.env.MULTIPLAYER_PORT) || 8765;

// Broadcast game state to all clients in room (throttled)
function broadcastState(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const msg = JSON.stringify({
    type: "state",
    state: {
      heroes: room.state.heroes.map(h => ({
        ...h, hp: Math.max(0, Math.round(h.hp)),
        x: Math.round(h.x), y: Math.round(h.y),
        heroClass: h.heroClass,
      })),
      enemies: room.state.enemies.filter(e => e.hp > 0).map(e => ({
        ...e, hp: Math.max(0, Math.round(e.hp)),
        x: Math.round(e.x), y: Math.round(e.y),
        type: e.type,
      })),
      wave: room.state.wave,
      gold: room.state.gold,
      score: room.state.score,
      baseHP: room.state.baseHP,
      maxBaseHP: room.state.maxBaseHP,
      started: room.state.started,
      gameOver: room.state.gameOver,
      victory: room.state.victory,
      betweenWaves: room.state.betweenWaves,
      shopOpen: room.state.shopOpen,
      waveAnnounce: room.state.waveAnnounce,
      totalWaves: room.state.totalWaves,
      maxPlayers: room.state.maxPlayers,
    },
  });

  for (const client of room.clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

// Tick interval runs every ~50ms (20 ticks/sec) for smooth gameplay
let tickInterval: ReturnType<typeof setInterval> | null = null;

function startServerTicks() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    for (const [code, room] of rooms.entries()) {
      gameTick(room.state, 50);
      broadcastState(code);
      // Cleanup dead rooms
      if (room.state.gameOver || room.state.victory) {
        if (room.clients.length === 0) {
          rooms.delete(code);
        } else if (room.state.gameOver || room.state.victory) {
          for (const c of room.clients) {
            if (c.ws.readyState === WebSocket.OPEN) {
c.ws.send(JSON.stringify({ type: "state", state: room.state }));
            }
          }
        }
      }
    }
  }, 50);
  console.log("Game tick started (50ms interval)");
}

const wss = new WebSocketServer({ port: SERVER_PORT }, () => {
  console.log(`Multiplayer server on ws://localhost:${SERVER_PORT}`);
});

wss.on("connection", (ws, req) => {
  console.log("WS connect");

  // Extract room code from URL path: /room/abc123
  const url = new URL(req.url || "", "http://localhost");
  const roomCode = url.pathname.split("/").pop();

  if (!roomCode) {
    ws.send(JSON.stringify({ type: "error", message: "No room code" }));
    ws.close();
    return;
  }

  // Get or create room
  let room = rooms.get(roomCode);
  const isNew = !room;
  if (!room) {
    room = { state: createRoom(4), clients: [], tickTimer: null };
    rooms.set(roomCode, room);
    console.log(`Room ${roomCode} created`);
    startServerTicks();
  }

  // Generate player ID
  const playerId = "p" + Math.random().toString(36).substr(2, 6);
  const clientId: WSClient = { id: playerId, playerId, ws, room: roomCode };
  room.clients.push(clientId);

  console.log(`Player ${playerId} joined room ${roomCode} (total: ${room.clients.length})`);
  ws.send(JSON.stringify({ type: "room_joined", playerId, hero: room.state.heroes.length }));

  // Send current state immediately
  broadcastState(roomCode);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "action") {
        const err = applyAction(room.state, msg.action as PlayerAction, playerId);
        if (err) {
          ws.send(JSON.stringify({ type: "error", message: err }));
        }
        // If action bought hero, assign playerId to hero
        if (msg.action?.type === "BUY_HERO") {
          const hero = room.state.heroes.find(h => h.playerId === "");
          if (hero) hero.playerId = playerId;
          // Auto-start if all heroes placed
          if (room.state.heroes.every(h => h.playerId !== "") && room.state.heroes.length > 0 && !room.state.started) {
            startGame(room.state);
          }
        }
      }
      if (msg.type === "join") {
        room.state.playersReady = (room.state.playersReady || 0) + 1;
        if (room.state.playersReady >= 1 && !room.state.started) {
          startGame(room.state);
        }
      }
      if (msg.type === "skip_wait") {
        if (room.state.betweenWaves) {
          applyAction(room.state, { type: "SKIP_WAIT" }, playerId);
        }
      }
    } catch (err) {
      console.log("WS msg error:", err);
    }
  });

  ws.on("close", () => {
    const idx = room.clients.findIndex(c => c.id === playerId);
    if (idx !== -1) room.clients.splice(idx, 1);
    console.log(`Player ${playerId} left room ${roomCode} (remaining: ${room.clients.length})`);
    // Clear hero
    const hero = room.state.heroes.find(h => h.playerId === playerId);
    if (hero) hero.isRetreating = true;
    if (room.clients.length === 0) {
      console.log(`Room ${roomCode} empty, cleaning up`);
      rooms.delete(roomCode);
    }
  });

  ws.on("error", (err) => {
    console.log("WS error:", err.message);
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  if (tickInterval) clearInterval(tickInterval);
  wss.close();
  process.exit(0);
});

// Spawn enemies based on wave configuration
const WCOMP = [
  ["fast","fast","fast"],
  ["fast","fast","fast","tank"],
  ["fast","fast","tank","tank","stealth","fast"],
  ["fast","tank","swarm","swarm","swarm","swarm","swarm"],
  ["stealth","fast","tank","stealth","tank","healer","fast"],
  ["healer","tank","swarm","fast","stealth","tank","stealth","fast"],
  ["boss","fast","fast","tank","tank"],
  ["boss","stealth","stealth","healer","tank","fast","fast","swarm","swarm"],
];

// Add spawn logic to gameTick override — done in game-engine.ts already
// This server just handles the WebSocket layer, game loop is in gameTick()

// Override gameTick to handle spawning
const origGameTick = gameTick;
setInterval(() => {
  for (const [code, room] of rooms.entries()) {
    const st = room.state;
    // Spawn enemies if queue exists
    if (st.spawnQueue.length > 0 && st.wave > 0 && !st.betweenWaves) {
      const type = st.spawnQueue.shift()!;
      const ECFG: Record<string, { hp: number; speed: number; reward: number; dmg: number }> = {
        fast: { hp: 3, speed: 2.2, reward: 10, dmg: 2 },
        tank: { hp: 8, speed: 0.8, reward: 20, dmg: 5 },
        stealth: { hp: 2, speed: 3.0, reward: 25, dmg: 3 },
        healer: { hp: 5, speed: 1.0, reward: 35, dmg: 1 },
        swarm: { hp: 1, speed: 2.5, reward: 2,  dmg: 1 },
        boss: { hp: 120, speed: 0.5, reward: 100, dmg: 15 },
      };
      const cfg = ECFG[type];
      const MID_Y = 250;
      st.enemies.push({
        id: Math.floor(Math.random() * 900000) + 100000,
        x: 0, y: MID_Y + (Math.random() - 0.5) * 40,
        type, hp: Math.ceil(cfg.hp * (1 + st.wave * 0.15)),
        maxHp: Math.ceil(cfg.hp * (1 + st.wave * 0.15)),
        speed: cfg.speed, reward: cfg.reward, dmgToBase: cfg.dmg,
        hitFlash: 0, isStealthed: type === "stealth", revealed: false, bossPhase: 0,
      });
    }
    // Advance between waves
    if (st.betweenWaves && st.enemies.length === 0 && st.spawnQueue.length === 0) {
      st.shopOpen = true;
      st.wave++;
      if (st.wave <= WCOMP.length) {
        st.spawnQueue = [...WCOMP[st.wave - 1]];
        st.gold += 10 + st.wave * 5;
        st.baseHP = Math.min(st.maxBaseHP, st.baseHP + 2);
        st.waveAnnounce = st.wave === WCOMP.length ? "FINAL WAVE!" : "Wave " + st.wave;
        st.betweenWaves = false;
      } else {
        st.victory = true;
      }
    }
  }
}, 800); // Spawn check every 800ms
