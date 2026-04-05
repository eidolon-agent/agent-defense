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

      // Lane separators
      const lanePositions = [150, 250, 350].map(y => Math.floor(y / PIXEL_SCALE));
      for (const ly of lanePositions) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(0, ly - 1, PW, 1);
        // Lane label on the left
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.font = "bold 4px monospace";
        ctx.textAlign = "left";
      }

      // Lanes
      const laneY: Record<string, number> = {};
      for (const [lane, col] of Object.entries(LANES_COLORS)) {
        const y = Math.floor(LANES_COLORS[lane as keyof typeof LANES_COLORS] ? lane === "top" ? 150 : lane === "mid" ? 250 : 350 : 250);
        const yPx = Math.floor(y / PIXEL_SCALE);
        // Lane path
        ctx.fillStyle = "rgba(80,60,30,0.15)";
        ctx.fillRect(0, yPx - 3, PW, 6);
        // Minion path glow
        for (let x = 0; x < PW; x += 4) {
          const flicker = 0.06 + 0.03 * Math.sin(Date.now() * 0.002 + x * 0.1);
          ctx.fillStyle = `rgba(160,100,40,${flicker})`;
          ctx.fillRect(x, yPx, 2, 1);
        }
        laneY[lane] = yPx;
      }

      // ── Base (right side) ──
      const ratio = state.baseHP / 100;
      const bx = PW - 8;
      ctx.fillStyle = ratio > 0.3 ? "#1e3a5f" : "#7f1d1d";
      ctx.fillRect(bx - 2, 0, 4, PH);
      ctx.fillStyle = ratio > 0.3 ? "#3b82f6" : "#dc2626";
      ctx.fillRect(bx - 3, 0, 1, PH);

      // ── Turrets ──
      for (const t of state.turrets || []) {
        if (!t.alive) continue;
        const ty = Math.floor(t.y / PIXEL_SCALE);
        const tx = Math.floor(t.x / PIXEL_SCALE);
        // Turret base
        ctx.fillStyle = "#3a2a20";
        ctx.fillRect(tx - 2, ty - 3, 5, 7);
        ctx.fillStyle = t.hp > t.maxHp * 0.5 ? "#fbbf24" : "#ef4444";
        ctx.fillRect(tx - 1, ty - 2, 3, 5);
        // Turret HP bar
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(tx - 2, ty + 4, 5, 1);
        const tRatio = Math.max(0, t.hp / t.maxHp);
        ctx.fillStyle = tRatio > 0.5 ? "#22c55e" : "#eab308";
        ctx.fillRect(tx - 2, ty + 4, Math.max(1, Math.floor(5 * tRatio)), 1);
      }

      // ── Enemies (from right, moving left) ──
      for (const e of state.enemies || []) {
        if (e.hp <= 0) continue;
        const ex = Math.floor(e.x / PIXEL_SCALE);
        const ey = Math.floor(e.y / PIXEL_SCALE);
        const ec = ENEMY_COLORS[e.variant] || ENEMY_COLORS.melee;
        const flash = e.hitFlash > 0.3;

        const size = e.variant === "boss" ? 4 : e.variant === "tank" ? 3 : 2;
        ctx.fillStyle = flash ? "#fff" : ec.body;
        ctx.fillRect(ex - size, ey - size, size * 2, size * 2);
        // Dark detail
        ctx.fillStyle = flash ? "#fff" : ec.light;
        ctx.fillRect(ex, ey - 1, 1, 1);
        // HP bar
        if (e.maxHp > 10) {
          ctx.fillStyle = "#1f2937";
          ctx.fillRect(ex - size, ey + size + 1, size * 2, 1);
          const eRatio = e.hp / e.maxHp;
          ctx.fillStyle = eRatio > 0.5 ? "#22c55e" : eRatio > 0.25 ? "#eab308" : "#ef4444";
          ctx.fillRect(ex - size, ey + size + 1, Math.max(1, Math.floor(size * 2 * eRatio)), 1);
        }
        // Boss crown
        if (e.variant === "boss") {
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(ex - 3, ey - 6, 1, 2);
          ctx.fillRect(ex, ey - 6, 1, 2);
          ctx.fillRect(ex + 3, ey - 6, 1, 2);
        }
      }

      // ── Heroes ──
      const myHero = (state.heroes || []).find((h: any) => h.uid === uid);
      for (const h of state.heroes || []) {
        if (!h.alive) {
          // Death marker
          const hx = Math.floor(h.x / PIXEL_SCALE);
          const hy = Math.floor(h.y / PIXEL_SCALE);
          ctx.fillStyle = "rgba(255,0,0,0.2)";
          ctx.font = "6px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${h.nick || "Hero"}`, hx, hy);
          continue;
        }

        const hc = HERO_COLORS[h.heroClass] || HERO_COLORS.knight;
        const size = h.heroClass === "knight" ? 3 : h.heroClass === "mage" ? 2 : h.heroClass === "archer" ? 2 : 2;
        const hx = Math.floor(h.x / PIXEL_SCALE);
        const hy = Math.floor(h.y / PIXEL_SCALE) + Math.floor(Math.sin(Date.now() * 0.005 + h.uid.charCodeAt(2)) * 0.5);

        // Shadow
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = hc.light;
        ctx.fillRect(hx - 3, hy - 3, 7, 1);
        ctx.globalAlpha = 1;

        // Body
        ctx.fillStyle = h.hitFlash > 0.3 ? "#fff" : hc.body;
        ctx.fillRect(hx - size, hy - size, size * 2, size * 2);
        // Face detail
        ctx.fillStyle = hc.light;
        ctx.fillRect(hx - 1, hy, 1, 1);
        ctx.fillRect(hx + 1, hy, 1, 1);

        // Level indicator
        if (h.level > 1) {
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(hx - 3, hy - size - 2, 6, 1);
        }

        // HP bar
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(hx - 4, hy + size + 1, 9, 1);
        const hpR = h.hp / h.maxHp;
        ctx.fillStyle = hpR > 0.5 ? "#22c55e" : hpR > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(hx - 4, hy + size + 1, Math.max(1, Math.floor(9 * hpR)), 1);

        // Nick
        if (myHero && h.uid === uid) {
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 4px monospace";
          ctx.textAlign = "center";
          ctx.fillText("YOU", hx, hy - size - 3);
        }
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
