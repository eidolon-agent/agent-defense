"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ─── Inline everything (no external deps needed) ───

const GW = 800, GH = 500;
const PIXEL_SCALE = 4;
const PW = Math.floor(GW / PIXEL_SCALE);
const PH = Math.floor(GH / PIXEL_SCALE);
const BASE_X = GW - 40, MID_Y = GH / 2;
const AGENT_X = 140;
const WAVES = 8;

type HeroClass = "knight" | "archer" | "mage" | "rogue";
type EnemyType = "fast" | "tank" | "stealth" | "healer" | "boss" | "swarm";

interface Agent {
  id: number; x: number; y: number; heroClass: HeroClass;
  hp: number; maxHp: number; damage: number; range: number;
  cooldown: number; maxCooldown: number; level: number;
  hitFlash: number; bobPhase: number;
  damageDealt: number; enemiesKilled: number; critsCount: number; critChance: number;
  upgrades: string[];
}

interface Enemy {
  id: number; x: number; y: number; type: EnemyType;
  hp: number; maxHp: number; speed: number; reward: number; dmgToBase: number;
  hitFlash: number; wobble: number; isStealthed?: boolean; revealed?: boolean;
}

interface Projectile {
  id: number; x: number; y: number; tx: number; ty: number;
  speed: number; damage: number; color: string; isCrit: boolean;
  trail: Array<{ x: number; y: number }>;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
  type?: "ring" | "text" | "spark";
  text?: string; fontSize?: number;
}

interface PlayerAgent {
  agentId: number; heroClass: HeroClass; level: number;
  personality: string; xp: number; wins: number; losses: number;
}

const HERO_STATS: Record<HeroClass, { hp: number; damage: number; range: number; cooldown: number; color: string }> = {
  knight:  { hp: 18, damage: 4,  range: 120, cooldown: 900,  color: "#3b82f6" },
  archer:  { hp: 10, damage: 4,  range: 220, cooldown: 500,  color: "#e11d48" },
  mage:    { hp: 8,  damage: 3,  range: 250, cooldown: 600,  color: "#a855f7" },
  rogue:   { hp: 10, damage: 5,  range: 160, cooldown: 450,  color: "#64748b" },
};

const HERO_COLORS: Record<HeroClass, { body: string; dark: string; light: string }> = {
  knight:  { body: "#3b82f6", dark: "#1e40af", light: "#60a5fa" },
  archer:  { body: "#e11d48", dark: "#9f1239", light: "#fb7185" },
  mage:    { body: "#a855f7", dark: "#7c3aed", light: "#c084fc" },
  rogue:   { body: "#64748b", dark: "#334155", light: "#94a3b8" },
};

const ECFG: Record<EnemyType, { hp: number; speed: number; reward: number; dmg: number }> = {
  fast:    { hp: 3, speed: 2.2, reward: 10, dmg: 2 },
  tank:    { hp: 8, speed: 0.8, reward: 20, dmg: 5 },
  stealth: { hp: 2, speed: 3.0, reward: 25, dmg: 3 },
  healer:  { hp: 5, speed: 1.0, reward: 35, dmg: 1 },
  swarm:   { hp: 1, speed: 2.5, reward: 2,  dmg: 1 },
  boss:    { hp: 120, speed: 0.5, reward: 100, dmg: 15 },
};

const WCOMP: EnemyType[][] = [
  ["fast","fast","fast"],
  ["fast","fast","fast","tank"],
  ["fast","fast","tank","tank","stealth","fast"],
  ["fast","tank","swarm","swarm","swarm","swarm","swarm"],
  ["stealth","fast","tank","stealth","tank","healer","fast"],
  ["healer","tank","swarm","fast","stealth","tank","stealth","fast"],
  ["boss","fast","fast","tank","tank"],
  ["boss","stealth","stealth","healer","tank","fast","fast","swarm","swarm"],
];

// ─── Ground effects persistence ───
const groundEffects: Array<{ x: number; y: number; type: string; size: number; age: number }> = [];

