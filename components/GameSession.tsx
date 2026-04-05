"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { Engine, GW, GH, getAgentAbilities } from "@/core/game/GameEngine";
import type { Command, PlayerAgent, MatchResult, HeroClass } from "@/core/game/types";
import { useGameStore } from "@/store/gameStore";
import Controls from "./Controls";

const PIXEL_SCALE = 4;
const PW = (GW / PIXEL_SCALE) | 0;
const PH = (GH / PIXEL_SCALE) | 0;

const HERO_COLORS: Record<HeroClass, { body: string; dark: string; light: string }> = {
  knight:  { body: "#3b82f6", dark: "#1e40af", light: "#60a5fa" },
  archer:  { body: "#e11d48", dark: "#9f1239", light: "#fb7185" },
  mage:    { body: "#a855f7", dark: "#7c3aed", light: "#c084fc" },
  rogue:   { body: "#64748b", dark: "#334155", light: "#94a3b8" },
};

interface Props { players: PlayerAgent[]; onFinished?: (r: MatchResult) => void; }

export default function GameSession({ players, onFinished }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engRef = useRef<Engine | null>(null);
  const lastRef = useRef(0);
  const [over, setOver] = useState(false);
  const [gold, setGold] = useState(50);
  const [combo, setCombo] = useState(0);
  const [agents, setAgents] = useState<any[]>([]);
  const [levelUpMode, setLevelUpMode] = useState(false);
  const [currentLevelUp, setCurrentLevelUp] = useState<any>(null);
  const [postMatchStats, setPostMatchStats] = useState<{ agents: any[]; totalTime: number } | null>(null);
  const startTime = useRef(Date.now());
  const [shopOpen, setShopOpen] = useState(false);
  const { command, setCommand, phase, setPhase, score, setScore, wave, setWave, baseHP, setBaseHP, maxBaseHP, setMaxBaseHP, setResult } = useGameStore();

  useEffect(() => {
    startTime.current = Date.now();
    const eng = new Engine();
    eng.init(players);
    engRef.current = eng;
    lastRef.current = performance.now();
    setGold(eng.gold);

    let raf: number;
    const loop = (now: number) => {
      const dt = Math.min(now - lastRef.current, 50);
      lastRef.current = now;
      const e = engRef.current;
      if (!e) return;
      e.update(dt, now);
      setScore(e.score); setWave(e.wave);
      setBaseHP(Math.max(0, e.baseHP)); setMaxBaseHP(e.maxBaseHP);
      setGold(e.gold); setCombo(e.combo);
      setAgents(e.agents.map(a => ({
        id: a.id, heroClass: a.heroClass, x: a.x, y: a.y,
        abilityCooldowns: { ...a.abilityCooldowns },
        damageDealt: a.damageDealt, enemiesKilled: a.enemiesKilled,
        abilitiesUsed: a.abilitiesUsed, critsCount: a.critsCount,
        hp: a.hp, maxHp: a.maxHp, damage: a.damage,
        upgrades: a.upgrades,
      })));

      // Handle shop and level-up modes
      if (e.shopOpen && !shopOpen) {
        setShopOpen(true);
        setCurrentLevelUp(null); setLevelUpMode(false);
      } else if (!e.shopOpen && shopOpen) {
        setShopOpen(false);
      }
      
      if (e.levelUpsPending.length > 0 && !levelUpMode && e.phase === "playing" && !e.shopOpen) {
        const pending = e.levelUpsPending.shift()!;
        setCurrentLevelUp(pending);
        setLevelUpMode(true);
      }

      if (e.phase !== "playing") {
        setPhase(e.phase); setOver(true);
        const r: MatchResult = {
          score: e.score, wave: e.wave,
          baseHP: Math.max(0, e.baseHP), maxBaseHP: e.maxBaseHP,
          enemiesKilled: e.enemiesKilled, xpEarned: e.score * 5,
          goldEarned: e.gold, playTime: (Date.now() - startTime.current) / 1000 | 0,
        };
        setResult(r);
        saveMatchStats(r);
        setPostMatchStats({
          agents: e.agents.map(a => ({
            heroClass: a.heroClass, hp: Math.round(a.hp), maxHp: a.maxHp,
            damageDealt: Math.round(a.damageDealt), enemiesKilled: a.enemiesKilled,
            abilitiesUsed: a.abilitiesUsed, critsCount: a.critsCount,
            level: a.level, upgrades: a.upgrades,
          })),
          totalTime: r.playTime,
        });
        onFinished?.(r);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleUpgrade = (agentId: number, upgradeName: string) => {
    engRef.current?.applyUpgrade(agentId, upgradeName);
    setCurrentLevelUp(null); setLevelUpMode(false);
  };

  const onAbility = useCallback((agentId: number, ability: string) => {
    engRef.current?.useAbility(agentId, ability);
  }, []);

  const onCmd = useCallback((c: Command) => { setCommand(c); if (engRef.current) engRef.current.command = c; }, [setCommand]);

  useEffect(() => {
    const c = canvasRef.current;
    const e = engRef.current;
    if (!c || !e) return;
    c.width = PW; c.height = PH;
    const ctx = c.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = false;
    let raf: number;
    const draw = () => { render(ctx, e); raf = requestAnimationFrame(draw); };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: GW, maxWidth: "100%" }}>
        <canvas ref={canvasRef}
          style={{ width: "100%", maxWidth: GW, imageRendering: "pixelated", borderRadius: "8px", display: "block" }}
          className="border-2 border-gray-700/60 shadow-2xl shadow-indigo-950/30"
        />

        <div className="absolute top-2 right-2 flex gap-3 pointer-events-none">
          <div className="bg-black/60 px-2 py-1 rounded text-xs font-mono text-yellow-400">🪙 {gold}</div>
          {combo >= 3 && <div className="bg-black/60 px-2 py-1 rounded text-xs font-mono text-orange-400 animate-pulse">🔥 {combo}x</div>}
        </div>

        <div className="absolute inset-0 pointer-events-none">
          {agents.map((a: any) => {
            const abs = getAgentAbilities(a.heroClass as HeroClass);
            return (
              <div key={a.id} className="pointer-events-auto absolute"
                style={{ left: `${a.x / GW * 100}%`, top: `${a.y / GH * 100}%`, transform: "translate(-50%, -100%)" }}>
                <div className="flex gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
                  {abs.map((ab: any) => {
                    const cd = a.abilityCooldowns?.[ab.name] ?? 0;
                    return (
                      <button key={ab.name} onClick={() => onAbility(a.id, ab.name)} disabled={cd > 0}
                        className="w-5 h-5 text-[8px] rounded bg-black/70 border border-gray-600 disabled:opacity-30 hover:bg-gray-600 transition"
                        title={`${ab.label}${cd > 0 ? ` (${Math.ceil(cd / 1000)}s)` : ""}`}>
                        {ab.icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {levelUpMode && currentLevelUp && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg backdrop-blur-sm z-10">
            <div className="bg-gray-900/95 border border-indigo-700 rounded-2xl p-5 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-indigo-300 mb-3 text-center">⬆️ Choose Upgrade</h3>
              <p className="text-xs text-gray-400 mb-3 text-center">Agent #{currentLevelUp.agentId}</p>
              <div className="space-y-2">
                {currentLevelUp.choices.map((ch: any) => (
                  <button key={ch.name} onClick={() => handleUpgrade(currentLevelUp.agentId, ch.name)}
                    className="w-full p-3 bg-gray-800/80 hover:bg-indigo-900/50 border border-gray-700 hover:border-indigo-500 rounded-xl text-left transition">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{ch.icon}</span>
                      <div>
                        <div className="font-semibold text-sm text-white">{ch.label}</div>
                        <div className="text-[10px] text-gray-400">{ch.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {over && phase !== "playing" && postMatchStats && (
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center rounded-lg backdrop-blur-sm z-20">
            <div className="bg-gray-900/95 border border-gray-700 rounded-2xl p-5 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="text-center mb-3">
                <div className="text-4xl mb-1">{phase === "victory" ? "🏆" : "💀"}</div>
                <h3 className={`text-xl font-bold ${phase === "victory" ? "text-green-400" : "text-red-400"}`}>{phase === "victory" ? "VICTORY!" : "DEFEATED"}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
                <div className="bg-gray-800/50 rounded-lg p-2"><div className="text-yellow-400 font-mono">{score}</div><div className="text-[10px] text-gray-500">Score</div></div>
                <div className="bg-gray-800/50 rounded-lg p-2"><div className="text-amber-400 font-mono">{gold}</div><div className="text-[10px] text-gray-500">Gold</div></div>
                <div className="bg-gray-800/50 rounded-lg p-2"><div className="text-orange-400 font-mono">{combo}x</div><div className="text-[10px] text-gray-500">Combo</div></div>
                <div className="bg-gray-800/50 rounded-lg p-2"><div className="text-indigo-400 font-mono">{wave}/8</div><div className="text-[10px] text-gray-500">Wave</div></div>
                <div className="bg-gray-800/50 rounded-lg p-2"><div className="text-white font-mono">{postMatchStats.totalTime}s</div><div className="text-[10px] text-gray-500">Time</div></div>
                <div className="bg-gray-800/50 rounded-lg p-2"><div className="text-green-400 font-mono">{baseHP}/{maxBaseHP}</div><div className="text-[10px] text-gray-500">Base HP</div></div>
              </div>
              <div className="space-y-2 mb-4">
                {postMatchStats.agents.map((a: any, i: number) => (
                  <div key={i} className="bg-gray-800/40 rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{a.heroClass === "knight" ? "🛡️" : a.heroClass === "archer" ? "🏹" : a.heroClass === "mage" ? "🔮" : "🗡️"}</span>
                      <span className="font-semibold capitalize text-white">{a.heroClass}</span>
                      <span className="text-gray-500">Lv.{a.level}</span>
                      <span className="text-gray-600">|</span>
                      <span className="text-gray-400">{a.upgrades?.length || 0} upgrades</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-gray-400 font-mono">
                      <span>❤️ {a.hp}/{a.maxHp}</span>
                      <span>⚔️ {a.damageDealt}</span>
                      <span>💀 {a.enemiesKilled}</span>
                      <span>💥 {a.critsCount} crits</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.reload()} className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-semibold transition">Play Again</button>
            </div>
          </div>
        )}

        {over && phase !== "playing" && !postMatchStats && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg backdrop-blur-sm">
            <div className="text-center">
              <div className="text-5xl mb-2">{phase === "victory" ? "🏆" : "💀"}</div>
              <h3 className={`text-2xl font-bold mb-1 ${phase === "victory" ? "text-green-400" : "text-red-400"}`}>{phase === "victory" ? "VICTORY!" : "DEFEATED"}</h3>
              <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold">Play Again</button>
            </div>
          </div>
        )}
      </div>
      <Controls command={command} onCommand={onCmd} wave={wave} score={score} baseHP={baseHP} maxBaseHP={maxBaseHP} playing={phase === "playing"} gold={gold} />
    </div>
  );
}

function saveMatchStats(r: MatchResult) {
  try {
    const key = "ad-stats";
    let stats: any = {};
    try { const s = localStorage.getItem(key); if (s) stats = JSON.parse(s); } catch {}
    stats.totalGames = (stats.totalGames || 0) + 1;
    if (r.wave >= 8 && r.baseHP > 0) stats.wins = (stats.wins || 0) + 1;
    stats.highestScore = Math.max(stats.highestScore || 0, r.score);
    stats.highestWave = Math.max(stats.highestWave || 0, r.wave);
    stats.totalKills = (stats.totalKills || 0) + r.enemiesKilled;
    localStorage.setItem(key, JSON.stringify(stats));
  } catch {}
}

// ══════════════════════════════════════════════════════════
// PIXEL ART RENDERER
// ══════════════════════════════════════════════════════════
const GW_PS = GW / PIXEL_SCALE;
const GH_PS = GH / PIXEL_SCALE;

// ── Persisted ground effects (craters, scorch marks, debris) ──
const groundEffects: Array<{ x: number; y: number; type: 'crater' | 'scorch' | 'debris'; size: number; age: number }> = [];

function addGroundEffect(x: number, y: number, type: 'crater' | 'scorch' | 'debris') {
  if (groundEffects.length > 40) groundEffects.splice(0, groundEffects.length - 35);
  groundEffects.push({ x: x / PIXEL_SCALE, y: y / PIXEL_SCALE, type, size: 1 + Math.random() * 2 | 0, age: 0 });
}

// ══════════════════════════════════════════════════════════
// WAR BACKGROUND: "The Scarred Front"
// ══════════════════════════════════════════════════════════
function drawWarBackground(ctx: CanvasRenderingContext2D, e: Engine, f: number) {
  const pw = Math.round(GW_PS);
  const ph = Math.round(GH_PS);
  const lanePY = Math.round(GH_PS / 2);

  // ── Layer 1: Sky gradient (dark war sky with orange glow) ──
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ph * 0.55);
  skyGrad.addColorStop(0,   "#0d0a0f");   // Near-black sky
  skyGrad.addColorStop(0.3, "#1a0f0d");    // Dark warm
  skyGrad.addColorStop(0.7, "#2a1510");    // Burnt orange glow
  skyGrad.addColorStop(1,   "#3d1e10");    // Fire-lit horizon
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, pw, Math.round(ph * 0.55));

  // ── Layer 2: Distant mountain silhouettes (parallax ~2%) ──
  drawDistantMountains(ctx, f, pw, ph);

  // ── Layer 3: War smoke plumes on horizon ──
  drawHorizonSmoke(ctx, e, f, pw, ph);

  // ── Floating embers in sky ──
  drawSkyEmbers(ctx, e, f, pw, ph);

  // ── Layer 4: Main ground terrain ──
  const groundGrad = ctx.createLinearGradient(0, ph * 0.55, 0, ph);
  groundGrad.addColorStop(0,   "#2d1a0d");   // Scorched topsoil at horizon
  groundGrad.addColorStop(0.3, "#1f1409");    // Dark mud
  groundGrad.addColorStop(0.6, "#170e06");    // Deep mud
  groundGrad.addColorStop(1.0, "#0e0904");    // Near-black ground
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, Math.round(ph * 0.55 - 1), pw, ph);

  // ── Ground texture noise ──
  drawGroundTexture(ctx, e, f, pw, ph);

  // ── Scorch / crater layer on main ground ──
  drawGroundEffects(ctx, e, f, pw, ph);

  // ── The "lane" - trampled path where enemies march ──
  ctx.fillStyle = "#2b1f14";
  ctx.fillRect(0, lanePY - 4, pw, 9);
  const pathOff = -(f >> 2) & 7;
  for (let x = pathOff; x < pw; x += 8) {
    if (x < 0) continue;
    const flicker = 0.15 + 0.08 * Math.sin(e.time * 0.004 + x * 0.2);
    ctx.fillStyle = `rgba(180,80,30,${flicker})`;  // Warm embers on path
    ctx.fillRect(x, lanePY, 2, 1);
  }

  // ── Ground debris (small rocks, shell casings, barbed wire) ──
  drawDebris(ctx, e, f, pw, ph);

  // ── Barbed wire segments at the edges ──
  drawBarbedWire(ctx, f, pw, ph, lanePY);
}

function drawDistantMountains(ctx: CanvasRenderingContext2D, f: number, pw: number, ph: number) {
  const scroll = -(f >> 1) & 31;
  ctx.fillStyle = "#120c0a";
  // Far ridge line
  const ridgeH = Math.round(ph * 0.45);
  for (let x = 0; x < pw; x++) {
    const n = Math.sin((x + scroll * 0.3) * 0.4) * 2
            + Math.sin((x + scroll * 0.5) * 0.8) * 1.5
            + Math.sin((x + scroll * 0.7) * 1.5) * 0.8;
    const h = Math.round(ridgeH - n - 2);
    if (h > 0) ctx.fillRect(x, Math.max(0, h), 1, Math.max(1, Math.round(ph * 0.55) - h));
  }
  // Closer hills (slightly brighter, slower parallax)
  ctx.fillStyle = "#1a100d";
  const hillH = Math.round(ph * 0.50);
  for (let x = 0; x < pw; x++) {
    const n = Math.sin((x + scroll * 0.5) * 0.3) * 3
            + Math.sin((x + scroll) * 0.6) * 1.5;
    const h = Math.round(hillH - Math.abs(n));
    if (h > 0 && h < Math.round(ph * 0.55)) ctx.fillRect(x, Math.max(0, h), 1, Math.round(ph * 0.55) - h);
  }
}

function drawHorizonSmoke(ctx: CanvasRenderingContext2D, e: Engine, f: number, pw: number, ph: number) {
  const horizonY = Math.round(ph * 0.42);
  // Multiple smoke plumes
  for (let i = 0; i < 3; i++) {
    const baseX = pw * (0.3 + i * 0.25) + (Math.sin(f * 0.03 + i * 3) * 2);
    const sway = Math.sin(e.time * 0.001 + i * 2) * 1;
    ctx.globalAlpha = 0.12 + 0.04 * Math.sin(f * 0.02 + i);
    // Smoke column
    for (let y = horizonY; y > 2; y--) {
      const w = 1 + ((horizonY - y) >> 1);
      const xOff = sway + Math.sin(y * 0.3 + f * 0.05) * 1;
      ctx.fillStyle = y < horizonY - 4 ? "#1a1515" : "#251a15";
      ctx.fillRect(Math.round(baseX + xOff - w / 2), y, Math.max(1, w), 1);
    }
    ctx.globalAlpha = 1;
  }
}

function drawSkyEmbers(ctx: CanvasRenderingContext2D, e: Engine, f: number, pw: number, ph: number) {
  for (let i = 0; i < 6; i++) {
    const ex = ((f * 1.1 + i * 37) % (pw + 4)) - 2;
    const ey = (Math.sin(f * 0.025 + i * 1.7 + e.time * 0.0003 * i) * 0.3 + 0.2) * ph * 0.5;
    const a = 0.2 + 0.15 * Math.sin(f * 0.06 + i * 2.3);
    ctx.globalAlpha = a;
    const hue = i % 3 === 0 ? "#e07020" : i % 3 === 1 ? "#c05010" : "#ff9040";
    ctx.fillStyle = hue;
    ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawGroundTexture(ctx: CanvasRenderingContext2D, e: Engine, f: number, pw: number, ph: number) {
  // Deterministic noise pattern for dirt/mud texture
  const startY = Math.round(ph * 0.55);
  for (let y = startY; y < ph; y += 2) {
    for (let x = 0; x < pw; x += 2) {
      const v = ((x * 7 + y * 13 + f * 3) % 11);
      if (v < 2) { ctx.globalAlpha = 0.08; ctx.fillStyle = "#3d2818"; ctx.fillRect(x, y, 1, 1); }
      else if (v > 9) { ctx.globalAlpha = 0.05; ctx.fillStyle = "#0a0604"; ctx.fillRect(x, y, 1, 1); }
    }
  }
  // Mud puddles (slightly lighter, irregular patches)
  for (let i = 0; i < 4; i++) {
    const px = 10 + ((i * 31) % (pw - 20));
    const py = startY + 3 + ((i * 17) % (ph - startY - 6));
    ctx.fillStyle = "#251c12";
    ctx.fillRect(px, py, 2, 1);
    ctx.fillRect(px + 1, py + 1, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawGroundEffects(ctx: CanvasRenderingContext2D, e: Engine, f: number, pw: number, ph: number) {
  // Persist craters/scorches from explosions
  // Add crater when big particle explosions happen
  for (const pp of e.particles) {
    if (pp.type === "ring" && pp.life / pp.maxLife > 0.7) {
      const cx = Math.round(pp.x / PIXEL_SCALE);
      const cy = Math.round(pp.y / PIXEL_SCALE);
      if (cx > 0 && cx < pw && cy > Math.round(ph * 0.55) && cy < ph) {
        addGroundEffect(pp.x, pp.y, "scorch");
      }
    }
  }

  // Draw persistent ground effects
  for (const ge of groundEffects) {
    ge.age += 0.001;
    const alpha = Math.max(0.02, 0.25 - ge.age * 0.005);
    if (ge.type === "crater") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#0a0604";
      const s = ge.size;
      ctx.fillRect(ge.x - s, ge.y - 1, s * 2 + 1, 3);
      ctx.fillRect(ge.x - s - 1, ge.y, s * 2 + 3, 1);
    } else if (ge.type === "scorch") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#100800";
      const s = ge.size + 1;
      ctx.fillRect(ge.x - s, ge.y - s, s * 2 + 1, s * 2 + 1);
    }
  }
  ctx.globalAlpha = 1;
}

function drawDebris(ctx: CanvasRenderingContext2D, e: Engine, f: number, pw: number, ph: number) {
  // Static debris scattered across ground - determined by position hash
  const startY = Math.round(ph * 0.58);
  for (let y = startY; y < ph - 3; y += 7) {
    for (let x = 1; x < pw - 1; x += 9) {
      const h = (x * 17 + y * 31) % 13;
      if (h === 0) { ctx.fillStyle = "#3a2810"; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = "#2a1e0c"; ctx.fillRect(x + 1, y, 1, 1); }
      else if (h === 3) { ctx.fillStyle = "#4a3018"; ctx.fillRect(x, y, 2, 1); }
      else if (h === 7) { ctx.fillStyle = "#3d2818"; ctx.fillRect(x, y, 1, 2); }
      else if (h === 11) { ctx.fillStyle = "#504020"; ctx.fillRect(x, y, 1, 1); }
    }
  }
}

function drawBarbedWire(ctx: CanvasRenderingContext2D, f: number, pw: number, ph: number, lanePY: number) {
  // Barbed wire along top/bottom edges of the lane
  ctx.fillStyle = "#3a3028";
  const flick = 0.5 + 0.5 * Math.sin(f * 0.03);
  for (let x = 0; x < pw; x += 3) {
    const topY = lanePY - 6 + Math.sin(f * 0.04 + x * 0.5) * 0.5;
    const botY = lanePY + 5 + Math.sin(f * 0.03 + x * 0.7) * 0.5;
    if (topY > 0) ctx.fillRect(x, Math.round(topY), 1, 1);
    if (botY < ph) ctx.fillRect(x, Math.round(botY), 1, 1);
  }
  // Occasional wire post
  for (let x = 6; x < pw; x += 20) {
    ctx.fillStyle = "#4a3a28";
    ctx.fillRect(x, lanePY - 7, 1, 2);
    ctx.fillRect(x, lanePY + 5, 1, 2);
  }
  ctx.fillStyle = "#3a3028";
}

function render(ctx: CanvasRenderingContext2D, e: Engine) {
  const f = (e.time * 0.06) | 0;
  const shx = e.screenShake.x >> (PIXEL_SCALE - 1);
  const shy = e.screenShake.y >> (PIXEL_SCALE - 1);
  ctx.save();
  ctx.translate(shx, shy);
  ctx.imageSmoothingEnabled = false;

  // ── WAR THEME BACKGROUND: "The Scarred Front" ──
  drawWarBackground(ctx, e, f);

  for (const ef of e.activeEffects) {
    const a = ef.alpha ?? 0;
    const r = Math.round(ef.radius / PIXEL_SCALE);
    const ex = Math.round(ef.x / PIXEL_SCALE); const ey = Math.round(ef.y / PIXEL_SCALE);
    ctx.globalAlpha = a * 0.4; ctx.strokeStyle = ef.type === "damageBoost" ? "#fbbf24" : ef.type === "shieldBurst" ? "#6366f1" : "#22c55e";
    ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
    ctx.strokeRect(ex - r, ey - r, r * 2, r * 2); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  drawPixelBase(ctx, e, f, Math.round(GH_PS / 2));

  for (const en of e.enemies) {
    const ex = Math.round(en.x / PIXEL_SCALE), ey = Math.round(en.y / PIXEL_SCALE);
    drawPixelEnemy(ctx, en, ex, ey, f);
  }

  for (const a of e.agents) {
    const ax = Math.round(a.x / PIXEL_SCALE);
    const ay = Math.round(a.y / PIXEL_SCALE) + (Math.round(Math.sin(a.bobPhase) * 1));
    drawPixelAgent(ctx, a, ax, ay, f);
  }

  for (const pr of e.projs) {
    const ppx = Math.round(pr.x / PIXEL_SCALE), ppy = Math.round(pr.y / PIXEL_SCALE);
    ctx.fillStyle = pr.color;
    if (pr.isCrit) { ctx.fillRect(ppx - 1, ppy - 1, 3, 3); ctx.fillStyle = "#fff"; ctx.fillRect(ppx, ppy, 1, 1); }
    else { ctx.fillRect(ppx, ppy, 2, 1); ctx.globalAlpha = 0.4; ctx.fillRect(ppx - 1, ppy, 1, 1); ctx.fillStyle = "#fff"; ctx.fillRect(ppx, ppy, 1, 1); ctx.globalAlpha = 1; }
    for (let i = 0; i < pr.trail.length; i++) { const t = pr.trail[i]; ctx.globalAlpha = (i / pr.trail.length) * 0.3; ctx.fillStyle = pr.color; ctx.fillRect(Math.round(t.x / PIXEL_SCALE), Math.round(t.y / PIXEL_SCALE), 1, 1); }
    ctx.globalAlpha = 1;
  }

  for (const pp of e.particles) {
    const alpha = Math.max(0, pp.life / pp.maxLife);
    const ppx = Math.round(pp.x / PIXEL_SCALE), ppy = Math.round(pp.y / PIXEL_SCALE);
    if (pp.type === "ring") { ctx.globalAlpha = alpha * 0.4; ctx.strokeStyle = pp.color; ctx.lineWidth = 1; const r = Math.round(pp.size / PIXEL_SCALE * 0.8); if (r > 0) ctx.strokeRect(ppx - r, ppy - r, r * 2 + 1, r * 2 + 1); }
    else if (pp.type === "text" && pp.text) { ctx.globalAlpha = Math.min(1, alpha * 1.5); ctx.fillStyle = pp.color; ctx.font = `bold ${Math.max(4, Math.round((pp.fontSize || 10) / PIXEL_SCALE * 1.5))}px monospace`; ctx.textAlign = "center"; ctx.fillText(pp.text, ppx, ppy); }
    else if (pp.type !== "text") { ctx.globalAlpha = alpha; ctx.fillStyle = pp.color; const sz = Math.max(1, Math.round(pp.size / PIXEL_SCALE * alpha)); ctx.fillRect(ppx, ppy, sz, sz); }
  }
  ctx.globalAlpha = 1;

  if (e.waveAnnounce.timer > 0) {
    const a = Math.min(1, e.waveAnnounce.timer / 500);
    ctx.globalAlpha = a;
    ctx.fillStyle = e.wave === 8 ? "#ef4444" : "#e2e8f0";
    ctx.font = `bold ${Math.max(6, Math.round(28 / PIXEL_SCALE * 1.5))}px monospace`;
    ctx.textAlign = "center";
    ctx.shadowColor = e.wave === 8 ? "#ef4444" : "#6366f1"; ctx.shadowBlur = 2;
    ctx.fillText(e.waveAnnounce.text, PW / 2, Math.round(GH / PIXEL_SCALE / 2 - 12));
    if (e.waveAnnounce.sub) { ctx.font = `${Math.max(3, Math.round(8 / PIXEL_SCALE * 1.5))}px monospace`; ctx.fillStyle = "#94a3b8"; ctx.fillText(e.waveAnnounce.sub, PW / 2, Math.round(GH / PIXEL_SCALE / 2 - 5)); }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  if (e.betweenWaves) { ctx.fillStyle = "#94a3b8"; ctx.font = `bold ${Math.max(5, Math.round(10 / PIXEL_SCALE * 1.5))}px monospace`; ctx.textAlign = "center"; ctx.fillText("⬆️ Upgrades available!", PW / 2, Math.round(GH / PIXEL_SCALE / 2)); }

  ctx.font = `bold ${Math.max(4, Math.round(10 / PIXEL_SCALE * 1.5))}px monospace`; ctx.textAlign = "left";
  ctx.fillStyle = "rgba(10,8,30,0.75)"; ctx.fillRect(0, 0, PW, 7); ctx.fillRect(PW - 24, 0, 24, 7);
  ctx.fillStyle = "#818cf8"; ctx.fillText(`W${e.wave}/8`, 1, 6);
  const ce = e.command === "FAST" ? "⚡" : e.command === "STRONG" ? "🎯" : "🛡️";
  ctx.fillStyle = "#6366f1"; ctx.fillText(`${ce} `, 14, 6);
  ctx.fillStyle = "#fbbf24"; ctx.textAlign = "right"; ctx.fillText(`${e.score}`, PW - 1, 6);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawPixelAgent(ctx: CanvasRenderingContext2D, a: any, x: number, y: number, f: number) {
  const hc = a.heroClass as HeroClass;
  const cl = HERO_COLORS[hc] || HERO_COLORS.knight;
  const flash = a.hitFlash > 0.3;
  const hasBuff = Object.keys(a.activeBuffs || {}).length > 0;
  const sz = hc === "mage" ? 3 : hc === "knight" ? 5 : 4;

  if (flash) { ctx.fillStyle = "#fff"; ctx.fillRect(x - 4, y - 4, 9, 1); ctx.fillRect(x - 5, y - 3, 1, 7); ctx.fillRect(x + 5, y - 3, 1, 7); }

  ctx.globalAlpha = 0.25; ctx.fillStyle = cl.light;
  if (hc === "knight") { ctx.fillRect(x - 4, y - 4, 9, 1); ctx.fillRect(x - 4, y - 3, 1, 7); ctx.fillRect(x + 4, y - 3, 1, 7); }
  else if (hc === "mage") { ctx.fillRect(x - 3, y - 3, 7, 1); ctx.fillRect(x - 3, y, 1, 4); ctx.fillRect(x + 3, y, 1, 4); }
  else { ctx.fillRect(x - 3, y - 4, 7, 1); ctx.fillRect(x - 4, y - 3, 1, 5); ctx.fillRect(x + 4, y - 3, 1, 5); }
  ctx.globalAlpha = 1;

  ctx.fillStyle = flash ? "#fff" : cl.body; ctx.fillRect(x - sz, y - sz, sz * 2, sz * 2);
  ctx.fillStyle = flash ? "#fff" : cl.light;
  if (hc === "mage") { ctx.fillRect(x, y - 1, 1, 1); ctx.fillStyle = "#c084fc"; ctx.fillRect(x - 1, y, 3, 1); }
  else if (hc === "rogue") { ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); }
  else { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); }

  if (hasBuff) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(f * 0.3); ctx.fillStyle = "#fbbf24"; ctx.fillRect(x, y - sz - 1, 1, 1); ctx.globalAlpha = 1; }

  const hpR = a.hp / a.maxHp;
  ctx.fillStyle = "#1f2937"; ctx.fillRect(x - sz, y + sz + 1, sz * 2, 1);
  ctx.fillStyle = hpR > 0.5 ? "#22c55e" : hpR > 0.25 ? "#eab308" : "#ef4444";
  ctx.fillRect(x - sz, y + sz + 1, Math.max(1, Math.round(sz * 2 * hpR)), 1);
}

function drawPixelEnemy(ctx: CanvasRenderingContext2D, en: any, x: number, y: number, f: number) {
  const flash = en.hitFlash > 0.3;
  if (en.type === "boss") {
    ctx.fillStyle = flash ? "#fff" : "#991b1b"; ctx.fillRect(x - 5, y - 4, 11, 9);
    ctx.fillStyle = flash ? "#fff" : "#dc2626"; ctx.fillRect(x - 4, y - 5, 9, 1);
    ctx.fillStyle = flash ? "#fff" : "#7f1d1d"; ctx.fillRect(x - 5, y + 5, 11, 1);
    ctx.fillStyle = flash ? "#fff" : "#fecaca"; ctx.fillRect(x - 3, y - 2, 3, 2); ctx.fillRect(x + 2, y - 2, 3, 2);
    ctx.fillStyle = flash ? "#fff" : "#fbbf24"; ctx.fillRect(x - 5, y - 6, 1, 2); ctx.fillRect(x, y - 6, 1, 2); ctx.fillRect(x + 5, y - 6, 1, 2);
    ctx.globalAlpha = 0.3; ctx.fillStyle = "#ef4444"; ctx.fillRect(x - 6, y - 5, 1, 1); ctx.fillRect(x + 6, y - 5, 1, 1); ctx.globalAlpha = 1;
  } else if (en.type === "tank") {
    ctx.fillStyle = flash ? "#fff" : "#7f1d1d"; ctx.fillRect(x - 3, y - 2, 7, 5);
    ctx.fillStyle = flash ? "#fff" : "#dc2626"; ctx.fillRect(x - 2, y - 3, 5, 1);
    ctx.fillStyle = flash ? "#fff" : "#450a0a"; ctx.fillRect(x - 3, y + 3, 7, 1);
    ctx.fillStyle = flash ? "#fff" : "#fca5a5"; ctx.fillRect(x - 2, y - 1, 2, 1); ctx.fillRect(x + 1, y - 1, 2, 1);
  } else if (en.type === "stealth") {
    if (en.revealed) { ctx.fillStyle = flash ? "#fff" : "#7c3aed"; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = "#e9d5ff"; ctx.fillRect(x, y, 1, 1); }
    else { ctx.globalAlpha = 0.08 + 0.04 * Math.sin(f * 0.4); ctx.fillStyle = "#a855f7"; ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y + 1, 1, 1); ctx.globalAlpha = 1; }
  } else if (en.type === "healer") {
    ctx.fillStyle = flash ? "#fff" : "#166534"; ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.fillStyle = "#22c55e"; ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillStyle = flash ? "#fff" : "#bbf7d0"; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1);
  } else if (en.type === "swarm") {
    ctx.fillStyle = flash ? "#fff" : "#854d0e"; ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = flash ? "#fff" : "#a16207"; ctx.fillRect(x, y, 1, 1);
  } else {
    ctx.fillStyle = flash ? "#fff" : "#b45309";
    ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x - 1, y - 1, 3, 1); ctx.fillRect(x - 2, y, 5, 1);
    ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1);
    ctx.fillStyle = flash ? "#fff" : "#fef3c7"; ctx.fillRect(x - 1, y, 1, 1);
    if (!flash) { const toff = (f * 2) % 3; ctx.globalAlpha = 0.4; ctx.fillStyle = "#f59e0b"; ctx.fillRect(x + 2 + toff, y, 1, 1); ctx.fillRect(x + 3 + toff, y, 1, 1); ctx.globalAlpha = 1; }
  }
}

function drawPixelBase(ctx: CanvasRenderingContext2D, e: Engine, f: number, lanePY: number) {
  const ratio = e.baseHP / e.maxBaseHP;
  const bx = Math.round((GW - 40) / PIXEL_SCALE), by = lanePY, low = ratio < 0.3;
  const body = low ? "#7f1d1d" : "#1e3a5f", light = low ? "#dc2626" : "#3b82f6", dark = low ? "#450a0a" : "#0f1d30", winc = low ? "#fca5a5" : "#93c5fd";

  ctx.fillStyle = light; ctx.fillRect(bx, by - 4, 4, 1); ctx.fillRect(bx + 5, by - 4, 1, 1); ctx.fillRect(bx - 1, by - 3, 6, 1);
  ctx.fillStyle = f % 16 < 8 ? "#fbbf24" : light; ctx.fillRect(bx + 2, by - 5 + (low ? 1 : 0), 1, 1);
  ctx.fillStyle = body; ctx.fillRect(bx - 1, by - 2, 7, 6);
  ctx.fillStyle = light; ctx.fillRect(bx - 2, by - 2, 1, 5); ctx.fillRect(bx + 6, by - 2, 1, 5);
  ctx.fillStyle = winc; ctx.fillRect(bx, by - 1, 1, 1); ctx.fillRect(bx + 4, by - 1, 1, 1); ctx.fillRect(bx + 1, by + 1, 3, 1);
  ctx.fillStyle = dark; ctx.fillRect(bx + 1, by + 2, 3, 2);
  const hbW = 6; ctx.fillStyle = "#1f2937"; ctx.fillRect(bx - 1, by + 4, hbW, 1);
  ctx.fillStyle = ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#eab308" : "#ef4444";
  ctx.fillRect(bx - 1, by + 4, Math.max(1, Math.round(hbW * ratio)), 1);
}
