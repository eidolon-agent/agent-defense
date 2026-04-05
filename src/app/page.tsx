"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Constants ───

const GW = 800, GH = 500;
const PIXEL_SCALE = 4;
const PW = Math.floor(GW / PIXEL_SCALE);
const PH = Math.floor(GH / PIXEL_SCALE);
const BASE_X = GW - 40, MID_Y = GH / 2;
const AGENT_X = 140;
const WAVES = 8;

type HeroClass = "knight" | "archer" | "mage" | "rogue";
type EnemyType = "fast" | "tank" | "stealth" | "healer" | "boss" | "swarm";

// ─── Agent Retreat State ───

interface Agent {
  id: number; x: number; y: number; heroClass: HeroClass;
  hp: number; maxHp: number; damage: number; range: number;
  cooldown: number; maxCooldown: number; level: number;
  hitFlash: number; bobPhase: number;
  damageDealt: number; enemiesKilled: number; critsCount: number; critChance: number;
  upgrades: string[];
  isRetreating: boolean;      // Retreat AI flag
  retreatText: string;         // Thought bubble text
  retreatTimer: number;        // Timer for retreat thought
}

// ─── Enemy with Phase (Boss) ───

interface Enemy {
  id: number; x: number; y: number; type: EnemyType;
  hp: number; maxHp: number; speed: number; reward: number; dmgToBase: number;
  hitFlash: number; wobble: number; isStealthed?: boolean; revealed?: boolean;
  // Boss phase
  bossPhase: number;           // 0=normal, 1=rage 50%, 2=enrage 25%
  hasSummonedPhase1: boolean;
  hasSummonedPhase2: boolean;
}

interface Projectile {
  id: number; x: number; y: number; tx: number; ty: number;
  speed: number; damage: number; color: string; isCrit: boolean;
  trail: Array<{ x: number; y: number }>;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
  type?: "ring" | "text" | "spark" | "glow";
  text?: string; fontSize?: number;
}

interface PlayerAgent {
  agentId: number; heroClass: HeroClass; level: number;
  personality: string; xp: number; wins: number; losses: number;
}

// ─── Hero Stats & Colors ───

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

// ─── PID counter (FIX #8 — was missing before) ───

let pidCounter = 0;

// ══════════════════════════════════════════════════════════
// WAR BACKGROUND: "The Scarred Front"
// ══════════════════════════════════════════════════════════