// ══════════════════════════════════════════════════════════
// WAR BACKGROUND: "The Scarred Front"
// ══════════════════════════════════════════════════════════
function drawWarBackground(ctx: CanvasRenderingContext2D, time: number, wave: number) {
  const f = (time * 0.06) | 0;
  const pw = PW, ph = PH;
  const lanePY = Math.floor(ph / 2);
  const scroll = -(f >> 1) & 31;

  // ── LAYER 1: Sky gradient (dark war sky → fire-lit horizon) ──
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ph * 0.48);
  const nightIntensity = Math.min(1, wave / 4);
  skyGrad.addColorStop(0,   `rgba(${13 - nightIntensity * 5},${10 - nightIntensity * 3},${15 - nightIntensity * 7},1)`);
  skyGrad.addColorStop(0.3, "#1a0f0d");
  skyGrad.addColorStop(0.7, "#2a1510");
  skyGrad.addColorStop(1,   "#3d1e10");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, pw, Math.round(ph * 0.48));

  // ── LAYER 2: Distant mountains (parallax ~2%) ──
  ctx.fillStyle = "#120c0a";
  const ridgeH = Math.round(ph * 0.38);
  for (let x = 0; x < pw; x++) {
    const n = Math.sin((x + scroll * 0.3) * 0.4) * 2
            + Math.sin((x + scroll * 0.5) * 0.8) * 1.5
            + Math.sin((x + scroll * 0.7) * 1.5) * 0.8;
    const h = Math.round(ridgeH - n - 2);
    if (h > 0 && h < Math.round(ph * 0.48))
      ctx.fillRect(x, h, 1, Math.round(ph * 0.48) - h);
  }
  ctx.fillStyle = "#1a100d";
  const hillH = Math.round(ph * 0.44);
  for (let x = 0; x < pw; x++) {
    const n = Math.sin((x + scroll * 0.5) * 0.3) * 3 + Math.sin((x + scroll) * 0.6) * 1.5;
    const h = Math.round(hillH - Math.abs(n));
    if (h > 0 && h < Math.round(ph * 0.48))
      ctx.fillRect(x, h, 1, Math.round(ph * 0.48) - h);
  }

  // ── LAYER 3: War smoke plumes ──
  const horizonY = Math.round(ph * 0.36);
  for (let i = 0; i < 4; i++) {
    const baseX = pw * (0.15 + i * 0.22) + (Math.sin(f * 0.03 + i * 3) * 2);
    const sway = Math.sin(time * 0.001 + i * 2) * 1;
    ctx.globalAlpha = 0.1 + 0.04 * Math.sin(f * 0.02 + i);
    for (let y = horizonY; y > 2; y--) {
      const w = 1 + ((horizonY - y) >> 1);
      const xOff = sway + Math.sin(y * 0.3 + f * 0.05) * 1;
      ctx.fillStyle = y < horizonY - 4 ? "#1a1515" : "#251a15";
      ctx.fillRect(Math.round(baseX + xOff - w / 2), y, Math.max(1, w), 1);
    }
  }
  ctx.globalAlpha = 1;

  // ── Floating embers in sky ──
  for (let i = 0; i < 5; i++) {
    const ex = ((f * 1.1 + i * 37) % (pw + 4)) - 2;
    const ey = (Math.sin(f * 0.025 + i * 1.7 + time * 0.0003 * i) * 0.3 + 0.2) * ph * 0.45;
    const a = 0.15 + 0.1 * Math.sin(f * 0.06 + i * 2.3);
    ctx.globalAlpha = a;
    ctx.fillStyle = i % 3 === 0 ? "#e07020" : i % 3 === 1 ? "#c05010" : "#ff9040";
    ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
  }
  ctx.globalAlpha = 1;

  // ── LAYER 4: Ground terrain gradient ──
  const groundGrad = ctx.createLinearGradient(0, ph * 0.48, 0, ph);
  groundGrad.addColorStop(0,   "#2d1a0d");   // Scorched topsoil
  groundGrad.addColorStop(0.3, "#1f1409");    // Dark mud
  groundGrad.addColorStop(0.6, "#170e06");    // Deep mud
  groundGrad.addColorStop(1.0, "#0e0904");    // Near-black ground
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, Math.round(ph * 0.48) - 1, pw, ph);

  // ── Ground texture noise ──
  const startY = Math.round(ph * 0.48);
  for (let y = startY; y < ph; y += 2) {
    for (let x = 0; x < pw; x += 2) {
      const v = ((x * 7 + y * 13 + f * 3) % 11);
      if (v < 2) { ctx.globalAlpha = 0.06; ctx.fillStyle = "#3d2818"; ctx.fillRect(x, y, 1, 1); }
      else if (v > 9) { ctx.globalAlpha = 0.04; ctx.fillStyle = "#0a0604"; ctx.fillRect(x, y, 1, 1); }
    }
  }
  ctx.globalAlpha = 1;

  // Mud puddles
  for (let i = 0; i < 4; i++) {
    const px = 10 + ((i * 31) % (pw - 20));
    const py = startY + 3 + ((i * 17) % (ph - startY - 6));
    ctx.fillStyle = "#251c12";
    ctx.fillRect(px, py, 2, 1);
    ctx.fillRect(px + 1, py + 1, 1, 1);
  }

  // ── LAYER 5: Persistent scorch marks / craters ──
  for (const ge of groundEffects) {
    ge.age += 0.001;
    const alpha = Math.max(0.02, 0.3 - ge.age * 0.008);
    if (ge.type === "crater") {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#0a0604";
      const s = ge.size;
      ctx.fillRect(ge.x - s, ge.y - 1, s * 2 + 1, 3);
      ctx.fillRect(ge.x - s - 1, ge.y, s * 2 + 3, 1);
    } else {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#100800";
      const s = ge.size + 1;
      ctx.fillRect(ge.x - s, ge.y - s, s * 2 + 1, s * 2 + 1);
    }
  }
  ctx.globalAlpha = 1;

  // ── The "lane" ─ trampled path with ember flicker ──
  ctx.fillStyle = "#2b1f14";
  ctx.fillRect(0, lanePY - 4, pw, 9);
  const pathOff = -(f >> 2) & 7;
  for (let x = pathOff; x < pw; x += 8) {
    if (x < 0) continue;
    const flicker = 0.12 + 0.08 * Math.sin(time * 0.004 + x * 0.2);
    ctx.fillStyle = `rgba(180,80,30,${flicker})`;
    ctx.fillRect(x, lanePY, 2, 1);
  }

  // ── Ground debris ──
  for (let y = startY + 2; y < ph - 3; y += 7) {
    for (let x = 1; x < pw - 1; x += 9) {
      const h = (x * 17 + y * 31) % 13;
      if (h === 0) { ctx.fillStyle = "#3a2810"; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = "#2a1e0c"; ctx.fillRect(x + 1, y, 1, 1); }
      else if (h === 3) { ctx.fillStyle = "#4a3018"; ctx.fillRect(x, y, 2, 1); }
      else if (h === 7) { ctx.fillStyle = "#3d2818"; ctx.fillRect(x, y, 1, 2); }
    }
  }

  // ── Barbed wire along lane edges ──
  ctx.fillStyle = "#3a3028";
  for (let x = 0; x < pw; x += 3) {
    const topY = lanePY - 6 + Math.sin(f * 0.04 + x * 0.5) * 0.5;
    const botY = lanePY + 5 + Math.sin(f * 0.03 + x * 0.7) * 0.5;
    if (topY > 0) ctx.fillRect(x, Math.round(topY), 1, 1);
    if (botY < ph) ctx.fillRect(x, Math.round(botY), 1, 1);
  }
  for (let x = 6; x < pw; x += 20) {
    ctx.fillStyle = "#4a3a28";
    ctx.fillRect(x, lanePY - 7, 1, 2);
    ctx.fillRect(x, lanePY + 5, 1, 2);
  }
}

