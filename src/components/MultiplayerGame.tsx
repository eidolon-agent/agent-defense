"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ─── Constants ───
const GW = 800, GH = 500;
const PIXEL_SCALE = 4;
const PW = Math.floor(GW / PIXEL_SCALE);
const PH = Math.floor(GH / PIXEL_SCALE);
const BASE_X = GW - 40;

// ─── Hero colors ───
const HC: Record<string, { body: string; light: string }> = {
  knight:  { body: "#3b82f6", light: "#60a5fa" },
  archer:  { body: "#e11d48", light: "#fb7185" },
  mage:    { body: "#a855f7", light: "#c084fc" },
  rogue:   { body: "#64748b", light: "#94a3b8" },
};

export default function MultiplayerGame({ roomCode, isHost }: { roomCode: string; isHost: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("connecting");
  const [playerId, setPlayerId] = useState("");
  const [state, setState] = useState<{
    heroes: any[]; enemies: any[]; wave: number; gold: number;
    score: number; baseHP: number; maxBaseHP: number; started: boolean;
    gameOver: boolean; victory: boolean; betweenWaves: boolean;
    waveAnnounce: string; totalWaves: number; maxPlayers: number; clientCount: number;
    ts: number;
  } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Connect WebSocket ──
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const ws = new WebSocket(`${proto}//${host}:8765/?action=join&room=${roomCode}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("disconnected");

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "joined") {
          setPlayerId(msg.playerId);
        } else if (msg.type === "state") {
          const { type, ...rest } = msg;
          setState(prev => {
            if (!prev || msg.ts > prev.ts) return rest;
            return prev;
          });
        } else if (msg.type === "error") {
          setStatus("error");
        }
      } catch {}
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [roomCode]);

  // ── Send action helper ──
  const send = useCallback((msg: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // ── Canvas render loop ──
  useEffect(() => {
    if (!state) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PW;
    canvas.height = PH;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = false;

    let raf: number;
    const loop = () => {
      if (!state) return;

      // Background
      ctx.fillStyle = "#0f0a06";
      ctx.fillRect(0, 0, PW, PH);
      const lanePY = Math.floor(PH / 2);
      const f = (Date.now() * 0.06) | 0;
      // Floor
      ctx.fillStyle = "#1a1210";
      ctx.fillRect(0, lanePY - 3, PW, 7);
      for (let x = -(f & 7); x < PW; x += 6) {
        if (x < 0) continue;
        ctx.fillStyle = "rgba(180,80,30,0.12)";
        ctx.fillRect(x, lanePY, 2, 1);
      }

      // ── Base ──
      const ratio = state.baseHP / state.maxBaseHP;
      const bx = Math.round((BASE_X - 40) / PIXEL_SCALE), by = lanePY;
      const low = ratio < 0.3;
      ctx.fillStyle = low ? "#dc2626" : "#3b82f6";
      ctx.fillRect(bx, by - 4, 4, 1); ctx.fillRect(bx - 1, by - 3, 6, 1);
      ctx.fillStyle = low ? "#7f1d1d" : "#1e3a5f";
      ctx.fillRect(bx - 1, by - 2, 7, 6);
      ctx.fillStyle = low ? "#dc2626" : "#3b82f6";
      ctx.fillRect(bx - 2, by - 2, 1, 5); ctx.fillRect(bx + 6, by - 2, 1, 5);
      // HP bar
      ctx.fillStyle = "#1f2937"; ctx.fillRect(bx - 1, by + 4, 6, 1);
      ctx.fillStyle = ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#eab308" : "#ef4444";
      ctx.fillRect(bx - 1, by + 4, Math.max(1, Math.floor(6 * ratio)), 1);

      // ── Enemies ──
      for (const en of state.enemies) {
        if (en.hp <= 0) continue;
        const ex = Math.round(en.x / PIXEL_SCALE), ey = Math.round(en.y / PIXEL_SCALE);
        const flash = en.hitFlash > 0.3;
        if (en.type === "boss") {
          ctx.fillStyle = flash ? "#fff" : "#5a1a10"; ctx.fillRect(ex - 5, ey - 4, 11, 9);
          ctx.fillStyle = flash ? "#fff" : "#c43020"; ctx.fillRect(ex - 4, ey - 5, 9, 1);
          ctx.fillStyle = "#fecaca"; ctx.fillRect(ex - 3, ey - 2, 3, 2); ctx.fillRect(ex + 2, ey - 2, 3, 2);
          const aura = en.bossPhase === 0 ? "#fbbf24" : en.bossPhase === 1 ? "#ff4500" : "#ff0000";
          ctx.fillStyle = aura; ctx.fillRect(ex - 5, ey - 6, 1, 2); ctx.fillRect(ex, ey - 6, 1, 2); ctx.fillRect(ex + 5, ey - 6, 1, 2);
        } else if (en.type === "tank") {
          ctx.fillStyle = flash ? "#fff" : "#3a2a20"; ctx.fillRect(ex - 3, ey - 2, 7, 5);
          ctx.fillStyle = flash ? "#fff" : "#7a4a30"; ctx.fillRect(ex - 2, ey - 3, 5, 1);
        } else if (en.type === "stealth" && (en.revealed || Math.random() > 0.06)) {
          ctx.fillStyle = en.revealed ? "#4a1a6a" : "rgba(168,85,247,0.1)";
          ctx.fillRect(ex - 2, ey - 2, 5, 5);
        } else if (en.type === "healer") {
          ctx.fillStyle = flash ? "#fff" : "#1a4a20"; ctx.fillRect(ex - 2, ey - 2, 5, 5);
          ctx.fillStyle = "#22c55e"; ctx.fillRect(ex, ey - 1, 1, 3); ctx.fillRect(ex - 1, ey, 3, 1);
        } else if (en.type === "swarm") {
          ctx.fillStyle = "#5a3a08"; ctx.fillRect(ex - 1, ey - 1, 3, 3);
        } else {
          ctx.fillStyle = flash ? "#fff" : "#7a4a10";
          ctx.fillRect(ex, ey - 2, 1, 1); ctx.fillRect(ex - 1, ey - 1, 3, 1);
          ctx.fillRect(ex - 2, ey, 5, 1); ctx.fillRect(ex - 1, ey + 1, 3, 1);
          ctx.fillRect(ex, ey + 2, 1, 1);
        }
        // HP bar
        if (en.maxHp > 2) {
          const hpR = en.hp / en.maxHp;
          const bw = en.type === "boss" ? 10 : 6;
          ctx.fillStyle = "#1f2937"; ctx.fillRect(ex - bw / 2, ey - (en.type === "boss" ? 7 : 5), bw, 1);
          ctx.fillStyle = hpR > 0.5 ? "#22c55e" : hpR > 0.25 ? "#eab308" : "#ef4444";
          ctx.fillRect(ex - bw / 2, ey - (en.type === "boss" ? 7 : 5), Math.max(1, Math.floor(bw * hpR)), 1);
        }
      }

      // ── Heroes ──
      for (const h of state.heroes) {
        const cl = HC[h.heroClass] || HC.knight;
        const sz = h.heroClass === "mage" ? 3 : h.heroClass === "knight" ? 5 : 4;
        const hx = Math.round(h.x / PIXEL_SCALE);
        const hy = Math.round(h.y / PIXEL_SCALE) + Math.round(Math.sin(h.bobPhase) * 1);
        const flash = h.hitFlash > 0.3;
        ctx.fillStyle = flash ? "#fff" : cl.body;
        ctx.fillRect(hx - sz, hy - sz, sz * 2, sz * 2);
        ctx.fillStyle = flash ? "#fff" : cl.light;
        ctx.fillRect(hx - 1, hy, 1, 1); ctx.fillRect(hx + 1, hy, 1, 1);
        // Level
        if (h.level > 1) {
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(hx - sz, hy - sz - 2, sz * 2, 1);
        }
        // HP
        const hpR = h.hp / h.maxHp;
        ctx.fillStyle = "#1f2937"; ctx.fillRect(hx - sz, hy + sz + 1, sz * 2, 1);
        ctx.fillStyle = hpR > 0.5 ? "#22c55e" : hpR > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(hx - sz, hy + sz + 1, Math.max(1, Math.floor(sz * 2 * hpR)), 1);
      }

      // ── Wave text ──
      if (state.wave > 0 || state.waveAnnounce !== "Waiting...") {
        ctx.fillStyle = state.wave === state.totalWaves ? "#ef4444" : "#e2e8f0";
        ctx.font = `bold ${Math.max(4, Math.round(24 / PIXEL_SCALE))}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(state.waveAnnounce || `Wave ${state.wave}/${state.totalWaves}`, PW / 2, PH / 3);
      }

      // ── HUD ──
      ctx.font = `bold ${Math.max(4, Math.round(10 / PIXEL_SCALE * 1.5))}px monospace`;
      ctx.fillStyle = "rgba(10,5,2,0.8)"; ctx.fillRect(0, 0, PW, 7);
      ctx.fillStyle = "#fbbf24"; ctx.textAlign = "left";
      ctx.fillText(`W${state.wave}/${state.totalWaves} | ${state.gold}g`, 1, 6);
      ctx.fillStyle = "#ef4444"; ctx.textAlign = "right";
      ctx.fillText(`Base: ${state.baseHP}/${state.maxBaseHP}`, PW - 1, 6);
      ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center";
      ctx.fillText(`Players: ${state.clientCount}`, PW / 2, 6);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // ── Status Screen ──
  if (status === "connecting") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⚔️</div>
          <h2 className="text-2xl font-bold text-orange-500 mb-2">Connecting to room...</h2>
          <p className="text-stone-500 text-sm">Room: {roomCode}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {[0, 150, 300].map((d, i) => (
              <div key={i} className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: d + "ms" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === "error" || status === "disconnected") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-2xl font-bold text-red-400 mb-2">Connection Failed</h2>
          <p className="text-stone-500 text-sm">Room: {roomCode}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded-lg font-semibold">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const myHero = state.heroes.find((h: any) => h.playerId === playerId);
  const gameOverScreen = state.gameOver || state.victory;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex flex-col items-center justify-center py-2 gap-2">
      {/* Room Header */}
      <div className="flex items-center gap-4 mb-1">
        <span className="text-amber-400 font-mono text-sm">Room: <span className="text-amber-300 font-bold">{roomCode}</span></span>
        <span className="text-stone-500 text-xs">Players: {state.clientCount}/{state.maxPlayers}</span>
        <button onClick={() => { navigator.clipboard?.writeText(roomCode); }} className="text-stone-600 hover:text-amber-400 text-xs">
          📋 Copy
        </button>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ width: GW, maxWidth: "100%" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", maxWidth: GW, imageRendering: "pixelated", borderRadius: "8px", display: "block" }}
          className="border-2 border-amber-900/40 shadow-2xl shadow-orange-950/30"
        />

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {!myHero && state.started && !gameOverScreen && (
            <div className="flex flex-col gap-1">
              {Object.keys(HC).map(cls => (
                <button key={cls} onClick={() => send({ type: "spawn", class: cls })}
                  className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-xs font-mono border border-stone-600">
                  🎮 Play {cls.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {state.betweenWaves && (
            <button onClick={() => send({ type: "next_wave" })}
              className="px-3 py-1 bg-green-700/80 hover:bg-green-600 text-green-100 rounded text-xs font-bold border border-green-500/50">
              ▶ Next Wave
            </button>
          )}
          {state.started && !gameOverScreen && (
            <>
              <button onClick={() => send({ type: "upgrade", stat: "damage" })}
                className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-xs font-mono border border-stone-600">
                ⚔️ Dmg up ({myHero ? Math.ceil(20 + myHero.level * 10) : "-"}g)
              </button>
              <button onClick={() => send({ type: "shop" })}
                className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-xs font-mono border border-stone-600">
                💚 Heal all (25g)
              </button>
            </>
          )}
          {!state.started && (
            <button onClick={() => send({ type: "start" })}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded text-sm font-bold border border-amber-500/50">
              ▶ Start Game
            </button>
          )}
        </div>
      </div>

      {/* Game Over */}
      {gameOverScreen && (
        <div className="mt-4 text-center">
          <h2 className={`text-3xl font-bold mb-1 ${state.victory ? "text-green-400" : "text-red-400"}`}>
            {state.victory ? "VICTORY!" : "BASE OVERRUN"}
          </h2>
          <p className="text-stone-500 mb-2 text-sm">Wave {state.wave} | Score: {state.score}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded-lg font-semibold">
            Play Again
          </button>
        </div>
      )}

      {/* Hero Stats */}
      {myHero && (
        <div className="mt-2 bg-stone-900/80 border border-stone-700 rounded-lg p-2 w-fit max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded" style={{ backgroundColor: HC[myHero.heroClass]?.body }} />
            <span className="text-xs font-bold text-amber-200">{myHero.heroClass} Lv{myHero.level}</span>
            <span className="text-[10px] text-stone-500">{myHero.damage}⚔ {Math.round(myHero.hp)}/{myHero.hp}❤ Gold: {state.gold}g</span>
          </div>
        </div>
      )}
    </div>
  );
}
