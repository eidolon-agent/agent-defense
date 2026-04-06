"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ═══════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════

const GW = 800, GH = 500;
const PIXEL_SCALE = 4;
const PW = Math.floor(GW / PIXEL_SCALE);
const PH = Math.floor(GH / PIXEL_SCALE);

const LANES_COLORS: Record<string, string> = {
  top: "#4a90d9", mid: "#f0d060", bot: "#40c060"
};

const HERO_COLORS: Record<string, { body: string; light: string; dark: string }> = {
  knight: { body: "#3b82f6", light: "#60a5fa", dark: "#1e40af" },
  archer: { body: "#e11d48", light: "#fb7185", dark: "#9f1239" },
  mage:   { body: "#a855f7", light: "#c084fc", dark: "#7c3aed" },
  rogue:  { body: "#10b981", light: "#34d399", dark: "#047857" },
};

const HERO_DEFS: Record<string, { hp: number; damage: number; range: number; color: string }> = {
  knight: { hp: 150, damage: 12, range: 60,  color: "#3b82f6" },
  archer: { hp: 80,  damage: 15, range: 200, color: "#e11d48" },
  mage:   { hp: 60,  damage: 20, range: 220, color: "#a855f7" },
  rogue:  { hp: 90,  damage: 18, range: 100, color: "#10b981" },
};

const ENEMY_COLORS: Record<string, { body: string; light: string }> = {
  melee:  { body: "#cc5544", light: "#ff8877" },
  ranged: { body: "#cc8844", light: "#ffaa66" },
  caster: { body: "#aa44cc", light: "#cc66ff" },
  tank:   { body: "#666666", light: "#999999" },
  boss:   { body: "#ff2222", light: "#ff6666" },
};

// WS URL — Caddy reverse proxy on VPS
const VPS_IP = "139.59.100.26";
const WS_URL = `wss://${VPS_IP}/ws`;

// ═══════════════════════════════════════════════
// LOBBY
// ═══════════════════════════════════════════════

interface RoomInfo { code: string; players: number; maxPlayers: number; phase: string; wave: number; }