// ══════════════════════════════════════════════════════════
// PIXEL ART SPRITE DRAWING
// ══════════════════════════════════════════════════════════
function drawAgent(ctx: CanvasRenderingContext2D, a: Agent, f: number) {
  const hc = a.heroClass;
  const cl = HERO_COLORS[hc];
  const sz = hc === "mage" ? 3 : hc === "knight" ? 5 : 4;
  const ax = Math.round(a.x / PIXEL_SCALE);
  const ay = Math.round(a.y / PIXEL_SCALE) + (Math.round(Math.sin(a.bobPhase) * 1));
  const flash = a.hitFlash > 0.3;

  // Shadow
  ctx.globalAlpha = 0.25; ctx.fillStyle = cl.light;
  if (hc === "knight") { ctx.fillRect(ax - 4, ay - 4, 9, 1); ctx.fillRect(ax - 4, ay - 3, 1, 7); ctx.fillRect(ax + 4, ay - 3, 1, 7); }
  else { ctx.fillRect(ax - 3, ay - 4, 7, 1); ctx.fillRect(ax - 4, ay - 3, 1, 5); ctx.fillRect(ax + 4, ay - 3, 1, 5); }
  ctx.globalAlpha = 1;

  // Body
  ctx.fillStyle = flash ? "#fff" : cl.body;
  ctx.fillRect(ax - sz, ay - sz, sz * 2, sz * 2);
  ctx.fillStyle = flash ? "#fff" : cl.light;
  if (hc === "mage") { ctx.fillRect(ax, ay - 1, 1, 1); ctx.fillStyle = "#c084fc"; ctx.fillRect(ax - 1, ay, 3, 1); }
  else if (hc === "rogue") { ctx.fillRect(ax - 1, ay - 1, 1, 1); ctx.fillRect(ax + 1, ay - 1, 1, 1); }
  else { ctx.fillRect(ax - 1, ay, 1, 1); ctx.fillRect(ax + 1, ay, 1, 1); }

  // HP bar
  const hpR = a.hp / a.maxHp;
  ctx.fillStyle = "#1f2937"; ctx.fillRect(ax - sz, ay + sz + 1, sz * 2, 1);
  ctx.fillStyle = hpR > 0.5 ? "#22c55e" : hpR > 0.25 ? "#eab308" : "#ef4444";
  ctx.fillRect(ax - sz, ay + sz + 1, Math.max(1, Math.round(sz * 2 * hpR)), 1);
}