function drawWarBackground(ctx: CanvasRenderingContext2D, time: number, wave: number) {
  const f = (time * 0.06) | 0;
  const pw = PW, ph = PH;
  const lanePY = Math.floor(ph / 2);
  const scroll = -(f >> 1) & 31;

  // ── LAYER 1: Sky gradient ──
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ph * 0.48);
  const nightIntensity = Math.min(1, wave / 4);
  skyGrad.addColorStop(0,   `rgba(${13 - nightIntensity * 5},${10 - nightIntensity * 3},${15 - nightIntensity * 7},1)`);
  skyGrad.addColorStop(0.3, "#1a0f0d");
  skyGrad.addColorStop(0.7, "#2a1510");
  skyGrad.addColorStop(1,   "#3d1e10");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, pw, Math.round(ph * 0.48));

  // ── LAYER 2: Distant mountains ──
  ctx.fillStyle = "#120c0a";
  const ridgeH = Math.round(ph * 0.38);
  for (let x = 0; x < pw; x++) {
    const n = Math.sin((x + scroll * 0.3) * 0.4) * 2 + Math.sin((x + scroll * 0.5) * 0.8) * 1.5 + Math.sin((x + scroll * 0.7) * 1.5) * 0.8;
    const h = Math.round(ridgeH - n - 2);
    if (h > 0 && h < Math.round(ph * 0.48)) ctx.fillRect(x, h, 1, Math.round(ph * 0.48) - h);
  }

  // ── Floating embers ──
  for (let i = 0; i < 5; i++) {
    const ex = ((f * 1.1 + i * 37) % (pw + 4)) - 2;
    const ey = (Math.sin(f * 0.025 + i * 1.7) * 0.3 + 0.2) * ph * 0.45;
    ctx.globalAlpha = 0.15 + 0.1 * Math.sin(f * 0.06 + i * 2.3);
    ctx.fillStyle = i % 3 === 0 ? "#e07020" : i % 3 === 1 ? "#c05010" : "#ff9040";
    ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
  }
  ctx.globalAlpha = 1;

  // ── LAYER 4: Ground ──
  const groundGrad = ctx.createLinearGradient(0, ph * 0.48, 0, ph);
  groundGrad.addColorStop(0, "#2d1a0d"); groundGrad.addColorStop(0.3, "#1f1409");
  groundGrad.addColorStop(0.6, "#170e06"); groundGrad.addColorStop(1.0, "#0e0904");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, Math.round(ph * 0.48) - 1, pw, ph);

  // ── Ground debris ──
  const startY = Math.round(ph * 0.48);
  for (let y = startY + 2; y < ph - 3; y += 7) {
    for (let x = 1; x < pw - 1; x += 9) {
      const h = (x * 17 + y * 31) % 13;
      if (h === 0) { ctx.fillStyle = "#3a2810"; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = "#2a1e0c"; ctx.fillRect(x + 1, y, 1, 1); }
    }
  }

  // ── Ground effects (scorch marks / craters) ──
  for (const ge of groundEffects) {
    ge.age += 0.001;
    const alpha = Math.max(0.02, 0.3 - ge.age * 0.008);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ge.type === "crater" ? "#0a0604" : "#100800";
    const s = ge.size + (ge.type === "crater" ? 0 : 1);
    ctx.fillRect(ge.x - s, ge.y - (ge.type === "crater" ? 1 : s), s * 2 + 1, ge.type === "crater" ? 3 : s * 2 + 1);
  }
  ctx.globalAlpha = 1;

  // ── The lane ──
  ctx.fillStyle = "#2b1f14";
  ctx.fillRect(0, lanePY - 4, pw, 9);
  const pathOff = -(f >> 2) & 7;
  for (let x = pathOff; x < pw; x += 8) {
    if (x < 0) continue;
    const flicker = 0.12 + 0.08 * Math.sin(time * 0.004 + x * 0.2);
    ctx.fillStyle = `rgba(180,80,30,${flicker})`;
    ctx.fillRect(x, lanePY, 2, 1);
  }

  // ── Barbed wire ──
  ctx.fillStyle = "#3a3028";
  for (let x = 0; x < pw; x += 3) {
    const topY = lanePY - 6 + Math.sin(f * 0.04 + x * 0.5) * 0.5;
    const botY = lanePY + 5 + Math.sin(f * 0.03 + x * 0.7) * 0.5;
    if (topY > 0) ctx.fillRect(x, Math.round(topY), 1, 1);
    if (botY < ph) ctx.fillRect(x, Math.round(botY), 1, 1);
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
  const ay = Math.round(a.y / PIXEL_SCALE) + Math.round(Math.sin(a.bobPhase) * 1);
  const flash = a.hitFlash > 0.3;

  // Retreat visual
  if (a.isRetreating) {
    ctx.globalAlpha = 0.4 + 0.2 * Math.sin(f * 0.2);
  }

  // Shadow
  ctx.globalAlpha *= 0.25; ctx.fillStyle = cl.light;
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

  // Level indicator
  if (a.level > 1) {
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(ax - sz, ay - sz - 2, sz * 2, 1);
  }

  // HP bar
  const hpR = a.hp / a.maxHp;
  ctx.fillStyle = "#1f2937"; ctx.fillRect(ax - sz, ay + sz + 1, sz * 2, 1);
  ctx.fillStyle = hpR > 0.5 ? "#22c55e" : hpR > 0.25 ? "#eab308" : "#ef4444";
  ctx.fillRect(ax - sz, ay + sz + 1, Math.max(1, Math.round(sz * 2 * hpR)), 1);

  // Retreat thought bubble
  if (a.isRetreating || (a.retreatTimer > 0 && a.retreatText)) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#1e293b";
    const tw = 12;
    ctx.fillRect(ax - tw / 2, ay - sz - 6, tw, 4);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `bold 2px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(a.isRetreating ? "Retreat..." : a.retreatText, ax, ay - sz - 3);
    ctx.globalAlpha = 1;
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, en: Enemy, f: number) {
  const ex = Math.round(en.x / PIXEL_SCALE), ey = Math.round(en.y / PIXEL_SCALE);
  const flash = en.hitFlash > 0.3;

  if (en.type === "boss") drawBoss(ctx, en, ex, ey, f, flash);
  else if (en.type === "tank") drawTank(ctx, en, ex, ey, flash);
  else if (en.type === "stealth") drawStealth(ctx, en, ex, ey, f, flash);
  else if (en.type === "healer") drawHealer(ctx, en, ex, ey, f, flash);
  else if (en.type === "swarm") drawSwarm(ctx, en, ex, ey, flash);
  else drawFast(ctx, en, ex, ey, flash);

  // HP bar
  if (en.maxHp > 2) {
    const hpR = en.hp / en.maxHp;
    const bw = en.type === "boss" ? 10 : 6;
    ctx.fillStyle = "#1f2937"; ctx.fillRect(ex - bw / 2, ey - (en.type === "boss" ? 7 : 5), bw, 1);
    ctx.fillStyle = en.bossPhase === 0 ? (hpR > 0.5 ? "#22c55e" : "#ef4444") : (hpR > 0.5 ? "#ef4444" : "#f97316");
    ctx.fillRect(ex - bw / 2, ey - (en.type === "boss" ? 7 : 5), Math.max(1, Math.round(bw * hpR)), 1);
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, en: Enemy, ex: number, ey: number, f: number, flash: boolean) {
  const auraColor = en.bossPhase === 0 ? "#fbbf24" : en.bossPhase === 1 ? "#ff4500" : "#ff0000";

  // Boss aura particles
  if (Math.random() < 0.15 + en.bossPhase * 0.1) {
    const angle = Math.random() * Math.PI * 2;
    const r = 7 + Math.random() * 3;
    // We'll add these to particles in the main loop instead
  }

  ctx.fillStyle = flash ? "#fff" : "#5a1a10"; ctx.fillRect(ex - 5, ey - 4, 11, 9);
  ctx.fillStyle = flash ? "#fff" : (en.bossPhase === 2 ? "#ff2222" : en.bossPhase === 1 ? "#e03020" : "#c43020");
  ctx.fillRect(ex - 4, ey - 5, 9, 1);
  ctx.fillStyle = flash ? "#fff" : "#3a0a05"; ctx.fillRect(ex - 5, ey + 5, 11, 1);
  ctx.fillStyle = flash ? "#fff" : "#fecaca"; ctx.fillRect(ex - 3, ey - 2, 3, 2); ctx.fillRect(ex + 2, ey - 2, 3, 2);

  // Crown / horns
  ctx.fillStyle = auraColor;
  ctx.fillRect(ex - 5, ey - 6, 1, 2); ctx.fillRect(ex, ey - 6, 1, 2); ctx.fillRect(ex + 5, ey - 6, 1, 2);

  // Phase glow
  if (en.bossPhase >= 1) {
    ctx.globalAlpha = 0.2 + 0.1 * Math.sin(f * 0.3);
    ctx.fillStyle = auraColor;
    ctx.fillRect(ex - 6, ey - 5, 1, 1); ctx.fillRect(ex + 6, ey - 5, 1, 1);
    ctx.globalAlpha = 1;
  }
}

function drawTank(ctx: CanvasRenderingContext2D, en: Enemy, ex: number, ey: number, flash: boolean) {
  ctx.fillStyle = flash ? "#fff" : "#3a2a20"; ctx.fillRect(ex - 3, ey - 2, 7, 5);
  ctx.fillStyle = flash ? "#fff" : "#7a4a30"; ctx.fillRect(ex - 2, ey - 3, 5, 1);
  ctx.fillStyle = flash ? "#fff" : "#2a1a10"; ctx.fillRect(ex - 3, ey + 3, 7, 1);
  ctx.fillStyle = flash ? "#fff" : "#c0a080"; ctx.fillRect(ex - 2, ey - 1, 2, 1); ctx.fillRect(ex + 1, ey - 1, 2, 1);
}

function drawStealth(ctx: CanvasRenderingContext2D, en: Enemy, ex: number, ey: number, f: number, flash: boolean) {
  if (en.revealed) {
    ctx.fillStyle = flash ? "#fff" : "#4a1a6a"; ctx.fillRect(ex - 2, ey - 2, 5, 5);
    ctx.fillStyle = "#e9d5ff"; ctx.fillRect(ex - 1, ey - 1, 1, 1); ctx.fillRect(ex + 1, ey - 1, 1, 1);
    // Reveal shimmer
    ctx.globalAlpha = 0.3; ctx.fillStyle = "#a855f7";
    ctx.fillRect(ex - 3, ey - 3, 7, 7);
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 0.06 + 0.04 * Math.sin(f * 0.4);
    ctx.fillStyle = "#a855f7";
    ctx.fillRect(ex, ey - 1, 1, 1); ctx.fillRect(ex - 1, ey, 3, 1); ctx.fillRect(ex, ey + 1, 1, 1);
    ctx.globalAlpha = 1;
  }
}

function drawHealer(ctx: CanvasRenderingContext2D, en: Enemy, ex: number, ey: number, f: number, flash: boolean) {
  ctx.fillStyle = flash ? "#fff" : "#1a4a20"; ctx.fillRect(ex - 2, ey - 2, 5, 5);
  // Cross symbol
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(ex, ey - 1, 1, 3); ctx.fillRect(ex - 1, ey, 3, 1);
  // Heal pulse
  if (f % 20 < 10) {
    ctx.globalAlpha = 0.15; ctx.fillStyle = "#22c55e";
    ctx.fillRect(ex - 3, ey - 3, 1, 1); ctx.fillRect(ex + 3, ey - 3, 1, 1);
    ctx.fillRect(ex - 3, ey + 3, 1, 1); ctx.fillRect(ex + 3, ey + 3, 1, 1);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = flash ? "#fff" : "#bbf7d0"; ctx.fillRect(ex - 1, ey - 1, 1, 1); ctx.fillRect(ex + 1, ey - 1, 1, 1);
}

function drawSwarm(ctx: CanvasRenderingContext2D, en: Enemy, ex: number, ey: number, flash: boolean) {
  ctx.fillStyle = flash ? "#fff" : "#5a3a08"; ctx.fillRect(ex - 1, ey - 1, 3, 3);
  ctx.fillStyle = flash ? "#fff" : "#a16207"; ctx.fillRect(ex, ey, 1, 1);
}

function drawFast(ctx: CanvasRenderingContext2D, en: Enemy, ex: number, ey: number, flash: boolean) {
  ctx.fillStyle = flash ? "#fff" : "#7a4a10";
  ctx.fillRect(ex, ey - 2, 1, 1); ctx.fillRect(ex - 1, ey - 1, 3, 1); ctx.fillRect(ex - 2, ey, 5, 1);
  ctx.fillRect(ex - 1, ey + 1, 3, 1); ctx.fillRect(ex, ey + 2, 1, 1);
  ctx.fillStyle = flash ? "#fff" : "#fef3c7"; ctx.fillRect(ex - 1, ey, 1, 1);
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
// SHOP SYSTEM ITEMS
// ══════════════════════════════════════════════════════════

type ShopItemType = "global_damage" | "global_hp" | "global_range" | "global_crit" | "heal_all" | "repair_base";

interface ShopItemDef {
  id: string;
  icon: string;
  label: string;
  desc: string;
  cost: number;
  maxBuys: number;
}

const SHOP_ITEMS: ShopItemDef[] = [
  { id: "global_damage", icon: "⚔️", label: "+15% Damage", desc: "All heroes deal +15% damage", cost: 50, maxBuys: 3 },
  { id: "global_hp", icon: "❤️", label: "+20% Max HP", desc: "All heroes gain +20% max HP", cost: 45, maxBuys: 3 },
  { id: "global_range", icon: "🎯", label: "+15% Range", desc: "All heroes gain +15% range", cost: 35, maxBuys: 3 },
  { id: "global_crit", icon: "💥", label: "+10% Crit", desc: "All heroes gain +10% crit chance", cost: 40, maxBuys: 3 },
  { id: "heal_all", icon: "💚", label: "Full Heal", desc: "Restore all heroes to max HP", cost: 25, maxBuys: 99 },
  { id: "repair_base", icon: "🏰", label: "Repair Base (+3)", desc: "Restore base HP by 3 points", cost: 30, maxBuys: 99 },
];

// ══════════════════════════════════════════════════════════
// GAME PAGE COMPONENT
// ══════════════════════════════════════════════════════════

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopItems, setShopItems] = useState<Record<string, number>>({});
  const [selectedShopHero, setSelectedShopHero] = useState<number | null>(null);
  const [displayWave, setDisplayWave] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayGold, setDisplayGold] = useState(50);
  const [displayBaseHP, setDisplayBaseHP] = useState(20);
  const [maxBaseHP, setMaxBaseHP] = useState(20);

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
  const waveAnnounceRef = useRef({ timer: 0, text: "", preview: "" });
  const runningRef = useRef(false);
  // ── UI/UX: Screen shake, combos, audio ──
  const shakeRef = useRef(0);
  const comboRef = useRef(0);
  const comboTimerRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const shopOpen = betweenWavesRef.current && enemiesRef.current.length === 0 && waveRef.current > 0;

  // ── Sound synthesis (Web Audio API, no external files) ──
  const playSound = useCallback((type: "hit" | "kill" | "boss" | "shop" | "wave") => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      if (type === "hit") { osc.frequency.value = 220; osc.type = "square"; gain.gain.setValueAtTime(0.06, ctx.currentTime); }
      if (type === "kill") { osc.frequency.value = 440; osc.type = "triangle"; gain.gain.setValueAtTime(0.08, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); }
      if (type === "boss") { osc.frequency.value = 80; osc.type = "sawtooth"; gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.4); }
      if (type === "shop") { osc.frequency.value = 600; osc.type = "sine"; gain.gain.setValueAtTime(0.05, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); }
      if (type === "wave") { osc.frequency.value = 300; osc.type = "sine"; gain.gain.setValueAtTime(0.07, ctx.currentTime); osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.15); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); }
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  const initGame = useCallback((numPlayers: number) => {
    agentsRef.current = [];
    enemiesRef.current = [];
    projsRef.current = [];
    particlesRef.current = [];
    groundEffects.length = 0;
    pidCounter = 0;
    gameTimeRef.current = 0;
    waveRef.current = 0;
    goldRef.current = 50;
    scoreRef.current = 0;
    baseHPRef.current = 20;
    waveTimerRef.current = 2000;
    spawnQueueRef.current = [];
    spawnTimerRef.current = 0;
    betweenWavesRef.current = false;
    waveAnnounceRef.current = { timer: 0, text: "", preview: "" };
    shakeRef.current = 0;
    comboRef.current = 0;
    comboTimerRef.current = 0;
    setShowShop(false);
    setShopItems({});
    setSelectedShopHero(null);

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
        isRetreating: false, retreatText: "", retreatTimer: 0,
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

  // ── Apply shop item effect ──

  const applyShopItem = useCallback((itemId: string) => {
    const def = SHOP_ITEMS.find(s => s.id === itemId);
    if (!def) return;
    const currentBought = shopItems[itemId] || 0;
    if (currentBought >= def.maxBuys) return;
    if (goldRef.current < def.cost) return;

    goldRef.current -= def.cost;
    setShopItems(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));

    switch (itemId) {
      case "global_damage":
        for (const a of agentsRef.current) { a.damage = Math.ceil(a.damage * 1.15); }
        break;
      case "global_hp":
        for (const a of agentsRef.current) {
          a.maxHp = Math.round(a.maxHp * 1.20);
          a.hp = Math.min(a.maxHp, a.hp + 3);
        }
        break;
      case "global_range":
        for (const a of agentsRef.current) { a.range = Math.round(a.range * 1.15); }
        break;
      case "global_crit":
        for (const a of agentsRef.current) { a.critChance = Math.min(0.5, a.critChance + 0.10); }
        break;
      case "heal_all":
        for (const a of agentsRef.current) {
          a.hp = a.maxHp;
          a.isRetreating = false;
          a.retreatText = "";
          a.retreatTimer = 0;
        }
        break;
      case "repair_base":
        baseHPRef.current = Math.min(20, baseHPRef.current + 3);
        break;
    }

    waveAnnounceRef.current = { timer: 1000, text: `${def.icon} ${def.label}!`, preview: "" };
    setDisplayGold(goldRef.current);
    playSound("shop");
  }, [shopItems]);

  // ── Hero upgrade (individual) ──

  const upgradeHero = useCallback((heroId: number, stat: string) => {
    const hero = agentsRef.current.find(a => a.id === heroId);
    if (!hero) return;

    const costs: Record<string, number> = { damage: 20 + hero.level * 10, hp: 15 + hero.level * 10, range: 12 + hero.level * 8, crit: 25 + hero.level * 10 };
    const cost = costs[stat];
    if (!cost || goldRef.current < cost) return;

    goldRef.current -= cost;
    hero.level++;

    switch (stat) {
      case "damage": hero.damage = Math.ceil(hero.damage * 1.25); hero.upgrades.push("dmg_up"); break;
      case "hp": hero.maxHp = Math.round(hero.maxHp * 1.2); hero.hp = Math.min(hero.maxHp, hero.hp + 2); hero.upgrades.push("hp_up"); break;
      case "range": hero.range = Math.round(hero.range * 1.2); hero.upgrades.push("rng_up"); break;
      case "crit": hero.critChance = Math.min(0.6, hero.critChance + 0.08); hero.upgrades.push("crit_up"); break;
    }

    setDisplayGold(goldRef.current);
    waveAnnounceRef.current = { timer: 800, text: `⬆️ ${hero.heroClass} Lv${hero.level}!`, preview: "" };
    playSound("shop");
  }, []);

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

      // ── Wave management ──
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
            timer: 1500,
            text: waveRef.current === WAVES ? "⚠ FINAL WAVE ⚠" : `Wave ${waveRef.current}`,
            preview: "",
          };
          // Build wave preview
          const nextComps = waveRef.current < WAVES ? WCOMP[waveRef.current] : [];
          const counts: Record<string, number> = {};
          for (const t of nextComps) counts[t] = (counts[t] || 0) + 1;
          waveAnnounceRef.current.preview = Object.entries(counts).map(([t, c]) => `${c}x${t}`).join(', ');
          // Open shop after wave completion
          setShowShop(true);
          setDisplayGold(goldRef.current);
        }
      } else if (waveRef.current === 0) {
        waveRef.current = 1;
        spawnQueueRef.current = [...WCOMP[0]];
        spawnTimerRef.current = 0;
        waveAnnounceRef.current = { timer: 1500, text: "Wave 1", preview: "" };
      }

      // Combo timer decay & screen shake
      comboTimerRef.current = Math.max(0, comboTimerRef.current - dt);
      if (comboTimerRef.current <= 0) comboRef.current = 0;
      if (shakeRef.current > 0) shakeRef.current *= 0.9;
      if (shakeRef.current < 0.1) shakeRef.current = 0;

      // Spawn enemies
      if (spawnQueueRef.current.length > 0 && !betweenWavesRef.current) {
        spawnTimerRef.current -= dt;
        if (spawnTimerRef.current <= 0) {
          const type = spawnQueueRef.current.shift()!;
          const cfg = ECFG[type];
          // Scale HP with wave number
          const waveScale = 1 + waveRef.current * 0.15;
          enemiesRef.current.push({
            id: 100 + Math.floor(Math.random() * 1000), x: 0, y: MID_Y + (Math.random() - 0.5) * 30,
            type, hp: Math.ceil(cfg.hp * waveScale), maxHp: Math.ceil(cfg.hp * waveScale), speed: cfg.speed, reward: cfg.reward,
            dmgToBase: cfg.dmg, hitFlash: 0, wobble: 0,
            isStealthed: type === "stealth", revealed: false,
            bossPhase: 0, hasSummonedPhase1: false, hasSummonedPhase2: false,
          });
          spawnTimerRef.current = type === "swarm" ? 150 : type === "boss" ? 2000 : 400;
        }
      } else if (enemiesRef.current.length === 0 && !betweenWavesRef.current && waveRef.current > 0) {
        betweenWavesRef.current = true;
        goldRef.current += 10 + waveRef.current * 5;
        baseHPRef.current = Math.min(20, baseHPRef.current + 2);
      }

      // ─────────────────────────────────────────────────────
      // BOSS PHASE SYSTEM (Feature #1)
      // ─────────────────────────────────────────────────────

      for (const en of enemiesRef.current) {
        if (en.type !== "boss" || en.hp <= 0) continue;
        const boss = en;

        // Phase 1: Rage at 50% HP
        if (boss.bossPhase === 0 && boss.hp <= boss.maxHp * 0.5) {
          boss.bossPhase = 1;
          boss.speed *= 1.6;
          boss.dmgToBase *= 1.5;
          for (const o of enemiesRef.current) o.bossPhase = Math.max(o.bossPhase, 0);
          particlesRef.current.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, life: 300, maxLife: 300, color: "#ff4500", size: 3, type: "ring" });
          for (let i = 0; i < 20; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 0.3 + Math.random() * 1.2;
            particlesRef.current.push({ x: boss.x, y: boss.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 200, maxLife: 200, color: "#ff4500", size: 2, type: "spark" });
          }
          // Summon adds
          for (let s = 0; s < 3; s++) {
            const addType = Math.random() > 0.5 ? ("tank" as EnemyType) : ("fast" as EnemyType);
            const aCfg = ECFG[addType];
            enemiesRef.current.push({
              id: 200 + Math.floor(Math.random() * 1000), x: boss.x + (Math.random() - 0.5) * 60, y: boss.y + (Math.random() - 0.5) * 30,
              type: addType, hp: Math.ceil(aCfg.hp * 0.7), maxHp: Math.ceil(aCfg.hp * 0.7), speed: aCfg.speed, reward: Math.ceil(aCfg.reward * 0.5),
              dmgToBase: Math.ceil(aCfg.dmg * 0.5), hitFlash: 0, wobble: 0,
              isStealthed: false, revealed: false,
              bossPhase: 0, hasSummonedPhase1: true, hasSummonedPhase2: true,
                });
          }
          shakeRef.current = 10;
          playSound("boss");
          waveAnnounceRef.current = { timer: 1500, text: "🔥 BOSS IS ENRAGED!", preview: "" };
        }

        // Phase 2: Enrage at 25% HP
        if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.25) {
          boss.bossPhase = 2;
          boss.speed *= 1.3;
          boss.dmgToBase *= 1.3;
          particlesRef.current.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, life: 500, maxLife: 500, color: "#ff0000", size: 4, type: "ring" });
          for (let i = 0; i < 30; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 0.5 + Math.random() * 1.5;
            particlesRef.current.push({ x: boss.x, y: boss.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 300, maxLife: 300, color: "#ff0000", size: 2, type: "spark" });
          }
          // More summons
          for (let s = 0; s < 2; s++) {
            const addType = Math.random() > 0.5 ? ("stealth" as EnemyType) : ("swarm" as EnemyType);
            const aCfg = ECFG[addType];
            enemiesRef.current.push({
              id: 300 + Math.floor(Math.random() * 1000), x: boss.x + (Math.random() - 0.5) * 80, y: boss.y + (Math.random() - 0.5) * 40,
              type: addType, hp: Math.ceil(aCfg.hp * 0.6), maxHp: Math.ceil(aCfg.hp * 0.6), speed: aCfg.speed, reward: Math.ceil(aCfg.reward * 0.4),
              dmgToBase: Math.ceil(aCfg.dmg * 0.5), hitFlash: 0, wobble: 0,
              isStealthed: addType === "stealth", revealed: false,
              bossPhase: 0, hasSummonedPhase1: true, hasSummonedPhase2: true,
            });
          }
          shakeRef.current = 14;
          playSound("boss");
          waveAnnounceRef.current = { timer: 2000, text: "💀 BOSS ENRAGE—MAX POWER!", preview: "" };
        }
      }

      // ─────────────────────────────────────────────────────
      // HEALER ENEMY AI (Feature #4)
      // ─────────────────────────────────────────────────────

      for (const en of enemiesRef.current) {
        if (en.type !== "healer" || en.hp <= 0 || en.isStealthed || en.x < AGENT_X) continue;
        // Find nearest damaged enemy to heal
        let toHeal: Enemy | null = null;
        let healDist = 60;
        for (const o of enemiesRef.current) {
          if (o.hp <= 0 || o.hp >= o.maxHp || o === en || o.isStealthed) continue;
          const dist = Math.hypot(o.x - en.x, o.y - en.y);
          if (dist < healDist) { healDist = dist; toHeal = o; }
        }
        if (toHeal) {
          toHeal.hp = Math.min(toHeal.maxHp, toHeal.hp + 0.08 * (dt / 16));
          // Green heal particle
          if (Math.random() < 0.2) {
            particlesRef.current.push({
              x: toHeal.x + (Math.random() - 0.5) * 6, y: toHeal.y - 3,
              vx: 0, vy: -0.3, life: 150, maxLife: 150, color: "#22c55e", size: 1, type: "spark",
            });
          }
        }
      }

      // ── Move enemies toward base ──

      for (const en of enemiesRef.current) {
        if (en.hp <= 0) continue;
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

      // ─────────────────────────────────────────────────────
      // AGENT RETREAT AI (Feature #2)
      // ─────────────────────────────────────────────────────

      for (const a of agentsRef.current) {
        a.bobPhase += dt * 0.005;
        if (a.hitFlash > 0) a.hitFlash -= dt * 0.008;

        // Trigger retreat when HP < 25%
        if (a.hp < a.maxHp * 0.25 && !a.isRetreating) {
          a.isRetreating = true;
          a.retreatText = "Retreating...";
          a.retreatTimer = 3000;
        }

        // Retreat behavior
        if (a.isRetreating) {
          if (a.x > AGENT_X) {
            a.x -= 1.2 * (dt / 16); // Move back
            a.hp = Math.min(a.maxHp, a.hp + 0.03 * (dt / 16));
          } else {
            a.hp = Math.min(a.maxHp, a.hp + 0.1 * (dt / 16)); // Heal in place
            if (a.hp >= a.maxHp * 0.8) {
              a.isRetreating = false;
              a.retreatText = "Back to fight!";
              a.retreatTimer = 2000;
            }
          }
          continue; // Skip attack logic while retreating
        }

        // Decay retreat text timer
        if (a.retreatTimer > 0) {
          a.retreatTimer -= dt;
          if (a.retreatTimer <= 0) { a.retreatText = ""; }
        }
      }

      // ── Agent attacks ──

      for (const a of agentsRef.current) {
        if (a.isRetreating) continue; // Skip while retreating

        a.cooldown -= dt;

        if (a.cooldown <= 0) {
          // ───────────────────────────────────────────────
          // BOSS PRIORITY FIX (Feature #6)
          // Check for boss ANYWHERE first
          // ───────────────────────────────────────────────
          const bossAnywhere = enemiesRef.current.find(e => e.type === "boss" && e.hp > 0 && (!e.isStealthed || e.revealed));

          let nearest: Enemy | null = null;
          let nearDist = Infinity;

          for (const en of enemiesRef.current) {
            if (en.hp <= 0) continue;
            if (en.isStealthed && !en.revealed) continue;
            const dx = en.x - a.x, dy = en.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Boss gets priority regardless of range
            if (en === bossAnywhere) { nearest = en; nearDist = Infinity; break; }
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

      // ─────────────────────────────────────────────────────
      // AGENT MOVEMENT AI (Feature #6)
      // Move toward nearest enemy when idle and out of range
      // ─────────────────────────────────────────────────────

      for (const a of agentsRef.current) {
        if (a.isRetreating) continue;
        // Check no nearby targets but enemies exist ahead
        let hasNearTarget = false;
        let nearestFar: Enemy | null = null;
        let farDist = -Infinity;

        for (const en of enemiesRef.current) {
          if (en.hp <= 0 || (en.isStealthed && !en.revealed)) continue;
          const dx = en.x - a.x;
          if (dx < 0) continue; // Behind
          const dist = Math.sqrt(dx * dx + (en.y - a.y) ** 2);
          if (dist < a.range) { hasNearTarget = true; break; }
          if (dx > farDist) { nearestFar = en; farDist = dx; }
        }

        if (!hasNearTarget && nearestFar && farDist > 0) {
          // Advance toward target
          const desiredRange = a.range - 20;
          const distToTarget = nearestFar.x - a.x;
          if (distToTarget > desiredRange && distToTarget < 200) {
            a.x += 0.5 * (dt / 16);
            // Also adjust Y to align
            if (Math.abs(nearestFar.y - a.y) > 5) {
              a.y += Math.sign(nearestFar.y - a.y) * 0.3 * (dt / 16);
            }
          }
        }
      }

      // ── Projectiles ──

      for (const p of projsRef.current) {
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8) {
          for (const en of enemiesRef.current) {
            if (en.hp <= 0) continue;
            if (en.isStealthed && !en.revealed) continue;
            const edx = en.x - p.x, edy = en.y - p.y;
            if (Math.sqrt(edx * edx + edy * edy) < 20) {
              en.hp -= p.damage;
              en.hitFlash = 1;
              // Screen shake
              shakeRef.current = Math.min(8, shakeRef.current + (p.isCrit ? 5 : 1));
              // Floating damage number
              const dmgLabel = p.isCrit ? `CRIT ${Math.round(p.damage)}` : `${Math.round(p.damage)}`;
              particlesRef.current.push({
                x: en.x, y: en.y - 4, vx: (Math.random() - 0.5) * 0.5, vy: -0.8,
                life: 600, maxLife: 600, color: p.isCrit ? "#ffff00" : "#ffffff",
                size: p.isCrit ? 3 : 2, type: "text",
                text: dmgLabel, fontSize: p.isCrit ? 14 : 10,
              });

              // ─── Stealh Reveal on hit (Feature #5) ───
              if (en.isStealthed && !en.revealed) {
                en.revealed = true;
                for (let i = 0; i < 10; i++) {
                  const ang = Math.random() * Math.PI * 2;
                  particlesRef.current.push({
                    x: en.x, y: en.y, vx: Math.cos(ang) * 0.5, vy: Math.sin(ang) * 0.5,
                    life: 300, maxLife: 300, color: "#a855f7", size: 1, type: "spark",
                  });
                }
                waveAnnounceRef.current = { timer: 800, text: "👻 Stealth revealed!", preview: "" };
              }

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
                scoreRef.current += en.reward;
                // Combo tracking
                comboTimerRef.current = 1500;
                comboRef.current++;
                if (comboRef.current >= 3) {
                  const labels = ["", "", "", "🔥 TRIPLE KILL!", "⚡ QUAD KILL!", "💀 GODLIKE!", "👑 LEGENDARY!"];
                  const idx = Math.min(comboRef.current, 6);
                  waveAnnounceRef.current = { timer: 1200, text: labels[idx], preview: "" };
                }
                for (let i = 0; i < 6; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  particlesRef.current.push({
                    x: en.x, y: en.y,
                    vx: Math.cos(angle) * (0.5 + Math.random()),
                    vy: Math.sin(angle) * (0.5 + Math.random()),
                    life: 200 + Math.random() * 300, maxLife: 500,
                    color: en.type === "boss" ? "#ef4444" : "#fbbf24",
                    size: en.type === "boss" ? 3 : 2, type: "ring",
                  });
                }
                groundEffects.push({
                  x: en.x / PIXEL_SCALE, y: en.y / PIXEL_SCALE,
                  type: en.type === "boss" ? "crater" : "scorch", size: en.type === "boss" ? 4 : 1 + Math.floor(Math.random() * 2),
                  age: 0,
                });
                shakeRef.current = en.type === "boss" ? 12 : Math.max(shakeRef.current, 3);
                playSound("kill");
              }
              if (en.hp > 0) playSound("hit");
              break;
            }
          }
          p.trail = [];
        } else {
          p.x += (dx / dist) * p.speed * (dt / 16);
          p.y += (dy / dist) * p.speed * (dt / 16);
          if (p.trail.length > 4) p.trail.shift();
          p.trail.push({ x: p.x, y: p.y });
        }
      }
      projsRef.current = projsRef.current.filter(p => p.trail.length > 0);
      enemiesRef.current = enemiesRef.current.filter(en => en.hp > 0);

      // ── Particles ──

      for (const pp of particlesRef.current) {
        pp.x += pp.vx * (dt / 16); pp.y += pp.vy * (dt / 16);
        pp.vy += 0.02 * (dt / 16);
        pp.life -= dt;
      }
      particlesRef.current = particlesRef.current.filter(pp => pp.life > 0);

      // ── Boss ambient aura particles ──
      for (const en of enemiesRef.current) {
        if (en.type !== "boss" || en.hp <= 0) continue;
        const auraColor = en.bossPhase === 0 ? "#fbbf24" : en.bossPhase === 1 ? "#ff4500" : "#ff0000";
        if (Math.random() < 0.2 + en.bossPhase * 0.15) {
          const angle = Math.random() * Math.PI * 2;
          const r = 7 + Math.random() * 5;
          particlesRef.current.push({
            x: en.x / PIXEL_SCALE + Math.cos(angle) * r,
            y: en.y / PIXEL_SCALE + Math.sin(angle) * r,
            vx: 0, vy: -0.2, life: 80 + Math.random() * 40, maxLife: 120,
            color: auraColor, size: 1, type: "glow",
          });
        }
      }

      // ── RENDER ──

      const frame = (t * 0.06) | 0;

      // Screen shake
      ctx.save();
      if (shakeRef.current > 1) {
        const sx = (Math.random() - 0.5) * shakeRef.current;
        const sy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(sx, sy);
      }

      drawWarBackground(ctx, t, waveRef.current);
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
          const r = Math.max(1, (3 - pp.life / pp.maxLife) * pp.size);
          ctx.strokeRect(ppx - r, ppy - r, r * 2 + 1, r * 2 + 1);
        } else if (pp.type === "glow") {
          ctx.globalAlpha = alpha * 0.5; ctx.fillStyle = pp.color;
          ctx.fillRect(ppx, ppy, 1, 1);
        } else if (pp.type === "text" && pp.text) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = pp.color;
          ctx.font = `bold ${pp.fontSize || 10}px monospace`;
          ctx.textAlign = "center";
          ctx.shadowColor = pp.color;
          ctx.shadowBlur = 3;
          ctx.fillText(pp.text, ppx, ppy);
          ctx.shadowBlur = 0;
        } else {
          ctx.globalAlpha = alpha; ctx.fillStyle = pp.color;
          const sz = Math.max(1, Math.round(pp.size / PIXEL_SCALE * alpha));
          ctx.fillRect(ppx, ppy, sz, sz);
        }
      }
      ctx.globalAlpha = 1;

      // ── Floating combo counter ──
      if (comboRef.current >= 3 && comboTimerRef.current > 0) {
        const comboAlpha = Math.min(1, comboTimerRef.current / 500);
        const comboSize = 8 + Math.min(comboRef.current, 4);
        ctx.globalAlpha = comboAlpha;
        ctx.fillStyle = "#fbbf24";
        ctx.font = `bold ${comboSize}px monospace`;
        ctx.textAlign = "center";
        ctx.shadowColor = "#f97316";
        ctx.shadowBlur = 4;
        ctx.fillText(`COMBO ×${comboRef.current}`, PW / 2, PH - 10);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Restore from screen shake translation
      ctx.restore();

      // Wave announce
      if (waveAnnounceRef.current.timer > 0) {
        const a = Math.min(1, waveAnnounceRef.current.timer / 500);
        ctx.globalAlpha = a;
        ctx.fillStyle = waveRef.current === WAVES ? "#ef4444" : "#e2e8f0";
        ctx.font = `bold ${Math.max(6, Math.round(28 / PIXEL_SCALE * 1.5))}px monospace`;
        ctx.textAlign = "center";
        ctx.shadowColor = waveRef.current === WAVES ? "#ef4444" : "#fbbf24"; ctx.shadowBlur = 2;
        ctx.fillText(waveAnnounceRef.current.text, PW / 2, Math.floor(PH / 2) - 14);
        // Wave preview subtitle
        if (waveAnnounceRef.current.preview) {
          ctx.font = `${Math.max(3, Math.round(22 / PIXEL_SCALE))}px monospace`;
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(waveAnnounceRef.current.preview, PW / 2, Math.floor(PH / 2) + 2);
        }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // HUD on canvas
      ctx.font = `bold ${Math.max(4, Math.round(10 / PIXEL_SCALE * 1.5))}px monospace`;
      ctx.fillStyle = "rgba(10,5,2,0.8)"; ctx.fillRect(0, 0, PW, 7); ctx.fillRect(PW - 24, 0, 24, 7);
      ctx.fillStyle = "#fbbf24"; ctx.textAlign = "left";
      ctx.fillText(`W${waveRef.current}/${WAVES}`, 1, 6);
      ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "right"; ctx.fillText(`${scoreRef.current}`, PW - 1, 6);
      ctx.textAlign = "left";

      // Update React state
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

  // ── Hero upgrade cost helper ──
  const getUpgradeCost = (heroId: number, stat: string) => {
    const hero = agentsRef.current.find(a => a.id === heroId);
    if (!hero) return 999;
    const base: Record<string, number> = { damage: 20, hp: 15, range: 12, crit: 25 };
    return (base[stat] || 20) + hero.level * 10;
  };

  // ── Start screen ──

  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-3">⚔️</div>
          <h1 className="text-5xl font-bold text-orange-500 mb-2 tracking-wider">AGENT DEFENSE</h1>
          <p className="text-stone-600 mb-8 text-sm">The Scarred Front — Hold the line.</p>
          <Link href="/multiplayer" className="block mb-6 text-center px-6 py-2 bg-stone-800/60 hover:bg-stone-700/60 text-stone-400 hover:text-amber-400 rounded-lg font-semibold transition border border-stone-700/30 mx-auto w-52 text-sm">
            🌐 Multiplayer
          </Link>
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

  // ── Game Over screen ──

  if (gameOver || victory) {
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
          <button onClick={() => { setStarted(false); setGameOver(false); setVictory(false); }}
            className="px-8 py-3 bg-gradient-to-r from-amber-800 to-red-900 hover:from-amber-700 hover:to-red-800 text-amber-100 rounded-xl font-semibold transition border border-amber-700/30 shadow-lg">
            ⚔️ Fight Again
          </button>
        </div>
      </div>
    );
  }

  // ── Active game ──

  const gameActive = runningRef.current || started;

  if (!gameActive) {
    return null;
  }

  const selectedHeroData = selectedShopHero !== null ? agentsRef.current.find(a => a.id === selectedShopHero) : null;
  const currentShopItemsState = shopItems;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex flex-col items-center justify-center py-4 gap-2">
      <div className="relative" style={{ width: GW, maxWidth: "100%" }}>
        <canvas ref={canvasRef}
          style={{ width: "100%", maxWidth: GW, imageRendering: "pixelated", borderRadius: "8px", display: "block" }}
          className="border-2 border-amber-900/40 shadow-2xl shadow-orange-950/30"
        />

        {/* HUD Overlay */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
          <div className="flex gap-2">
            <div className="bg-black/60 px-2 py-1 rounded text-xs font-mono text-yellow-400">🪙 {displayGold}</div>
            <div className="bg-black/60 px-2 py-1 rounded text-xs font-mono text-red-300">❤️ {displayBaseHP}/{maxBaseHP}</div>
            <div className="bg-black/60 px-2 py-1 rounded text-xs font-mono text-blue-300">🌊 W{displayWave}/{WAVES}</div>
          </div>

          {/* Shop & Next Wave between waves */}
          {shopOpen && (
            <div className="pointer-events-auto flex gap-2">
              <button
                onClick={() => { playSound("shop"); setShowShop(!showShop); }}
                className="px-3 py-1 bg-amber-700/80 hover:bg-amber-600 text-amber-100 rounded text-xs font-bold animate-pulse border border-amber-500/50"
              >
                🛒 SHOP ({displayGold}g)
              </button>
              <button
                onClick={() => { playSound("wave"); betweenWavesRef.current = false; }}
                className="px-3 py-1 bg-green-700/80 hover:bg-green-600 text-green-100 rounded text-xs font-bold border border-green-500/50"
              >
                ▶ Next Wave
              </button>
            </div>
          )}
        </div>

        {/* Agent status */}
        <div className="absolute bottom-2 left-2 flex gap-1 pointer-events-none">
          {agentsRef.current.map(a => (
            <div key={a.id} className={`bg-black/60 px-1.5 py-1 rounded text-[10px] font-mono ${a.isRetreating ? "text-orange-400 animate-pulse" : "text-green-400"}`}>
              {a.heroClass.slice(0, 3).toUpperCase()} Lv{a.level} {a.damage}⚔ {Math.round(a.hp)}/{a.maxHp}❤
              {a.critChance > 0 && ` ${Math.round(a.critChance * 100)}%💥`}
              {a.isRetreating && " 🏃"}
            </div>
          ))}
        </div>
      </div>

      {/* Hero Upgrades Panel (below canvas) */}
      <div className="flex gap-2 mt-2">
        {agentsRef.current.map(a => (
          <button
            key={a.id}
            onClick={() => setSelectedShopHero(selectedShopHero === a.id ? null : a.id)}
            className={`px-3 py-1 rounded text-xs font-mono border ${
              selectedShopHero === a.id
                ? "border-amber-400 bg-amber-900/60 text-amber-200"
                : "border-stone-700 bg-stone-900/40 text-stone-400 hover:text-stone-300"
            }`}
          >
            ⬆️ {a.heroClass} Lv{a.level} ({a.upgrades.length} ups)
          </button>
        ))}
      </div>

      {/* Individual Upgrade Panel */}
      {selectedHeroData && (
        <div className="mt-2 bg-stone-900/80 border border-stone-700 rounded-lg p-3 w-fit max-w-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className={`inline-block w-3 h-3 rounded`} style={{ backgroundColor: HERO_COLORS[selectedHeroData.heroClass].body }} />
            <span className="text-sm font-bold text-amber-200">{selectedHeroData.heroClass} Lv{selectedHeroData.level}</span>
            <span className="text-xs text-stone-500">Gold: {displayGold}g</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[
              { key: "damage", label: `⚔️ ${getUpgradeCost(selectedHeroData.id, "damage")}g`, action: () => upgradeHero(selectedHeroData.id, "damage") },
              { key: "hp", label: `❤️ ${getUpgradeCost(selectedHeroData.id, "hp")}g`, action: () => upgradeHero(selectedHeroData.id, "hp") },
              { key: "range", label: `🎯 ${getUpgradeCost(selectedHeroData.id, "range")}g`, action: () => upgradeHero(selectedHeroData.id, "range") },
              { key: "crit", label: `💥 ${getUpgradeCost(selectedHeroData.id, "crit")}g`, action: () => upgradeHero(selectedHeroData.id, "crit") },
            ].map(u => (
              <button
                key={u.key}
                onClick={u.action}
                disabled={displayGold < getUpgradeCost(selectedHeroData.id, u.key)}
                className="px-2 py-1 bg-stone-800 hover:bg-stone-700 disabled:bg-stone-900 disabled:text-stone-700 text-stone-300 rounded text-xs font-mono border border-stone-600"
              >
                {u.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-stone-600 mt-1">
            Dmg:{selectedHeroData.damage} HP:{selectedHeroData.hp}/{selectedHeroData.maxHp} Rng:{selectedHeroData.range} Crit:{Math.round(selectedHeroData.critChance * 100)}%
          </div>
        </div>
      )}

      {/* ─── Shop Modal ─── */}
      {showShop && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowShop(false)}>
          <div className="bg-stone-900 border-2 border-amber-700 rounded-xl p-5 max-w-md w-full shadow-2xl shadow-amber-900/40" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-bold text-amber-400">🛒 War Shop</h3>
              <button onClick={() => setShowShop(false)} className="text-stone-500 hover:text-stone-300 text-lg">✕</button>
            </div>
            <p className="text-stone-500 text-xs mb-3">Between waves — spend gold to strengthen your forces</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {SHOP_ITEMS.map(item => {
                const bought = currentShopItemsState[item.id] || 0;
                const cantAfford = displayGold < item.cost;
                const maxed = bought >= item.maxBuys;
                return (
                  <button
                    key={item.id}
                    onClick={() => applyShopItem(item.id)}
                    disabled={cantAfford || maxed}
                    className={`p-2 rounded-lg border text-left transition ${
                      maxed
                        ? "border-green-700 bg-green-900/20 opacity-60"
                        : cantAfford
                        ? "border-stone-800 bg-stone-900/60 opacity-50"
                        : "border-amber-700/40 bg-amber-900/20 hover:bg-amber-800/30"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-xs font-bold text-amber-200 ml-1">{item.label}</span>
                    <p className="text-[10px] text-stone-500 mt-0.5">{item.desc}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`text-xs font-mono ${maxed ? "text-green-400" : cantAfford ? "text-stone-600" : "text-yellow-400"}`}>
                        {maxed ? "✅ Max" : `${item.cost}g`}
                      </span>
                      {bought > 0 && <span className="text-[10px] text-stone-600">×{bought}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setShowShop(false); }}
              className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded-lg font-bold text-sm transition"
            >
              ⚔️ Ready — Next Wave!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