export default function MultiplayerPage() {
  const [screen, setScreen] = useState<"lobby" | "hero_select" | "game" | "disconnected">("lobby");
  const [roomCode, setRoomCode] = useState("");
  const [uid, setUid] = useState("");
  const [nick, setNick] = useState("");
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [joinInput, setJoinInput] = useState("");
  const [status, setStatus] = useState("idle");

  // Refresh room list
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://${VPS_IP}:8765/rooms`);
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms || []);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const createRoom = useCallback(async () => {
    const playerName = nick || `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
    setNick(playerName);
    const ws = new WebSocket(`${WS_URL}?action=create&nick=${encodeURIComponent(playerName)}`);

    ws.onopen = () => setStatus("connected");
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);
      if (msg.type === "room_created") {
        setRoomCode(msg.roomCode);
        setUid(msg.uid);
        setScreen("hero_select");
      } else if (msg.type === "state") {
        // Store state for passing to game
      }
    };
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setScreen("disconnected");
  }, [nick]);

  const joinRoom = useCallback((code: string) => {
    const playerName = nick || `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
    setNick(playerName);
    setJoinInput(code.toUpperCase());
    setStatus("connecting");
    const ws = new WebSocket(`${WS_URL}?action=join&room=${encodeURIComponent(code.toUpperCase())}&nick=${encodeURIComponent(playerName)}`);

    ws.onopen = () => setStatus("connected");
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);
      if (msg.type === "room_joined") {
        setRoomCode(msg.roomCode);
        setUid(msg.uid);
        setScreen("hero_select");
      } else if (msg.type === "error") {
        setStatus("error");
      }
    };
    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      if (screen === "hero_select") setScreen("disconnected");
    };
  }, [nick, screen]);

  if (screen === "hero_select") {
    return <HeroSelectScreen roomCode={roomCode} uid={uid} nick={nick} />;
  }

  if (screen === "disconnected") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-3">🔌</div>
          <h1 className="text-3xl font-bold text-red-400 mb-2">Disconnected</h1>
          <p className="text-stone-500 mb-4">Lost connection to server</p>
          <button onClick={() => window.location.reload()}
            className="px-8 py-3 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded-xl font-semibold">
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex items-center justify-center">
      <div className="max-w-lg w-full px-6 py-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">⚔️</div>
          <h1 className="text-4xl font-bold text-orange-500 mb-1">AGENT DEFENSE</h1>
          <p className="text-stone-500 text-sm">Multiplayer MOBA — Co-op Tower Defense</p>
        </div>

        {/* Nickname */}
        <div className="mb-6">
          <label className="block text-stone-400 text-xs mb-1">Your Name</label>
          <input type="text" value={nick} onChange={e => setNick(e.target.value)}
            placeholder="Enter your nickname..."
            className="w-full px-4 py-3 bg-stone-900/80 border border-stone-700 rounded-xl text-amber-100 placeholder-stone-600 focus:border-amber-500 focus:outline-none"
            maxLength={16}
            onKeyDown={e => { if (e.key === "Enter" && nick.trim()) joinRoom(joinInput); }} />
        </div>

        {/* Create Room */}
        <button onClick={createRoom}
          className="w-full px-8 py-4 bg-gradient-to-r from-amber-900/80 to-red-900/80 hover:from-amber-800 hover:to-red-800 text-amber-100 rounded-xl font-semibold text-lg transition border border-amber-700/30 mb-4">
          🏰 Create Room
        </button>

        {/* Join Room */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <input type="text" value={joinInput} onChange={e => setJoinInput(e.target.value.toUpperCase())}
              placeholder="4-char room code"
              className="w-full px-4 py-3 bg-stone-900/80 border border-stone-700 rounded-xl text-amber-100 placeholder-stone-600 focus:border-amber-500 focus:outline-none font-mono text-center tracking-widest text-lg"
              maxLength={4}
              onKeyDown={e => { if (e.key === "Enter" && joinInput.length >= 3) joinRoom(joinInput); }} />
          </div>
          <button onClick={() => joinInput.length >= 3 && joinRoom(joinInput)}
            className="px-6 py-3 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded-xl font-semibold border border-amber-500/50">
            Join
          </button>
        </div>

        {/* Room list */}
        {rooms.length > 0 && (
          <div>
            <h3 className="text-stone-400 text-xs mb-2">Active Rooms</h3>
            <div className="space-y-2">
              {rooms.map(r => (
                <button key={r.code} onClick={() => joinRoom(r.code)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-stone-900/60 border border-stone-800 rounded-xl hover:border-amber-700/50 transition">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg text-amber-400 tracking-widest">{r.code}</span>
                    <span className="text-stone-500 text-xs">{r.phase === "lobby" ? "🟢 Lobby" : `⚔️ Wave ${r.wave}`}</span>
                  </div>
                  <span className="text-stone-400 text-xs">{r.players}/{r.maxPlayers}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {status === "connecting" && (
          <p className="text-amber-400 text-center text-sm mt-4">
            Connecting...
          </p>
        )}
        {status === "error" && (
          <p className="text-red-400 text-center text-sm mt-4">
            Connection failed. Check room code.
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// HERO SELECTION
// ═══════════════════════════════════════════════

function HeroSelectScreen({ roomCode, uid, nick }: { roomCode: string; uid: string; nick: string }) {
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<string>("top");
  const [screen, setScreen] = useState<"select" | "game" | "game_over">("select");
  const [gameStateRef, setGameStateRef] = useState<any>(null);

  // WS connection
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}?action=join&room=${roomCode}&nick=${encodeURIComponent(nick)}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "state") {
          setGameState(msg);
          setGameStateRef(msg);
          if (msg.phase === "playing" || msg.phase === "between_waves") {
            setScreen("game");
          }
        } else if (msg.type === "game_over") {
          setScreen("game_over");
        } else if (msg.type === "state" && (msg.phase === "playing" || msg.phase === "between_waves") && screen === "select") {
          setScreen("game");
        }
      } catch {}
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [roomCode, nick]);

  const sendAction = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "action", data }));
    }
  }, []);

  const chooseHero = useCallback(() => {
    if (!selectedClass) return;
    sendAction({ type: "CHOOSE_HERO", heroClass: selectedClass, lane: selectedLane, nick });
    // Small delay then start game
    setTimeout(() => {
      sendAction({ type: "READY" });
      sendAction({ type: "START_NOW" });
      setScreen("game");
    }, 500);
  }, [selectedClass, selectedLane, nick, sendAction]);

  if (screen === "game" && gameState) {
    return <GameCanvas gameState={gameState} wsRef={wsRef} uid={uid} sendAction={sendAction} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex items-center justify-center">
      <div className="max-w-lg w-full px-6 py-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-amber-400 mb-1">Choose Your Hero</h2>
          <p className="text-stone-500 text-sm">Room: <span className="font-mono text-amber-300">{roomCode}</span></p>
        </div>

        {/* Lane selection */}
        <div className="mb-6">
          <label className="block text-stone-400 text-xs mb-2">Select Lane</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(LANES_COLORS).map(([lane, color]) => (
              <button key={lane} onClick={() => setSelectedLane(lane)}
                className={`py-3 rounded-xl font-semibold transition border text-sm ${
                  selectedLane === lane
                    ? "border-amber-500 bg-amber-900/40 text-amber-200"
                    : "border-stone-700 bg-stone-900/60 text-stone-400 hover:text-stone-300"
                }`}>
                <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: color }} />
                {lane.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Hero selection */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {Object.entries(HERO_DEFS).map(([cls, def]) => (
            <button key={cls} onClick={() => setSelectedClass(cls)}
              className={`p-4 rounded-xl text-left transition border ${
                selectedClass === cls
                  ? "border-amber-500 bg-amber-900/40"
                  : "border-stone-700 bg-stone-900/60 hover:border-stone-500"
              }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: def.color }} />
                <span className="text-amber-100 font-bold capitalize">{cls}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-500">
                <span>HP: <span className="text-stone-300">{def.hp}</span></span>
                <span>DMG: <span className="text-stone-300">{def.damage}</span></span>
                <span>RNG: <span className="text-stone-300">{def.range}</span></span>
                <span className="text-stone-400">Role: {cls === "knight" ? "Tank/Melee" : cls === "archer" ? "Ranged DPS" : cls === "mage" ? "High DPS/Glass" : "Fast DPS"}</span>
              </div>
            </button>
          ))}
        </div>

        <button onClick={chooseHero} disabled={!selectedClass}
          className="w-full py-4 bg-gradient-to-r from-amber-800 to-red-900 hover:from-amber-700 hover:to-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 rounded-xl font-semibold text-lg transition border border-amber-700/30">
          ⚔️ Deploy to {selectedLane.toUpperCase()} Lane
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// GAME CANVAS
// ═══════════════════════════════════════════════

function GameCanvas({ gameState, wsRef, uid, sendAction }: {
  gameState: any;
  wsRef: React.RefObject<WebSocket | null>;
  uid: string;
  sendAction: (data: any) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(gameState);
  const [showShop, setShowShop] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  stateRef.current = gameState;

  // ── Canvas render loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PW;
    canvas.height = PH;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = false;

    let raf: number;
    const loop = () => {
      const state = stateRef.current;
      if (!state) { raf = requestAnimationFrame(loop); return; }

      if (state.phase === "game_over") {
        setGameOver(true);
      }

      // ── Background ──
      ctx.fillStyle = "#0a0805";
      ctx.fillRect(0, 0, PW, PH);

      // ── Lane paths (top/mid/bot) ──
      const laneYMap: Record<string, number> = { top: 150, mid: 250, bot: 350 };
      for (const [lane, col] of [["top","#4a90d9"],["mid","#f0d060"],["bot","#40c060"]] as [string,string][]) {
        const yPx = Math.floor(laneYMap[lane] / PIXEL_SCALE);
        // Lane ground
        for (let x = 0; x < PW; x++) {
          for (let dy = -3; dy <= 3; dy++) {
            const shade = 18 + Math.floor(Math.sin(x * 0.3 + dy * 0.7) * 4);
            ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 8})`;
            ctx.fillRect(x, yPx + dy, 1, 1);
          }
        }
        // Glowing path center
        for (let x = 0; x < PW; x += 3) {
          const flick = 0.08 + 0.04 * Math.sin(Date.now() * 0.002 + x * 0.15);
          ctx.fillStyle = `rgba(160,100,40,${flick})`;
          ctx.fillRect(x, yPx, 2, 1); ctx.fillRect(x + 1, yPx + 1, 1, 1);
        }
        // Lane border lines
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(0, yPx - 4, PW, 1);
        ctx.fillRect(0, yPx + 4, PW, 1);
      }

      // Sky gradient (top/bottom edges)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, PH);
      skyGrad.addColorStop(0, "rgba(0,0,0,0.4)");
      skyGrad.addColorStop(0.15, "rgba(0,0,0,0)");
      skyGrad.addColorStop(0.85, "rgba(0,0,0,0)");
      skyGrad.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, PW, PH);

      // ── Base / Fortress (right side) ──
      const ratio = state.baseHP / 100;
      const bx = PW - 12;
      const mid = Math.floor(PH / 2);
      const low = ratio < 0.3;
      const wallCol = low ? "#2d0505" : "#0a1620";
      const edgeCol = low ? "#882222" : "#2d5a87";
      const trimCol = low ? "#aa3333" : "#3b82f6";
      const winCol = low ? "#ff4400" : "#fbbf24";

      // Fortress body
      for (let y = mid - 14; y < mid + 14; y++) {
        for (let x = 0; x < 12; x++) {
          const isEdge = x === 0 || x === 11;
          const isTopBot = y === mid - 14 || y === mid + 13;
          if (isTopBot) { ctx.fillStyle = edgeCol; ctx.fillRect(bx + x, y, 1, 1); }
          else if (isEdge) { ctx.fillStyle = edgeCol; ctx.fillRect(bx + x, y, 1, 1); }
          else if ((x + y) % 5 === 0) { ctx.fillStyle = trimCol; ctx.fillRect(bx + x, y, 1, 1); }
          else if ((x + y) % 7 === 0) { ctx.fillStyle = edgeCol; ctx.fillRect(bx + x, y, 1, 1); }
          else { ctx.fillStyle = wallCol; ctx.fillRect(bx + x, y, 1, 1); }
        }
      }

      // Battlements (top, crenellation)
      for (let x = 1; x < 11; x += 3) {
        for (let dy = -3; dy <= 0; dy++) {
          ctx.fillStyle = edgeCol; ctx.fillRect(bx + x, mid - 14 + dy, 1, 1);
        }
      }

      // Gate (dark entrance)
      ctx.fillStyle = "#000";
      ctx.fillRect(bx + 4, mid - 2, 1, 1); ctx.fillRect(bx + 5, mid - 2, 1, 1);
      ctx.fillRect(bx + 6, mid - 2, 1, 1); ctx.fillRect(bx + 7, mid - 2, 1, 1);
      ctx.fillRect(bx + 4, mid - 1, 1, 1); ctx.fillRect(bx + 7, mid - 1, 1, 1);
      ctx.fillRect(bx + 4, mid, 1, 1); ctx.fillRect(bx + 7, mid, 1, 1);
      // Gate arch
      for (let x = 3; x <= 8; x++) { ctx.fillStyle = edgeCol; ctx.fillRect(bx + x, mid - 3, 1, 1); }
      ctx.fillStyle = "#000";
      ctx.fillRect(bx + 3, mid - 2, 1, 1); ctx.fillRect(bx + 8, mid - 2, 1, 1);
      ctx.fillRect(bx + 3, mid - 1, 1, 1); ctx.fillRect(bx + 8, mid - 1, 1, 1);
      ctx.fillRect(bx + 3, mid, 1, 1); ctx.fillRect(bx + 8, mid, 1, 1);
      ctx.fillRect(bx + 3, mid + 1, 1, 1); ctx.fillRect(bx + 8, mid + 1, 1, 1);

      // Glowing windows
      const glow = Math.sin(Date.now() * 0.004) * 0.3 + 0.7;
      ctx.globalAlpha = glow;
      for (let y = mid - 10; y < mid + 12; y += 8) {
        ctx.fillStyle = winCol;
        ctx.fillRect(bx + 2, y, 1, 1); ctx.fillRect(bx + 2, y + 1, 1, 1);
        ctx.fillRect(bx + 9, y, 1, 1); ctx.fillRect(bx + 9, y + 1, 1, 1);
      }
      ctx.globalAlpha = 1;

      // Flag (top center, animated)
      const flagW = Math.sin(Date.now() * 0.006) > 0 ? 1 : 0;
      ctx.fillStyle = "#92400e";
      ctx.fillRect(bx + 6, mid - 22, 1, 1); ctx.fillRect(bx + 6, mid - 21, 1, 1);
      ctx.fillRect(bx + 6, mid - 20, 1, 1); ctx.fillRect(bx + 6, mid - 19, 1, 1);
      ctx.fillRect(bx + 6, mid - 18, 1, 1); ctx.fillRect(bx + 6, mid - 17, 1, 1);
      ctx.fillRect(bx + 6, mid - 16, 1, 1); ctx.fillRect(bx + 6, mid - 15, 1, 1);
      // Flag cloth
      ctx.fillStyle = low ? "#dc2626" : trimCol;
      ctx.fillRect(bx + 7, mid - 21, 1, 1); ctx.fillRect(bx + 8, mid - 21, 1, 1);
      ctx.fillRect(bx + 7, mid - 20, 1, 1); ctx.fillRect(bx + 8 + flagW, mid - 20, 1, 1);
      ctx.fillRect(bx + 7, mid - 19, 1, 1); ctx.fillRect(bx + 8 + flagW, mid - 19, 1, 1);
      ctx.fillRect(bx + 7, mid - 18, 1, 1);

      // HP bar at bottom of fortress
      ctx.fillStyle = "#1f2937"; ctx.fillRect(bx - 1, mid + 16, 14, 1);
      ctx.fillStyle = ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#eab308" : "#ef4444";
      ctx.fillRect(bx - 1, mid + 16, Math.max(1, Math.floor(14 * ratio)), 1);

      // ── Turrets (one per lane) ──
      for (const t of state.turrets || []) {
        const ty = Math.floor(t.y / PIXEL_SCALE);
        const tx = Math.floor(t.x / PIXEL_SCALE);
        const tHp = Math.max(0, t.hp / t.maxHp);

        if (!t.alive) {
          ctx.fillStyle = "#3a1a10";
          for (let rx = -1; rx <= 1; rx++) for (let ry = -1; ry <= 1; ry++) {
            if (Math.random() > 0.3) ctx.fillRect(tx + rx, ty + ry, 1, 1);
          }
          continue;
        }

        // Tower body
        ctx.fillStyle = "#777"; ctx.fillRect(tx - 1, ty - 3, 1, 1); ctx.fillRect(tx, ty - 3, 1, 1); ctx.fillRect(tx + 1, ty - 3, 1, 1);
        ctx.fillStyle = "#666"; ctx.fillRect(tx - 1, ty - 2, 1, 1); ctx.fillStyle = "#888"; ctx.fillRect(tx, ty - 2, 1, 1); ctx.fillStyle = "#666"; ctx.fillRect(tx + 1, ty - 2, 1, 1);
        ctx.fillStyle = "#555"; ctx.fillRect(tx - 2, ty - 1, 1, 1); ctx.fillStyle = "#777"; ctx.fillRect(tx - 1, ty - 1, 1, 1); ctx.fillStyle = "#aaa"; ctx.fillRect(tx, ty - 1, 1, 1); ctx.fillStyle = "#777"; ctx.fillRect(tx + 1, ty - 1, 1, 1); ctx.fillStyle = "#555"; ctx.fillRect(tx + 2, ty - 1, 1, 1);
        ctx.fillStyle = "#666"; ctx.fillRect(tx - 1, ty, 1, 1); ctx.fillStyle = "#888"; ctx.fillRect(tx, ty, 1, 1); ctx.fillStyle = "#666"; ctx.fillRect(tx + 1, ty, 1, 1);
        ctx.fillStyle = "#444"; ctx.fillRect(tx - 2, ty + 1, 1, 1); ctx.fillRect(tx - 1, ty + 1, 1, 1); ctx.fillRect(tx, ty + 1, 1, 1); ctx.fillRect(tx + 1, ty + 1, 1, 1); ctx.fillRect(tx + 2, ty + 1, 1, 1);
        // Cannon pointing left (toward enemies)
        ctx.fillStyle = "#888"; ctx.fillRect(tx - 3, ty - 1, 1, 1); ctx.fillRect(tx - 3, ty, 1, 1);
        ctx.fillStyle = "#666"; ctx.fillRect(tx - 3, ty + 1, 1, 1);
        // HP indicator on turret top
        ctx.fillStyle = tHp > 0.5 ? "#22c55e" : tHp > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(tx, ty - 4, 1, 1);

        // HP bar below turret
        ctx.fillStyle = "#1f2937"; ctx.fillRect(tx - 3, ty + 3, 7, 1);
        ctx.fillStyle = tHp > 0.5 ? "#22c55e" : tHp > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(tx - 3, ty + 3, Math.max(1, Math.floor(7 * tHp)), 1);
      }

      // ── Enemy Sprites ──
      for (const e of state.enemies || []) {
        if (e.hp <= 0) continue;
        const ex = Math.floor(e.x / PIXEL_SCALE);
        const ey = Math.floor(e.y / PIXEL_SCALE);
        const flash = e.hitFlash > 0.3;

        if (e.variant === "boss") {
          const B = flash ? "#fff" : "#cc0000";
          const D = flash ? "#fff" : "#660000";
          const L = flash ? "#fff" : "#ff4444";
          const H = flash ? "#fff" : "#fbbf24";
          const M = flash ? "#fff" : "#94a3b8";
          // Ambient aura
          const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;
          ctx.globalAlpha = pulse * 0.2;
          ctx.fillStyle = "#cc0000";
          for (let ax = -6; ax <= 6; ax++) for (let ay = -3; ay <= 3; ay++) {
            if (Math.abs(Math.abs(ax) + Math.abs(ay)) <= 7 && Math.random() > 0.5) ctx.fillRect(ex + ax, ey + ay, 1, 1);
          }
          ctx.globalAlpha = 1;
          // Crown
          for (let ci = -4; ci <= 4; ci += 2) { ctx.fillStyle = H; ctx.fillRect(ex + ci, ey - 8, 1, 1); ctx.fillRect(ex + ci, ey - 7, 1, 1); }
          // Head
          ctx.fillStyle = D; ctx.fillRect(ex - 2, ey - 6, 1, 1); ctx.fillStyle = B; ctx.fillRect(ex - 1, ey - 6, 2, 1); ctx.fillStyle = D; ctx.fillRect(ex + 1, ey - 6, 1, 1); ctx.fillRect(ex + 2, ey - 6, 1, 1);
          ctx.fillStyle = D; ctx.fillRect(ex - 1, ey - 5, 1, 1); ctx.fillStyle = B; ctx.fillRect(ex, ey - 5, 1, 1); ctx.fillStyle = D; ctx.fillRect(ex + 1, ey - 5, 1, 1);
          // Eyes
          ctx.fillStyle = "#ffff00"; ctx.fillRect(ex - 1, ey - 4, 1, 1); ctx.fillRect(ex + 1, ey - 4, 1, 1);
          // Body
          ctx.fillStyle = D; ctx.fillRect(ex - 3, ey - 3, 2, 1); ctx.fillStyle = B; ctx.fillRect(ex - 1, ey - 3, 3, 1); ctx.fillStyle = D; ctx.fillRect(ex + 2, ey - 3, 2, 1);
          ctx.fillStyle = B; ctx.fillRect(ex - 2, ey - 2, 1, 1); ctx.fillRect(ex - 1, ey - 2, 3, 1); ctx.fillRect(ex + 2, ey - 2, 1, 1);
          ctx.fillStyle = M; ctx.fillRect(ex - 1, ey, 1, 1); ctx.fillRect(ex, ey, 1, 1); ctx.fillRect(ex + 1, ey, 1, 1);
          // Belt
          ctx.fillStyle = H; for (let bi = -3; bi <= 3; bi++) ctx.fillRect(ex + bi, ey + 1, 1, 1);
          // Legs
          ctx.fillStyle = D; for (let li = -3; li <= 3; li++) ctx.fillRect(ex + li, ey + 2, 1, 1);
          ctx.fillRect(ex - 3, ey + 3, 2, 1); ctx.fillRect(ex + 2, ey + 3, 2, 1);
        } else if (e.variant === "tank") {
          const B = flash ? "#fff" : "#555555";
          const L = flash ? "#fff" : "#888888";
          const D = flash ? "#fff" : "#333333";
          const M = flash ? "#fff" : "#666666";
          const A = flash ? "#fff" : "#ff4444";
          // Helmet
          ctx.fillStyle = L; ctx.fillRect(ex, ey - 3, 1, 1);
          ctx.fillStyle = D; ctx.fillRect(ex - 1, ey - 2, 1, 1); ctx.fillRect(ex + 1, ey - 2, 1, 1);
          ctx.fillStyle = B; ctx.fillRect(ex, ey - 2, 1, 1);
          ctx.fillStyle = A; ctx.fillRect(ex - 1, ey - 1, 1, 1); ctx.fillRect(ex + 1, ey - 1, 1, 1);
          // Body
          for (let xi = -3; xi <= 3; xi++) { ctx.fillStyle = xi === 0 ? L : (Math.abs(xi) === 3 ? D : B); ctx.fillRect(ex + xi, ey, 1, 1); }
          for (let xi = -2; xi <= 2; xi++) { ctx.fillStyle = xi === 0 ? M : B; ctx.fillRect(ex + xi, ey + 1, 1, 1); }
          // Legs
          ctx.fillStyle = D; for (let xi = -2; xi <= 2; xi++) ctx.fillRect(ex + xi, ey + 2, 1, 1);
          ctx.fillRect(ex - 2, ey + 3, 1, 1); ctx.fillRect(ex - 1, ey + 3, 1, 1); ctx.fillRect(ex + 1, ey + 3, 1, 1); ctx.fillRect(ex + 2, ey + 3, 1, 1);
        } else if (e.variant === "caster") {
          const B = flash ? "#fff" : "#aa44cc";
          const L = flash ? "#fff" : "#cc66ff";
          const D = flash ? "#fff" : "#662288";
          // Hood
          ctx.fillStyle = D; ctx.fillRect(ex, ey - 4, 1, 1); ctx.fillRect(ex - 1, ey - 3, 1, 1); ctx.fillStyle = B; ctx.fillRect(ex, ey - 3, 1, 1); ctx.fillStyle = D; ctx.fillRect(ex + 1, ey - 3, 1, 1);
          ctx.fillStyle = L; ctx.fillRect(ex - 1, ey - 2, 1, 1); ctx.fillStyle = B; ctx.fillRect(ex, ey - 2, 1, 1); ctx.fillStyle = L; ctx.fillRect(ex + 1, ey - 2, 1, 1);
          // Body
          for (let xi = -1; xi <= 1; xi++) { ctx.fillStyle = B; ctx.fillRect(ex + xi, ey - 1, 1, 1); }
          for (let xi = -2; xi <= 2; xi++) { ctx.fillStyle = xi === 0 ? L : B; ctx.fillRect(ex + xi, ey, 1, 1); }
          // Spell orb (pulsing)
          const orbPulse = Math.sin(Date.now() * 0.008) * 0.4 + 0.6;
          ctx.globalAlpha = orbPulse; ctx.fillStyle = L; ctx.fillRect(ex - 3, ey, 1, 1); ctx.globalAlpha = orbPulse * 0.5; ctx.fillRect(ex - 4, ey, 1, 1); ctx.fillRect(ex - 3, ey - 1, 1, 1); ctx.globalAlpha = 1;
          // Staff
          for (let si = -4; si <= 2; si++) { ctx.fillStyle = "#92400e"; ctx.fillRect(ex + 3, ey + si, 1, 1); }
          ctx.fillStyle = L; ctx.fillRect(ex + 4, ey - 3, 1, 1); ctx.fillRect(ex + 4, ey - 4, 1, 1); ctx.fillRect(ex + 4, ey - 2, 1, 1);
          // Legs
          ctx.fillStyle = D; ctx.fillRect(ex - 1, ey + 1, 1, 1); ctx.fillRect(ex + 1, ey + 1, 1, 1);
          ctx.fillRect(ex - 1, ey + 2, 1, 1); ctx.fillRect(ex + 1, ey + 2, 1, 1);
        } else if (e.variant === "ranged") {
          const B = flash ? "#fff" : "#cc8844";
          const L = flash ? "#fff" : "#ffaa66";
          const D = flash ? "#fff" : "#885522";
          // Head
          ctx.fillStyle = L; ctx.fillRect(ex, ey - 2, 1, 1); ctx.fillRect(ex - 1, ey - 1, 1, 1); ctx.fillStyle = B; ctx.fillRect(ex, ey - 1, 1, 1); ctx.fillStyle = L; ctx.fillRect(ex + 1, ey - 1, 1, 1);
          ctx.fillStyle = "#ffff00"; ctx.fillRect(ex - 1, ey, 1, 1); ctx.fillRect(ex + 1, ey, 1, 1);
          // Body
          ctx.fillStyle = B; ctx.fillRect(ex - 1, ey, 1, 1); ctx.fillStyle = L; ctx.fillRect(ex, ey, 1, 1); ctx.fillStyle = B; ctx.fillRect(ex + 1, ey, 1, 1);
          ctx.fillStyle = B; ctx.fillRect(ex, ey + 1, 1, 1);
          // Bow
          ctx.fillStyle = D; for (let bi = -3; bi <= 3; bi++) ctx.fillRect(ex + 3, ey + bi, 1, 1);
          ctx.fillRect(ex + 4, ey - 3, 1, 1); ctx.fillRect(ex + 4, ey + 3, 1, 1);
          // Arrow
          ctx.fillStyle = "#fed7aa"; ctx.fillRect(ex + 2, ey, 1, 1); ctx.fillStyle = L; ctx.fillRect(ex + 1, ey, 1, 1);
          // Quiver
          ctx.fillStyle = D; ctx.fillRect(ex - 2, ey, 1, 1); ctx.fillRect(ex - 2, ey + 1, 1, 1); ctx.fillRect(ex - 2, ey + 2, 1, 1);
          ctx.fillStyle = "#fed7aa"; ctx.fillRect(ex - 2, ey - 1, 1, 1); ctx.fillRect(ex - 2, ey + 3, 1, 1);
          // Legs
          ctx.fillStyle = D; ctx.fillRect(ex - 1, ey + 2, 1, 1); ctx.fillRect(ex + 1, ey + 2, 1, 1);
          ctx.fillRect(ex - 1, ey + 3, 1, 1); ctx.fillRect(ex + 1, ey + 3, 1, 1);
        } else { // melee
          const B = flash ? "#fff" : "#cc5544";
          const L = flash ? "#fff" : "#ff8877";
          const D = flash ? "#fff" : "#883322";
          const M = flash ? "#fff" : "#665544";
          // Head
          ctx.fillStyle = L; ctx.fillRect(ex, ey - 2, 1, 1);
          ctx.fillStyle = D; ctx.fillRect(ex - 1, ey - 1, 1, 1); ctx.fillStyle = B; ctx.fillRect(ex, ey - 1, 1, 1); ctx.fillStyle = D; ctx.fillRect(ex + 1, ey - 1, 1, 1);
          ctx.fillStyle = "#ffff00"; ctx.fillRect(ex - 1, ey, 1, 1); ctx.fillRect(ex + 1, ey, 1, 1);
          // Body
          for (let xi = -2; xi <= 2; xi++) { ctx.fillStyle = Math.abs(xi) === 2 ? D : B; ctx.fillRect(ex + xi, ey, 1, 1); }
          // Armor
          ctx.fillStyle = M; ctx.fillRect(ex - 1, ey + 1, 1, 1); ctx.fillStyle = B; ctx.fillRect(ex, ey + 1, 1, 1); ctx.fillStyle = M; ctx.fillRect(ex + 1, ey + 1, 1, 1);
          // Axe
          ctx.fillStyle = M; ctx.fillRect(ex + 3, ey - 1, 1, 1); ctx.fillRect(ex + 3, ey, 1, 1); ctx.fillRect(ex + 4, ey - 1, 1, 1); ctx.fillRect(ex + 4, ey, 1, 1);
          ctx.fillStyle = D; ctx.fillRect(ex + 3, ey + 1, 1, 1);
          // Legs
          ctx.fillStyle = D; ctx.fillRect(ex - 1, ey + 2, 1, 1); ctx.fillRect(ex + 1, ey + 2, 1, 1);
          ctx.fillRect(ex - 2, ey + 3, 1, 1); ctx.fillRect(ex - 1, ey + 3, 1, 1); ctx.fillRect(ex, ey + 3, 1, 1); ctx.fillRect(ex + 1, ey + 3, 1, 1); ctx.fillRect(ex + 2, ey + 3, 1, 1);
        }

        // HP bar
        if (e.maxHp > 10) {
          const eSize = e.variant === "boss" ? 5 : e.variant === "tank" ? 3 : 2;
          ctx.fillStyle = "#1f2937"; ctx.fillRect(ex - eSize, ey + eSize + 2, eSize * 2, 1);
          const eRatio = Math.max(0, e.hp / e.maxHp);
          ctx.fillStyle = eRatio > 0.5 ? "#22c55e" : eRatio > 0.25 ? "#eab308" : "#ef4444";
          ctx.fillRect(ex - eSize, ey + eSize + 2, Math.max(1, Math.floor(eSize * 2 * eRatio)), 1);
        }
      }

      // ── Hero Sprites ──
      const myHero = (state.heroes || []).find((h: any) => h.uid === uid);
      for (const h of state.heroes || []) {
        if (!h.alive) {
          const dx = Math.floor(h.x / PIXEL_SCALE);
          const dy = Math.floor(h.y / PIXEL_SCALE);
          // Death marker: skull-ish (fading red X)
          ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.005) * 0.1;
          ctx.fillStyle = "#ef4444";
          for (let sx = -2; sx <= 2; sx++) {
            for (let sy = -2; sy <= 2; sy++) {
              if (Math.abs(sx) + Math.abs(sy) <= 3) ctx.fillRect(dx + sx, dy + sy, 1, 1);
            }
          }
          ctx.globalAlpha = 1;
          // Death timer
          ctx.font = "4px monospace"; ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,100,100,0.6)";
          ctx.fillText(`${h.nick || "?"}`, dx, dy + 5);
          continue;
        }

        const hc = HERO_COLORS[h.heroClass] || HERO_COLORS.knight;
        const hx = Math.floor(h.x / PIXEL_SCALE);
        const hy = Math.floor(h.y / PIXEL_SCALE) + Math.floor(Math.sin(Date.now() * 0.005 + h.uid.charCodeAt(0)) * 0.5);
        const flash = h.hitFlash > 0.3;
        const B = flash ? "#fff" : hc.body;
        const L = flash ? "#fff" : hc.light;
        const D = flash ? "#fff" : hc.dark;
        const A = flash ? "#fff" : "#fbbf24";
        const S = flash ? "#fff" : "#94a3b8";
        const isMine = h.uid === uid;

        // Shadow
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = hc.light;
        for (let sx = -2; sx <= 2; sx++) ctx.fillRect(hx + sx, hy + 3, 1, 1);
        ctx.globalAlpha = 1;

        if (h.heroClass === "knight") {
          // Helmet + gold trim
          ctx.fillStyle = A; ctx.fillRect(hx, hy - 5, 1, 1);
          ctx.fillStyle = D; ctx.fillRect(hx - 1, hy - 4, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx, hy - 4, 1, 1); ctx.fillStyle = D; ctx.fillRect(hx + 1, hy - 4, 1, 1);
          ctx.fillStyle = L; ctx.fillRect(hx - 1, hy - 3, 1, 1); ctx.fillRect(hx + 1, hy - 3, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx, hy - 3, 1, 1);
          // Shoulders (wide)
          ctx.fillStyle = D; ctx.fillRect(hx - 2, hy - 2, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx - 1, hy - 2, 1, 1); ctx.fillStyle = L; ctx.fillRect(hx, hy - 2, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx + 1, hy - 2, 1, 1); ctx.fillStyle = D; ctx.fillRect(hx + 2, hy - 2, 1, 1);
          // Chest
          ctx.fillStyle = B; ctx.fillRect(hx - 1, hy - 1, 1, 1); ctx.fillStyle = D; ctx.fillRect(hx, hy - 1, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx + 1, hy - 1, 1, 1);
          ctx.fillStyle = B; ctx.fillRect(hx - 1, hy, 1, 1); ctx.fillRect(hx, hy, 1, 1); ctx.fillRect(hx + 1, hy, 1, 1);
          // Shield (left)
          ctx.fillStyle = S; ctx.fillRect(hx - 3, hy - 3, 1, 1); ctx.fillRect(hx - 3, hy - 2, 1, 1); ctx.fillRect(hx - 3, hy - 1, 1, 1);
          ctx.fillStyle = A; ctx.fillRect(hx - 3, hy, 1, 1);
          ctx.fillStyle = S; ctx.fillRect(hx - 3, hy + 1, 1, 1); ctx.fillRect(hx - 3, hy + 2, 1, 1);
          // Sword (right)
          ctx.fillStyle = S; ctx.fillRect(hx + 3, hy - 3, 1, 1); ctx.fillRect(hx + 3, hy - 2, 1, 1); ctx.fillRect(hx + 3, hy - 1, 1, 1); ctx.fillRect(hx + 3, hy, 1, 1);
          ctx.fillStyle = D; ctx.fillRect(hx + 3, hy + 1, 1, 1);
          ctx.fillStyle = S; ctx.fillRect(hx + 4, hy - 4, 1, 1); // blade tip
          // Belt
          ctx.fillStyle = S; ctx.fillRect(hx - 1, hy + 1, 1, 1); ctx.fillStyle = A; ctx.fillRect(hx, hy + 1, 1, 1); ctx.fillStyle = S; ctx.fillRect(hx + 1, hy + 1, 1, 1);
          // Legs
          ctx.fillStyle = D; ctx.fillRect(hx - 1, hy + 2, 1, 1); ctx.fillRect(hx + 1, hy + 2, 1, 1);
          for (let sx = -2; sx <= 2; sx++) ctx.fillRect(hx + sx, hy + 3, 1, 1);
        } else if (h.heroClass === "archer") {
          // Hood
          ctx.fillStyle = D; ctx.fillRect(hx, hy - 5, 1, 1);
          ctx.fillRect(hx - 1, hy - 4, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx, hy - 4, 1, 1); ctx.fillStyle = D; ctx.fillRect(hx + 1, hy - 4, 1, 1);
          ctx.fillStyle = "#fed7aa"; ctx.fillRect(hx - 1, hy - 3, 1, 1); ctx.fillStyle = L; ctx.fillRect(hx, hy - 3, 1, 1); ctx.fillStyle = "#fed7aa"; ctx.fillRect(hx + 1, hy - 3, 1, 1);
          // Body
          ctx.fillStyle = B; ctx.fillRect(hx - 1, hy - 2, 1, 1); ctx.fillStyle = L; ctx.fillRect(hx, hy - 2, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx + 1, hy - 2, 1, 1);
          ctx.fillStyle = B; ctx.fillRect(hx, hy - 1, 1, 1);
          // Belt
          ctx.fillStyle = "#92400e"; ctx.fillRect(hx - 1, hy, 1, 1); ctx.fillRect(hx, hy, 1, 1); ctx.fillRect(hx + 1, hy, 1, 1);
          // Legs
          ctx.fillStyle = D; ctx.fillRect(hx - 1, hy + 1, 1, 1); ctx.fillRect(hx + 1, hy + 1, 1, 1);
          ctx.fillRect(hx - 1, hy + 2, 1, 1); ctx.fillRect(hx + 1, hy + 2, 1, 1);
          // Bow (right, tall)
          ctx.fillStyle = "#92400e";
          for (let bi = -4; bi <= 3; bi++) ctx.fillRect(hx + 3, hy + bi, 1, 1);
          ctx.fillRect(hx + 4, hy - 4, 1, 1); ctx.fillRect(hx + 4, hy + 3, 1, 1);
          // Arrow nocked
          ctx.fillStyle = "#fed7aa"; ctx.fillRect(hx + 2, hy - 1, 1, 1); ctx.fillStyle = L; ctx.fillRect(hx + 1, hy - 1, 1, 1);
          // Quiver
          ctx.fillStyle = "#92400e";
          for (let qi = 0; qi < 3; qi++) ctx.fillRect(hx - 2, hy - 1 + qi, 1, 1);
          ctx.fillStyle = "#fed7aa"; ctx.fillRect(hx - 2, hy - 2, 1, 1); ctx.fillRect(hx - 2, hy + 3, 1, 1);
        } else if (h.heroClass === "mage") {
          // Pointed hat
          ctx.fillStyle = A; ctx.fillRect(hx, hy - 6, 1, 1);
          ctx.fillStyle = D; ctx.fillRect(hx, hy - 5, 1, 1);
          ctx.fillRect(hx - 1, hy - 4, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx, hy - 4, 1, 1); ctx.fillStyle = D; ctx.fillRect(hx + 1, hy - 4, 1, 1);
          ctx.fillStyle = L; ctx.fillRect(hx - 1, hy - 3, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx, hy - 3, 1, 1); ctx.fillStyle = L; ctx.fillRect(hx + 1, hy - 3, 1, 1);
          // Face
          ctx.fillStyle = B; ctx.fillRect(hx, hy - 2, 1, 1);
          // Robe body
          ctx.fillStyle = B; for (let xi = -1; xi <= 1; xi++) ctx.fillRect(hx + xi, hy - 1, 1, 1);
          // Robe hem (wide)
          for (let xi = -2; xi <= 2; xi++) { ctx.fillStyle = xi === 0 ? L : (xi === -2 || xi === 2 ? D : B); ctx.fillRect(hx + xi, hy, 1, 1); }
          // Legs
          ctx.fillStyle = D; ctx.fillRect(hx - 1, hy + 1, 1, 1); ctx.fillRect(hx + 1, hy + 1, 1, 1);
          ctx.fillRect(hx - 1, hy + 2, 1, 1); ctx.fillRect(hx + 1, hy + 2, 1, 1);
          // Staff
          ctx.fillStyle = "#92400e"; for (let si = -5; si <= 2; si++) ctx.fillRect(hx + 3, hy + si, 1, 1);
          // Staff orb (glowing)
          const orbPulse2 = Math.sin(Date.now() * 0.006) * 0.3 + 0.7;
          ctx.globalAlpha = orbPulse2; ctx.fillStyle = A; ctx.fillRect(hx + 4, hy - 5, 1, 1); ctx.fillRect(hx + 4, hy - 4, 1, 1);
          ctx.globalAlpha = orbPulse2 * 0.5; ctx.fillRect(hx + 3, hy - 6, 1, 1); ctx.globalAlpha = 1;
          // Magic orb (left, floating)
          ctx.globalAlpha = orbPulse2; ctx.fillStyle = L; ctx.fillRect(hx - 3, hy, 1, 1); ctx.fillRect(hx - 4, hy, 1, 1);
          ctx.fillRect(hx - 3, hy - 1, 1, 1); ctx.globalAlpha = 1;
        } else if (h.heroClass === "rogue") {
          // Hood
          ctx.fillStyle = D; ctx.fillRect(hx, hy - 5, 1, 1);
          ctx.fillRect(hx - 1, hy - 4, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx, hy - 4, 1, 1); ctx.fillStyle = D; ctx.fillRect(hx + 1, hy - 4, 1, 1);
          // Eyes
          ctx.fillStyle = L; ctx.fillRect(hx - 1, hy - 3, 1, 1); ctx.fillRect(hx + 1, hy - 3, 1, 1);
          // Body
          ctx.fillStyle = B; ctx.fillRect(hx, hy - 2, 1, 1);
          ctx.fillRect(hx - 1, hy - 1, 1, 1); ctx.fillStyle = D; ctx.fillRect(hx, hy - 1, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx + 1, hy - 1, 1, 1);
          ctx.fillStyle = S; ctx.fillRect(hx, hy, 1, 1); // buckle
          // Cloak
          ctx.fillStyle = D; ctx.fillRect(hx - 2, hy + 1, 1, 1); ctx.fillStyle = B; ctx.fillRect(hx - 1, hy + 1, 2, 1); ctx.fillStyle = D; ctx.fillRect(hx + 2, hy + 1, 1, 1);
          // Legs
          ctx.fillStyle = D; ctx.fillRect(hx - 1, hy + 2, 1, 1); ctx.fillRect(hx + 1, hy + 2, 1, 1);
          // Left dagger
          ctx.fillStyle = S; ctx.fillRect(hx - 3, hy - 1, 1, 1); ctx.fillRect(hx - 3, hy, 1, 1); ctx.fillRect(hx - 3, hy + 1, 1, 1);
          // Right daggers
          ctx.fillRect(hx + 3, hy - 2, 1, 1); ctx.fillRect(hx + 3, hy - 1, 1, 1); ctx.fillRect(hx + 3, hy, 1, 1); ctx.fillRect(hx + 3, hy + 1, 1, 1);
          ctx.fillRect(hx + 4, hy - 3, 1, 1); // blade tip
        }

        // Level indicator
        if (h.level >= 2) {
          ctx.globalAlpha = 0.5; ctx.fillStyle = A; ctx.fillRect(hx, hy - 7, 1, 1);
          ctx.fillRect(hx - 3, hy - 7, 1, 1); ctx.fillRect(hx + 3, hy - 7, 1, 1);
          ctx.globalAlpha = 1;
        }

        // HP bar (all heroes)
        const hpBarWidth = 8;
        ctx.fillStyle = "#1f2937"; ctx.fillRect(hx - 4, hy + 4, hpBarWidth, 1);
        const hpR = Math.max(0, h.hp / h.maxHp);
        ctx.fillStyle = hpR > 0.5 ? "#22c55e" : hpR > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(hx - 4, hy + 4, Math.max(1, Math.floor(hpBarWidth * hpR)), 1);
      }

      // ── HUD ──
      ctx.fillStyle = "rgba(10,5,2,0.85)";
      ctx.fillRect(0, 0, PW, 7);
      ctx.font = "bold 5px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`W${state.wave || 0}`, 2, 6);
      ctx.textAlign = "center";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(state.phase === "playing" ? "⚔️ BATTLE" : state.phase === "between_waves" ? "⏳ Ready" : state.phase === "lobby" ? "👥 Lobby" : "💀 Game Over", PW / 2, 6);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`HP: ${state.baseHP}`, PW - 2, 6);

      // My hero info overlay
      if (myHero) {
        ctx.fillStyle = "rgba(10,5,2,0.85)";
        ctx.fillRect(0, PH - 7, PW, 7);
        ctx.font = "4px monospace";
        ctx.textAlign = "left";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`Lv${myHero.level} ${myHero.nick} | ${myHero.gold}g`, 2, PH - 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(`${myHero.heroClass} | ⚔${myHero.damage} 💀${myHero.killCount}`, PW / 2, PH - 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#22c55e";
        ctx.fillText(`XP: ${myHero.xp}/${myHero.xpNext}`, PW - 2, PH - 2);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [uid]);

  // ── Game Over / HUD UI ──
  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex flex-col items-center justify-center py-4 gap-3">
        <div className="text-center">
          <div className="text-5xl mb-2">💀</div>
          <h2 className="text-3xl font-bold text-red-400 mb-1">BASE OVERRUN</h2>
          <p className="text-stone-500 mb-3 text-sm">Wave {gameState?.wave || 0} | Score: {gameState?.score || 0}</p>

          {/* Player stats */}
          {(gameState?.heroes || []).filter((h: any) => h.uid === uid).map((h: any) => (
            <div key={h.uid} className="bg-stone-900/60 rounded-lg p-3 w-fit mx-auto text-xs text-stone-400">
              <span className="text-amber-200 font-bold">{h.nick}</span> — {h.heroClass} Lv{h.level} | 💀{h.killCount} deaths
            </div>
          ))}

          <button onClick={() => window.location.reload()}
            className="mt-4 px-8 py-3 bg-gradient-to-r from-amber-800 to-red-900 hover:from-amber-700 hover:to-red-800 text-amber-100 rounded-xl font-semibold transition border border-amber-700/30">
            ⚔️ Play Again
          </button>
        </div>
      </div>
    );
  }

  const myHero = (gameState?.heroes || []).find((h: any) => h.uid === uid);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex flex-col items-center justify-center py-2 gap-2">
      {/* Room + Connection */}
      <div className="flex items-center gap-4 text-xs text-stone-600 mb-1">
        <span>Room: <span className="text-amber-400 font-mono">{gameState?.phase === "lobby" ? "..." : gameState?.code || "—"}</span></span>
        <span>Players: {gameState?.clientCount || 0}/{gameState?.maxPlayers || 4}</span>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ width: GW, maxWidth: "100%" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", maxWidth: GW, imageRendering: "pixelated", borderRadius: "8px", display: "block" }}
          className="border-2 border-amber-900/40 shadow-2xl shadow-orange-950/30"
        />

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {gameState?.phase === "between_waves" && (
            <button onClick={() => sendAction({ type: "SKIP_WAIT" })}
              className="px-3 py-1 bg-green-700/80 hover:bg-green-600 text-green-100 rounded text-xs font-bold border border-green-500/50">
              ▶ Next Wave
            </button>
          )}
          {myHero && (
            <button onClick={() => setShowShop(!showShop)}
              className="px-3 py-1 bg-amber-700/80 hover:bg-amber-600 text-amber-100 rounded text-xs font-bold border border-amber-500/50">
              🛒 Shop ({myHero.gold}g)
            </button>
          )}
        </div>

        {/* Status */}
        {gameState?.phase === "lobby" && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 px-4 py-2 rounded-lg">
            <p className="text-amber-400 font-bold text-sm">Waiting for players...</p>
            <p className="text-stone-500 text-xs">Share room code to invite friends</p>
          </div>
        )}
      </div>

      {/* Hero Status */}
      {myHero && (
        <div className="flex gap-3 mt-1">
          <div className="bg-stone-900/60 rounded px-3 py-1 text-[10px] font-mono text-stone-400">
            <span className="text-amber-200 font-bold">{myHero.nick}</span> | {myHero.heroClass} Lv{myHero.level}
          </div>
          <div className="bg-stone-900/60 rounded px-3 py-1 text-[10px] font-mono text-stone-400">
            ⚔️{myHero.damage} ❤️{Math.round(myHero.hp)}/{myHero.maxHp} 💰{myHero.gold}g
          </div>
          <div className="bg-stone-900/60 rounded px-3 py-1 text-[10px] font-mono text-stone-400">
            💀{myHero.killCount} XP:{myHero.xp}/{myHero.xpNext}
          </div>
        </div>
      )}

      {/* Shop Modal */}
      {showShop && myHero && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowShop(false)}>
          <div className="bg-stone-900 border-2 border-amber-700 rounded-xl p-5 max-w-sm w-full shadow-2xl shadow-amber-900/40" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-amber-400">🛒 Shop</h3>
              <button onClick={() => setShowShop(false)} className="text-stone-500 hover:text-stone-300 text-lg">✕</button>
            </div>
            <p className="text-stone-500 text-xs mb-3">Your Gold: <span className="text-yellow-400">{myHero.gold}g</span></p>

            {/* Items */}
            {[
              { id: "health_potion", icon: "💚", label: "Health Potion", desc: "Full heal", cost: 25 },
              { id: "damage_boost", icon: "⚔️", label: "Damage Boost", desc: "+3 damage", cost: 50 },
              { id: "range_boost", icon: "🎯", label: "Range Boost", desc: "+20 range", cost: 30 },
            ].map(item => {
              const canAfford = myHero.gold >= item.cost;
              return (
                <button key={item.id}
                  onClick={() => {
                    if (canAfford) sendAction({ type: "BUY_ITEM", itemId: item.id });
                  }}
                  disabled={!canAfford}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border mb-2 transition ${
                    canAfford
                      ? "border-amber-700/40 bg-amber-900/20 hover:bg-amber-800/30"
                      : "border-stone-800 bg-stone-900/60 opacity-50 cursor-not-allowed"
                  }`}>
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1 text-left">
                    <span className="text-xs font-bold text-amber-200">{item.label}</span>
                    <p className="text-[10px] text-stone-500">{item.desc}</p>
                  </div>
                  <span className={`text-xs font-mono ${canAfford ? "text-yellow-400" : "text-stone-600"}`}>
                    {item.cost}g
                  </span>
                </button>
              );
            })}

            <button onClick={() => setShowShop(false)}
              className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded-lg font-bold text-sm transition mt-2">
              Close Shop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}