function drawEnemy(ctx: CanvasRenderingContext2D, en: Enemy, f: number) {
  const ex = Math.round(en.x / PIXEL_SCALE), ey = Math.round(en.y / PIXEL_SCALE);
  const flash = en.hitFlash > 0.3;

  if (en.type === "boss") {
    ctx.fillStyle = flash ? "#fff" : "#5a1a10";
    ctx.fillRect(ex - 5, ey - 4, 11, 9);
    ctx.fillStyle = flash ? "#fff" : "#c43020";
    ctx.fillRect(ex - 4, ey - 5, 9, 1);
    ctx.fillStyle = flash ? "#fff" : "#3a0a05";
    ctx.fillRect(ex - 5, ey + 5, 11, 1);
    ctx.fillStyle = flash ? "#fff" : "#fecaca";
    ctx.fillRect(ex - 3, ey - 2, 3, 2); ctx.fillRect(ex + 2, ey - 2, 3, 2);
    ctx.fillStyle = flash ? "#fff" : "#fbbf24";
    ctx.fillRect(ex - 5, ey - 6, 1, 2); ctx.fillRect(ex, ey - 6, 1, 2); ctx.fillRect(ex + 5, ey - 6, 1, 2);
    ctx.globalAlpha = 0.3; ctx.fillStyle = "#ef4444";
    ctx.fillRect(ex - 6, ey - 5, 1, 1); ctx.fillRect(ex + 6, ey - 5, 1, 1);
    ctx.globalAlpha = 1;
  } else if (en.type === "tank") {
    ctx.fillStyle = flash ? "#fff" : "#3a2a20";
    ctx.fillRect(ex - 3, ey - 2, 7, 5);
    ctx.fillStyle = flash ? "#fff" : "#7a4a30";
    ctx.fillRect(ex - 2, ey - 3, 5, 1);
    ctx.fillStyle = flash ? "#fff" : "#2a1a10";
    ctx.fillRect(ex - 3, ey + 3, 7, 1);
    ctx.fillStyle = flash ? "#fff" : "#c0a080";
    ctx.fillRect(ex - 2, ey - 1, 2, 1); ctx.fillRect(ex + 1, ey - 1, 2, 1);
  } else if (en.type === "stealth") {
    if (en.revealed) {
      ctx.fillStyle = flash ? "#fff" : "#4a1a6a";
      ctx.fillRect(ex - 2, ey - 2, 5, 5);
      ctx.fillStyle = "#e9d5ff"; ctx.fillRect(ex, ey, 1, 1);
    } else {
      ctx.globalAlpha = 0.06 + 0.04 * Math.sin(f * 0.4);
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(ex, ey - 1, 1, 1); ctx.fillRect(ex - 1, ey, 3, 1); ctx.fillRect(ex, ey + 1, 1, 1);
      ctx.globalAlpha = 1;
    }
  } else if (en.type === "healer") {
    ctx.fillStyle = flash ? "#fff" : "#1a4a20";
    ctx.fillRect(ex - 2, ey - 2, 5, 5);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(ex, ey - 1, 1, 3); ctx.fillRect(ex - 1, ey, 3, 1);
    ctx.fillStyle = flash ? "#fff" : "#bbf7d0";
    ctx.fillRect(ex - 1, ey - 1, 1, 1); ctx.fillRect(ex + 1, ey - 1, 1, 1);
  } else if (en.type === "swarm") {
    ctx.fillStyle = flash ? "#fff" : "#5a3a08";
    ctx.fillRect(ex - 1, ey - 1, 3, 3);
    ctx.fillStyle = flash ? "#fff" : "#a16207";
    ctx.fillRect(ex, ey, 1, 1);
  } else {
    ctx.fillStyle = flash ? "#fff" : "#7a4a10";
    ctx.fillRect(ex, ey - 2, 1, 1); ctx.fillRect(ex - 1, ey - 1, 3, 1); ctx.fillRect(ex - 2, ey, 5, 1);
    ctx.fillRect(ex - 1, ey + 1, 3, 1); ctx.fillRect(ex, ey + 2, 1, 1);
    ctx.fillStyle = flash ? "#fff" : "#fef3c7";
    ctx.fillRect(ex - 1, ey, 1, 1);
  }

  // HP bar for non-fast enemies
  if (en.maxHp > 2) {
    const hpR = en.hp / en.maxHp;
    const bw = en.type === "boss" ? 10 : 6;
    ctx.fillStyle = "#1f2937"; ctx.fillRect(ex - bw / 2, ey - (en.type === "boss" ? 7 : 5), bw, 1);
    ctx.fillStyle = hpR > 0.5 ? "#22c55e" : "#ef4444";
    ctx.fillRect(ex - bw / 2, ey - (en.type === "boss" ? 7 : 5), Math.max(1, Math.round(bw * hpR)), 1);
  }
}

function drawBase(ctx: CanvasRenderingContext2D, baseHP: number, maxBaseHP: number, f: number) {
  const ratio = baseHP / maxBaseHP;
  const bx = Math.round((BASE_X - 40) / PIXEL_SCALE), by = Math.floor(PH / 2);
  const low = ratio < 0.3;
  const body = low ? "#7f1d1d" : "#1e3a5f", light = low ? "#dc2626" : "#3b82f6", winc = low ? "#fca5a5" : "#93c5fd";

  ctx.fillStyle = light; ctx.fillRect(bx, by - 4, 4, 1); ctx.fillRect(bx + 5, by - 4, 1, 1); ctx.fillRect(bx - 1, by - 3, 6, 1);
  ctx.fillStyle = f % 16 < 8 ? "#fbbf24" : light; ctx.fillRect(bx + 2, by - 5 + (low ? 1 : 0), 1, 1);
  ctx.fillStyle = body; ctx.fillRect(bx - 1, by - 2, 7, 6);
  ctx.fillStyle = light; ctx.fillRect(bx - 2, by - 2, 1, 5); ctx.fillRect(bx + 6, by - 2, 1, 5);
  ctx.fillStyle = winc; ctx.fillRect(bx, by - 1, 1, 1); ctx.fillRect(bx + 4, by - 1, 1, 1); ctx.fillRect(bx + 1, by + 1, 3, 1);
  ctx.fillStyle = low ? "#450a0a" : "#0f1d30"; ctx.fillRect(bx + 1, by + 2, 3, 2);
  const hbW = 6; ctx.fillStyle = "#1f2937"; ctx.fillRect(bx - 1, by + 4, hbW, 1);
  ctx.fillStyle = ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#eab308" : "#ef4444";
  ctx.fillRect(bx - 1, by + 4, Math.max(1, Math.round(hbW * ratio)), 1);
}

// ══════════════════════════════════════════════════════════
// GAME PAGE COMPONENT
// ══════════════════════════════════════════════════════════
export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [displayWave, setDisplayWave] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayGold, setDisplayGold] = useState(50);
  const [displayBaseHP, setDisplayBaseHP] = useState(20);
  const [maxBaseHP, setMaxBaseHP] = useState(20);

  // Refs for game state (mutable, accessed in animation loop)
  const agentsRef = useRef<Agent[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const projsRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const gameTimeRef = useRef(0);
  const waveRef = useRef(0);
  const goldRef = useRef(50);
  const scoreRef = useRef(0);
  const baseHPRef = useRef(20);
  const waveTimerRef = useRef(0);
  const spawnQueueRef = useRef<EnemyType[]>([]);
  const spawnTimerRef = useRef(0);
  const betweenWavesRef = useRef(false);
  const waveAnnounceRef = useRef({ timer: 0, text: "" });
  const runningRef = useRef(false);

  const initGame = useCallback((numPlayers: number) => {
    // Clear
    agentsRef.current = [];
    enemiesRef.current = [];
    projsRef.current = [];
    particlesRef.current = [];
    groundEffects.length = 0; // Clear ground effects
    gameTimeRef.current = 0;
    waveRef.current = 0;
    goldRef.current = 50;
    scoreRef.current = 0;
    baseHPRef.current = 20;
    waveTimerRef.current = 2000;
    spawnQueueRef.current = [];
    spawnTimerRef.current = 0;
    betweenWavesRef.current = false;
    waveAnnounceRef.current = { timer: 0, text: "" };

    // Create agents
    const classes: HeroClass[] = ["knight", "archer", "mage", "rogue"];
    for (let i = 0; i < numPlayers; i++) {
      const hc = classes[i % classes.length];
      const s = HERO_STATS[hc];
      agentsRef.current.push({
        id: i, x: AGENT_X + i * 40, y: MID_Y - 20 + i * 15,
        heroClass: hc, hp: s.hp, maxHp: s.hp, damage: s.damage, range: s.range,
        cooldown: 0, maxCooldown: s.cooldown, level: 1,
        hitFlash: 0, bobPhase: Math.random() * Math.PI * 2,
        damageDealt: 0, enemiesKilled: 0, critsCount: 0, critChance: 0, upgrades: [],
      });
    }
  }, []);

  const startGame = useCallback((numPlayers: number) => {
    initGame(numPlayers);
    setStarted(true);
    setGameOver(false);
    setVictory(false);
    setDisplayWave(0);
    setDisplayScore(0);
    setDisplayGold(50);
    setDisplayBaseHP(20);
    setMaxBaseHP(20);
  }, [initGame]);

  // ── Canvas render loop ──
  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PW; canvas.height = PH;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = false;
    runningRef.current = true;

    let raf: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!runningRef.current) return;
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      gameTimeRef.current += dt;
      const t = gameTimeRef.current;

      // ── Game tick ──
      // Wave management
      if (betweenWavesRef.current) {
        waveAnnounceRef.current.timer = Math.max(0, waveAnnounceRef.current.timer - dt);
        if (waveAnnounceRef.current.timer <= 0 && enemiesRef.current.length === 0) {
          betweenWavesRef.current = false;
          waveRef.current++;
          if (waveRef.current > WAVES) {
            setVictory(true); setGameOver(true);
            runningRef.current = false;
            return;
          }
          spawnQueueRef.current = [...WCOMP[waveRef.current - 1]];
          spawnTimerRef.current = 0;
          waveAnnounceRef.current = {
            timer: 2000,
            text: waveRef.current === 8 ? "⚠ FINAL WAVE ⚠" : `Wave ${waveRef.current}`,
          };
        }
      } else if (waveRef.current === 0) {
        waveRef.current = 1;
        spawnQueueRef.current = [...WCOMP[0]];
        spawnTimerRef.current = 0;
        waveAnnounceRef.current = { timer: 2000, text: "Wave 1" };
      }

      // Spawn enemies
      if (spawnQueueRef.current.length > 0) {
        spawnTimerRef.current -= dt;
        if (spawnTimerRef.current <= 0) {
          const type = spawnQueueRef.current.shift()!;
          const cfg = ECFG[type];
          enemiesRef.current.push({
            id: 100 + Math.random() * 1000 | 0, x: 0, y: MID_Y + (Math.random() - 0.5) * 30,
            type, hp: cfg.hp, maxHp: cfg.hp, speed: cfg.speed, reward: cfg.reward,
            dmgToBase: cfg.dmg, hitFlash: 0, wobble: 0,
            isStealthed: type === "stealth",
          });
          spawnTimerRef.current = type === "swarm" ? 150 : type === "boss" ? 2000 : 400;
        }
      } else if (enemiesRef.current.length === 0 && !betweenWavesRef.current && waveRef.current > 0) {
        betweenWavesRef.current = true;
        goldRef.current += 10 + waveRef.current * 5;
        baseHPRef.current = Math.min(20, baseHPRef.current + 2);
      }

      // Move enemies toward base
      for (const en of enemiesRef.current) {
        en.x += en.speed * (dt / 16);
        en.wobble = (en.wobble + dt * 0.01) % (Math.PI * 2);
        if (en.hitFlash > 0) en.hitFlash -= dt * 0.01;

        if (en.x >= BASE_X) {
          baseHPRef.current -= en.dmgToBase;
          en.hp = 0;
          if (baseHPRef.current <= 0) {
            baseHPRef.current = 0;
            setGameOver(true); runningRef.current = false;
          }
        }
      }

      // Agent attacks
      for (const a of agentsRef.current) {
        a.cooldown -= dt;
        a.bobPhase += dt * 0.005;
        if (a.hitFlash > 0) a.hitFlash -= dt * 0.008;

        if (a.cooldown <= 0) {
          let nearest: Enemy | null = null;
          let nearDist = Infinity;
          for (const en of enemiesRef.current) {
            if (en.hp <= 0) continue;
            if (en.isStealthed && !en.revealed) continue;
            const dx = en.x - a.x, dy = en.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < a.range && dist < nearDist) { nearDist = dist; nearest = en; }
          }
          if (nearest) {
            const isCrit = Math.random() < a.critChance;
            projsRef.current.push({
              id: ++pidCounter, x: a.x + 10, y: a.y,
              tx: nearest.x, ty: nearest.y,
              speed: 4, damage: a.damage * (isCrit ? 2 : 1),
              color: a.heroClass === "mage" ? "#c084fc" : a.heroClass === "knight" ? "#60a5fa" : "#fbbf24",
              isCrit, trail: [],
            });
            a.cooldown = a.maxCooldown;
          }
        }
      }

      // Projectiles
      for (const p of projsRef.current) {
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8) {
          // Hit check
          for (const en of enemiesRef.current) {
            if (en.hp <= 0) continue;
            const edx = en.x - p.x, edy = en.y - p.y;
            if (Math.sqrt(edx * edx + edy * edy) < 20) {
              en.hp -= p.damage;
              en.hitFlash = 1;
              if (en.isStealthed) en.revealed = true;
          // Find closest agent to attribute damage
          let closestAgent: Agent | null = null;
          let closestDist = Infinity;
          for (const ag of agentsRef.current) {
            const ddx = ag.x - en.x, ddy = ag.y - en.y;
            const dd = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dd < closestDist) { closestDist = dd; closestAgent = ag; }
          }
          if (closestAgent) { closestAgent.damageDealt += p.damage; }
          if (en.hp <= 0) {
            goldRef.current += en.reward;
            if (closestAgent) closestAgent.enemiesKilled++;
                // Explosion particles
                for (let i = 0; i < 6; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  particlesRef.current.push({
                    x: en.x, y: en.y,
                    vx: Math.cos(angle) * (0.5 + Math.random()),
                    vy: Math.sin(angle) * (0.5 + Math.random()),
                    life: 200 + Math.random() * 300, maxLife: 500,
                    color: en.type === "boss" ? "#ef4444" : "#fbbf24",
                    size: en.type === "boss" ? 3 : 2,
                    type: "ring",
                  });
                }
                // Add scorch mark
                groundEffects.push({
                  x: en.x / PIXEL_SCALE, y: en.y / PIXEL_SCALE,
                  type: "scorch", size: Math.max(1, en.type === "boss" ? 3 : 1 | Math.random() * 2),
                  age: 0,
                });
              }
              break;
            }
          }
          p.trail = []; // Mark for removal
        } else {
          p.x += (dx / dist) * p.speed * (dt / 16);
          p.y += (dy / dist) * p.speed * (dt / 16);
          if (p.trail.length > 4) p.trail.shift();
          p.trail.push({ x: p.x, y: p.y });
        }
      }
      projsRef.current = projsRef.current.filter(p => p.trail.length > 0);
      enemiesRef.current = enemiesRef.current.filter(en => en.hp > 0);

      // Particles
      for (const pp of particlesRef.current) {
        pp.x += pp.vx * (dt / 16); pp.y += pp.vy * (dt / 16);
        pp.vy += 0.02 * (dt / 16); // gravity
        pp.life -= dt;
      }
      particlesRef.current = particlesRef.current.filter(pp => pp.life > 0);

      // ── RENDER ──
      const frame = (t * 0.06) | 0;

      // War background
      drawWarBackground(ctx, t, waveRef.current);

      // Base
      drawBase(ctx, baseHPRef.current, 20, frame);

      // Enemies
      for (const en of enemiesRef.current) drawEnemy(ctx, en, frame);

      // Agents
      for (const a of agentsRef.current) drawAgent(ctx, a, frame);

      // Projectiles
      for (const p of projsRef.current) {
        const px_ = Math.round(p.x / PIXEL_SCALE), py_ = Math.round(p.y / PIXEL_SCALE);
        ctx.fillStyle = p.color;
        if (p.isCrit) { ctx.fillRect(px_ - 1, py_ - 1, 3, 3); ctx.fillStyle = "#fff"; ctx.fillRect(px_, py_, 1, 1); }
        else { ctx.fillRect(px_, py_, 2, 1); ctx.fillStyle = "#fff"; ctx.fillRect(px_, py_, 1, 1); }
        for (let i = 0; i < p.trail.length; i++) {
          const tr = p.trail[i];
          ctx.globalAlpha = (i / p.trail.length) * 0.3; ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(tr.x / PIXEL_SCALE), Math.round(tr.y / PIXEL_SCALE), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // Particles
      for (const pp of particlesRef.current) {
        const alpha = Math.max(0, pp.life / pp.maxLife);
        const ppx = Math.round(pp.x / PIXEL_SCALE), ppy = Math.round(pp.y / PIXEL_SCALE);
        if (pp.type === "ring") {
          ctx.globalAlpha = alpha * 0.4; ctx.strokeStyle = pp.color; ctx.lineWidth = 1;
          const r = Math.round(pp.size / PIXEL_SCALE * 0.8);
          if (r > 0) ctx.strokeRect(ppx - r, ppy - r, r * 2 + 1, r * 2 + 1);
        } else {
          ctx.globalAlpha = alpha; ctx.fillStyle = pp.color;
          const sz = Math.max(1, Math.round(pp.size / PIXEL_SCALE * alpha));
          ctx.fillRect(ppx, ppy, sz, sz);
        }
      }
      ctx.globalAlpha = 1;

      // Wave announce
      if (waveAnnounceRef.current.timer > 0) {
        const a = Math.min(1, waveAnnounceRef.current.timer / 500);
        ctx.globalAlpha = a;
        ctx.fillStyle = waveRef.current === 8 ? "#ef4444" : "#e2e8f0";
        ctx.font = `bold ${Math.max(6, Math.round(28 / PIXEL_SCALE * 1.5))}px monospace`;
        ctx.textAlign = "center";
        ctx.shadowColor = waveRef.current === 8 ? "#ef4444" : "#fbbf24"; ctx.shadowBlur = 2;
        ctx.fillText(waveAnnounceRef.current.text, PW / 2, Math.floor(PH / 2) - 12);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // HUD on canvas
      ctx.font = `bold ${Math.max(4, Math.round(10 / PIXEL_SCALE * 1.5))}px monospace`;
      ctx.fillStyle = "rgba(10,5,2,0.8)"; ctx.fillRect(0, 0, PW, 7); ctx.fillRect(PW - 24, 0, 24, 7);
      ctx.fillStyle = "#fbbf24"; ctx.textAlign = "left";
      ctx.fillText(`W${waveRef.current}/${WAVES}`, 1, 6);
      ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "right"; ctx.fillText(`${scoreRef.current}`, PW - 1, 6);
      ctx.textAlign = "left";

      // Update React state for HUD overlay
      setDisplayWave(waveRef.current);
      setDisplayScore(scoreRef.current);
      setDisplayGold(goldRef.current);
      setDisplayBaseHP(Math.max(0, baseHPRef.current));
      setMaxBaseHP(20);

      if (runningRef.current) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { runningRef.current = false; cancelAnimationFrame(raf); };
  }, [started]);

  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-3">⚔️</div>
          <h1 className="text-5xl font-bold text-orange-500 mb-2 tracking-wider">AGENT DEFENSE</h1>
          <p className="text-stone-600 mb-8 text-sm">The Scarred Front — Hold the line.</p>
          <div className="flex flex-col items-center gap-3">
            {[1, 2, 3, 4].map(n => (
              <button key={n} onClick={() => startGame(n)}
                className="px-8 py-3 bg-gradient-to-r from-amber-900/80 to-red-900/80 hover:from-amber-800 hover:to-red-800 text-amber-100 rounded-xl font-semibold transition border border-amber-700/30 w-52 shadow-lg shadow-amber-900/20">
                {n} Hero{n > 1 ? "es" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-2">{victory ? "🏆" : "💀"}</div>
          <h2 className={`text-3xl font-bold mb-1 ${victory ? "text-green-400" : "text-red-400"}`}>
            {victory ? "VICTORY!" : "BASE OVERRUN"}
          </h2>
          <p className="text-stone-500 mb-4 text-sm">Wave {displayWave} | Score: {displayScore}</p>
          <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs max-w-xs mx-auto">
            <div className="bg-stone-900/60 rounded p-2"><div className="text-yellow-400 font-mono">{displayGold}</div><div className="text-[10px] text-stone-600">Gold</div></div>
            <div className="bg-stone-900/60 rounded p-2"><div className="text-orange-400 font-mono">{displayBaseHP}/{maxBaseHP}</div><div className="text-[10px] text-stone-600">Base HP</div></div>
            <div className="bg-stone-900/60 rounded p-2"><div className="text-indigo-400 font-mono">{displayWave}/{WAVES}</div><div className="text-[10px] text-stone-600">Wave</div></div>
          </div>
          <button onClick={() => { setStarted(false); gameOver && setGameOver(false); }}
            className="px-8 py-3 bg-gradient-to-r from-amber-800 to-red-900 hover:from-amber-700 hover:to-red-800 text-amber-100 rounded-xl font-semibold transition border border-amber-700/30 shadow-lg">
            ⚔️ Fight Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex flex-col items-center justify-center py-4 gap-2">
      <div className="relative" style={{ width: GW, maxWidth: "100%" }}>
        <canvas ref={canvasRef}
          style={{ width: "100%", maxWidth: GW, imageRendering: "pixelated", borderRadius: "8px", display: "block" }}
          className="border-2 border-amber-900/40 shadow-2xl shadow-orange-950/30"
        />
        {/* HUD Overlay */}
        <div className="absolute top-2 right-2 flex gap-3 pointer-events-none">
          <div className="bg-black/60 px-2 py-1 rounded text-xs font-mono text-yellow-400">🪙 {displayGold}</div>
        </div>
        <div className="absolute bottom-2 left-2 pointer-events-none">
          <div className="bg-black/60 px-2 py-1 rounded text-xs font-mono text-red-300">
            ❤️ {displayBaseHP}/{maxBaseHP}
          </div>
        </div>
      </div>
    </div>
  );
}

// PID counter
let pidCounter = 0;
