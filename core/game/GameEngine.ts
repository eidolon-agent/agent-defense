import type { GameAgent, GameEnemy, Projectile, Particle, Command, PlayerAgent, EnemyType, HeroClass, MatchResult } from "../game/types";
import { RuleBasedBrain } from "../agents/brain";
import { ABILITY_DB, WAVE_ABILITIES, ABILITY_ICONS } from "../game/ability-defs";

export const GW = 800;
export const GH = 500;
export const BASE_X = GW - 40;
export const MID_Y = GH / 2;
export const AGENT_X = 140;
export const WAVES = 8;
export const SPAWN_MS = 1600;
export const DECIDE_MS = 350;

const HERO_STATS: Record<HeroClass, { hp: number; damage: number; range: number; cooldown: number; color: string; secondaryColor: string }> = {
  knight:  { hp: 18, damage: 4,  range: 120, cooldown: 900,  color: "#3b82f6", secondaryColor: "#1e40af" },
  archer:  { hp: 10, damage: 4,  range: 220, cooldown: 500,  color: "#e11d48", secondaryColor: "#9f1239" },
  mage:    { hp: 8,  damage: 3,  range: 250, cooldown: 600,  color: "#a855f7", secondaryColor: "#7c3aed" },
  rogue:   { hp: 10, damage: 5,  range: 160, cooldown: 450,  color: "#64748b", secondaryColor: "#334155" },
};

const ECFG: Record<EnemyType, { hp: number; speed: number; reward: number; dmg: number }> = {
  fast:     { hp: 3, speed: 2.2, reward: 10, dmg: 2 },
  tank:     { hp: 8, speed: 0.8, reward: 20,  dmg: 5 },
  stealth:  { hp: 2, speed: 3.0, reward: 25,  dmg: 3 },
  healer:   { hp: 5, speed: 1.0, reward: 35,  dmg: 1 },
  swarm:    { hp: 1, speed: 2.5, reward: 2,   dmg: 1 },
  boss:     { hp: 120, speed: 0.5, reward: 100, dmg: 15 },
};

// Wave compositions
// ─────────────────────────────────────────────────────────────────────────────────────────────
// 1-2: Intro ───────────────────────────────────────────────────────────────────────────────
// 3: Mini-boss ─────────────────────────────────────────────────────────────────────────────
// 4: Swarm ─────────────────────────────────────────────────────────────────────────────────
// 5: Stealth ───────────────────────────────────────────────────────────────────────────────
// 6: Healer ────────────────────────────────────────────────────────────────────────────────
// 7: Final boss (phase 1) ──────────────────────────────────────────────────────────────────
// 8: FINAL BOSS (multi-phase) ─────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════════════
const WCOMP: EnemyType[][] = [
  ["fast","fast","fast"],                                                    // 1: Intro
  ["fast","fast","fast","tank"],                                             // 2: Intro
  ["fast","fast","tank","tank","stealth","fast"],                             // 3: Mini-boss
  ["fast","tank","swarm","swarm","swarm","swarm","swarm"],                   // 4: Swarm
  ["stealth","fast","tank","stealth","tank","healer","fast"],                 // 5: Stealth
  ["healer","tank","swarm","fast","stealth","tank","stealth","fast"],         // 6: Healer
  ["boss","fast","fast","tank","tank"],                                       // 7: Mini-boss phase
  ["boss","stealth","stealth","healer","tank","fast","fast","swarm","swarm"], // 8: FINAL BOSS
];

let aid = 0, eid = 100, pid = 1;
function resetIds() { aid=0; eid=100; pid=1; }

function mkAgent(heroClass: HeroClass, pers: PlayerAgent["personality"], npc: boolean, offset: number, upgrades: string[] = []): GameAgent {
  const s = HERO_STATS[heroClass];
  let bonusDmg = 0, bonusHp = 0, bonusRange = 0, spdMult = 1, regen = 0, crit = 0;
  for (const u of upgrades) {
    if (u === "upgrade_damage") bonusDmg += 0.25;
    if (u === "upgrade_hp") bonusHp += 0.30;
    if (u === "upgrade_speed") spdMult *= 0.80;
    if (u === "upgrade_range") bonusRange += 0.15;
    if (u === "upgrade_regen") regen += 0.001;
    if (u === "upgrade_crit") crit += 0.15;
  }

  return {
    id: aid++, x: AGENT_X + offset, y: MID_Y + (npc ? 0 : -35),
    heroClass, personality: pers,
    hp: Math.round(s.hp * (1 + bonusHp)), maxHp: Math.round(s.hp * (1 + bonusHp)),
    damage: s.damage * (1 + bonusDmg),
    attackRange: s.range * (1 + bonusRange),
    attackCooldown: 0, maxCooldown: Math.round(s.cooldown * spdMult),
    decisionCooldown: 0, targetId: null, thought: "Ready!", thoughtTimer: 2000,
    bobPhase: Math.random() * Math.PI * 2, isNPC: npc,
    turretAngle: 0, hitFlash: 0, level: 1,
    damageDealt: 0, enemiesKilled: 0, abilitiesUsed: 0, critsCount: 0,
    upgrades, regenHP: regen, critChance: crit,
    activeBuffs: {}, abilityCooldowns: {},
    shadowStepActive: false,
    poisonTargets: new Map(),
    isRetreating: false, // new flag
  };
}

function mkEnemy(type: EnemyType, waveOffset?: number): GameEnemy {
  const wo = waveOffset || 0;
  const waveScale = 1 + wo * 0.15;
  const c = ECFG[type];
  const hp = Math.ceil(c.hp * waveScale);
  return {
    id: eid++, x: GW + 20,
    y: MID_Y + (Math.random() - 0.5) * 40,
    type, hp, maxHp: hp,
    speed: c.speed,
    reward: Math.ceil(c.reward * (1 + wo * 0.2)),
    dmgToBase: c.dmg, hitFlash: 0, wobble: Math.random() * Math.PI * 2,
    isHealer: type === "healer", healCooldown: 0,
    isStealthed: type === "stealth", revealed: false,
  };
}

function mkProj(a: GameAgent, t: GameEnemy): Projectile {
  const isBuffed = a.activeBuffs["battle_cry"] || a.activeBuffs["backstab"] || a.activeBuffs["upgrade_damage"] || a.activeBuffs["snipe"];
  const hasMultishot = !!a.activeBuffs["multishot"];
  let dmg = a.damage;
  let speedMult = 1;
  let color = a.heroClass === "knight" ? "#60a5fa" : a.heroClass === "archer" ? "#fb7185" : a.heroClass === "mage" ? "#c084fc" : "#94a3b8";
  let isCrit = false;

  if (isBuffed) { dmg *= 2; speedMult = 1.4; color = "#fbbf24"; }
  if (a.activeBuffs["backstab"]) { dmg *= 3; color = "#334155"; delete a.activeBuffs["backstab"]; }
  if (a.activeBuffs["snipe"]) { dmg *= 5; color = "#ef4444"; delete a.activeBuffs["snipe"]; }
  if (!isCrit && Math.random() < a.critChance) { dmg *= 2; isCrit = true; a.critsCount++; color = "#fbbf24"; }

  return {
    id: pid++, x: a.x + 15, y: a.y, targetId: t.id,
    speed: (a.heroClass === "knight" ? 5 : 6) * speedMult,
    damage: dmg, color, trail: [], isCrit,
    isAoE: hasMultishot, aoeRadius: hasMultishot ? 60 : undefined,
  };
}

function mkParticle(x: number, y: number, color: string, count: number, opts?: {spread?: number; life?: number; size?: number; type?: string; gravity?: number}): Particle[] {
  const spread = opts?.spread || 3, life = opts?.life || 400;
  return Array.from({length: count}, () => ({
    x, y, life: life + Math.random() * 100, maxLife: life,
    vx: (Math.random() - 0.5) * spread * 2, vy: (Math.random() - 0.5) * spread * 2,
    color, size: (opts?.size || 2) + Math.random() * 2, gravity: opts?.gravity, type: opts?.type as any,
  }));
}
function mkRing(x: number, y: number, color: string): Particle {
  return { x, y, life: 300, maxLife: 300, vx: 0, vy: 0, color, size: 5, type: "ring" };
}
function mkText(x: number, y: number, text: string, color: string, fontSize = 12): Particle {
  return { x, y, life: 800, maxLife: 800, vx: (Math.random()-0.5)*1.5, vy: -1.5, color, size: 3, type: "text", text, fontSize };
}

function makeGameAgent(p: PlayerAgent, i: number): GameAgent {
  return mkAgent(p.heroClass, p.personality, false, i * 50, p.upgrades || []);
}

// ─── Shop Items ─────────────────────────────────────────────────────────────────────────────
const SHOP_ITEMS: Record<string, { icon: string; label: string; cost: number; effect: (engine: import("../game/GameEngine").Engine) => void }> = {
  "gold_damage": { icon: "⚔️", label: "Global +%15 Damage", cost: 60, effect: (eng) => {
    for (const a of eng.agents) { a.damage *= 1.15; a.upgrades.push("shop_damage"); }
    eng.particles.push(...mkParticle(MID_Y, MID_Y, "#f59e0b", 20, { spread: 5 }));
  }},
  "gold_hp": { icon: "❤️", label: "Global +%20 HP", cost: 50, effect: (eng) => {
    for (const a of eng.agents) { a.maxHp = Math.round(a.maxHp * 1.20); a.hp = Math.min(a.hp + 3, a.maxHp); a.upgrades.push("shop_hp"); }
    eng.particles.push(...mkParticle(MID_Y, MID_Y, "#22c55e", 15, { spread: 4 }));
  }},
  "gold_base_heal": { icon: "🏥", label: "Repair Base (+5)", cost: 40, effect: (eng) => {
    eng.baseHP = Math.min(eng.maxBaseHP, eng.baseHP + 5);
    eng.particles.push(...mkParticle(GW - 40, MID_Y, "#22c55e", 15, { spread: 4 }));
  }},
  "gold_speed": { icon: "⚡", label: "Global +15% Speed", cost: 70, effect: (eng) => {
    for (const a of eng.agents) { a.maxCooldown = Math.round(a.maxCooldown * 0.85); a.upgrades.push("shop_speed"); }
    eng.particles.push(...mkParticle(MID_Y, MID_Y, "#fbbf24", 15, { spread: 4 }));
  }},
  "gold_range": { icon: "📏", label: "Global +10% Range", cost: 55, effect: (eng) => {
    for (const a of eng.agents) { a.attackRange *= 1.10; a.upgrades.push("shop_range"); }
    eng.particles.push(...mkParticle(MID_Y, MID_Y, "#60a5fa", 15, { spread: 3 }));
  }},
  "gold_crit": { icon: "💥", label: "Global +10% Crit", cost: 60, effect: (eng) => {
    for (const a of eng.agents) { a.critChance += 0.10; a.upgrades.push("shop_crit"); }
    eng.particles.push(...mkParticle(MID_Y, MID_Y, "#fbbf24", 15, { spread: 5 }));
  }},
};

const SHOP_KEYS = ["gold_damage", "gold_base_heal", "gold_speed", "gold_hp", "gold_range", "gold_crit"];

export class Engine {
  agents: GameAgent[] = [];
  enemies: GameEnemy[] = [];
  projs: Projectile[] = [];
  particles: Particle[] = [];
  baseHP = 20; maxBaseHP = 20;
  wave = 0; toSpawn: GameEnemy[] = [];
  spawnTimer = 0; score = 0; enemiesKilled = 0; gold = 50; combo = 0; maxCombo = 0;
  phase: "playing"|"victory"|"defeat" = "playing";
  command: Command = "FAST";
  private brain = new RuleBasedBrain();
  private _lastComboBonus = 0;
  waveClearBonus: Record<number, boolean> = {};
  levelUpsPending: { agentId: number; choices: typeof WAVE_ABILITIES }[] = [];
  shopOpen: boolean = false;
  selectedShopItem: string | null = null;
  screenShake = { x: 0, y: 0, intensity: 0 };
  starField: { x: number; y: number; speed: number; size: number; alpha: number }[] = [];
  waveAnnounce = { text: "", timer: 0, sub: "" };
  time = 0;
  betweenWaves = false;
  betweenWaveTimer = 0;
  activeEffects: { type: string; x: number; y: number; radius: number; alpha: number; maxAlpha: number; duration: number; elapsed: number }[] = [];
  bossPhase: number = 0; // 0 = normal, 1 = rage at 50%, 2 = enrage at 25%
  summonedMinions: number = 0;

  init(players: PlayerAgent[], cmd?: Command) {
    resetIds();
    this.agents = []; this.enemies = []; this.projs = []; this.particles = [];
    this.baseHP = 20; this.maxBaseHP = 20; this.wave = 0; this.toSpawn = [];
    this.score = 0; this.enemiesKilled = 0; this.gold = 50; this.combo = 0;
    this.maxCombo = 0; this.phase = "playing"; this.command = cmd || "FAST";
    this.bossPhase = 0; this.summonedMinions = 0;
    this.levelUpsPending = []; this.waveClearBonus = {};
    this.shopOpen = false; this.selectedShopItem = null;
    this.screenShake = { x: 0, y: 0, intensity: 0 };
    this.waveAnnounce = { text: "", timer: 0, sub: "" };
    this.time = 0; this.betweenWaves = false; this.betweenWaveTimer = 0;
    this.activeEffects = [];

    this.starField = Array.from({length: 60}, () => ({
      x: Math.random() * GW, y: Math.random() * GH,
      speed: 0.1 + Math.random() * 0.3, size: 0.5 + Math.random() * 1.5,
      alpha: 0.2 + Math.random() * 0.8,
    }));

    this.agents.push(mkAgent("knight", "balanced", true, -20));
    players.forEach((p, i) => this.agents.push(makeGameAgent(p, i)));
    this.nextWave();
  }

  applyShopItem(itemId: string) {
    const item = SHOP_ITEMS[itemId];
    if (!item || (this.selectedShopItem && this.selectedShopItem !== itemId)) return; // prevent double-buy
    if (this.gold < item.cost) return;

    this.gold -= item.cost;
    this.selectedShopItem = itemId;
    item.effect(this);
    this.particles.push(...mkParticle(GW / 2, MID_Y, "#fbbf24", 15, { spread: 5 }));
    this.waveAnnounce = { text: `🛒 ${item.label}`, timer: 1500, sub: `-${item.cost}g` };
  }

  closeShop() {
    this.shopOpen = false;
    this.selectedShopItem = null;
    this.betweenWaves = false;
    this.betweenWaveTimer = 0;
    this.nextWave();
  }

  applyUpgrade(agentId: number, upgradeName: string) {
    const a = this.agents.find(x => x.id === agentId);
    if (!a) return;
    a.upgrades = [...a.upgrades, upgradeName];
    if (upgradeName === "upgrade_damage") a.damage *= 1.25;
    if (upgradeName === "upgrade_hp") { a.maxHp = Math.round(a.maxHp * 1.30); a.hp = Math.min(a.hp + Math.round(a.maxHp * 0.2), a.maxHp); }
    if (upgradeName === "upgrade_speed") a.maxCooldown = Math.round(a.maxCooldown * 0.80);
    if (upgradeName === "upgrade_range") a.attackRange *= 1.15;
    if (upgradeName === "upgrade_regen") a.regenHP += 0.001;
    if (upgradeName === "upgrade_crit") a.critChance += 0.15;
  }

  useAbility(agentId: number, abilityName: string) {
    const a = this.agents.find(x => x.id === agentId);
    if (!a) return;
    if ((a.abilityCooldowns[abilityName] || 0) > 0) return;
    a.abilitiesUsed++;
    const hc = a.heroClass;
    const ab = ABILITY_DB[hc].find(x => x.name === abilityName);
    if (!ab) return;
    a.abilityCooldowns[abilityName] = ab.cd;

    const dur = ab.duration || 5000;

    switch (abilityName) {
      case "shield_wall":
        a.activeBuffs.shield_wall = this.time + dur;
        this.particles.push(mkRing(a.x, a.y, "#3b82f6"));
        this.particles.push(...mkParticle(a.x, a.y, "#60a5fa", 8, { spread: 3 }));
        break;
      case "cleave": {
        const count = this.enemies.filter(e => !e.isStealthed || e.revealed).filter(e => Math.sqrt((e.x-a.x)**2+(e.y-a.y)**2) < 130).map(e => { e.hp -= a.damage; e.hitFlash = 1; }).length;
        this.particles.push(mkRing(a.x, a.y, "#f59e0b"));
        this.particles.push(...mkParticle(a.x, a.y, "#fbbf24", 16, { spread: 5 }));
        if (count > 0) this.particles.push(mkText(a.x, a.y - 25, `⚔️ ${count}`, "#fbbf24", 14));
        break;
      }
      case "battle_cry":
        a.activeBuffs.battle_cry = this.time + dur;
        a.damage *= 1.5;
        this.particles.push(mkRing(a.x, a.y, "#ef4444"));
        this.particles.push(...mkParticle(a.x, a.y, "#f87171", 10, { spread: 4 }));
        this.waveAnnounce = { text: "📢 BATTLE CRY!", timer: 1500, sub: "+50% damage!" };
        break;
      case "rapid_fire":
        a.activeBuffs.rapid_fire = this.time + dur;
        this.particles.push(mkRing(a.x, a.y, "#fbbf24"));
        this.particles.push(...mkParticle(a.x, a.y, "#fcd34d", 8, { spread: 3 }));
        break;
      case "snipe": {
        const targets = this.enemies.filter(e => !e.isStealthed || e.revealed).filter(e => Math.abs(e.x-a.x) <= a.attackRange);
        const highest = targets.sort((x, y) => y.maxHp - x.maxHp)[0];
        if (highest) a.activeBuffs.snipe_target = highest.id;
        this.particles.push(mkRing(a.x, a.y, "#ef4444"));
        this.particles.push(...mkParticle(a.x, a.y, "#fca5a5", 8, { spread: 4 }));
        break;
      }
      case "multishot":
        a.activeBuffs.multishot = this.time + dur;
        this.particles.push(...mkParticle(a.x, a.y, "#fb7185", 12, { spread: 3 }));
        break;
      case "fireball": {
        const cluster = this.enemies.filter(e => !e.isStealthed || e.revealed).filter(e => Math.sqrt((e.x-a.x)**2+(e.y-a.y)**2) < 150);
        for (const fb of cluster) { fb.hp -= a.damage * 3; fb.hitFlash = 1; }
        if (cluster.length > 0) {
          const mx = cluster.reduce((s, e) => s + e.x, 0) / cluster.length;
          const my = cluster.reduce((s, e) => s + e.y, 0) / cluster.length;
          this.particles.push(...mkParticle(mx, my, "#ef4444", 20, { spread: 6 }));
          this.particles.push(mkRing(mx, my, "#f97316"));
          this.particles.push(mkText(mx, my - 25, `💥 ${cluster.length}`, "#ef4444", 14));
        }
        break;
      }
      case "heal_aura":
        this.particles.push(mkRing(a.x, a.y, "#22c55e"));
        this.particles.push(...mkParticle(a.x, a.y, "#4ade80", 12, { spread: 3 }));
        for (const ag of this.agents) {
          if (Math.sqrt((ag.x-a.x)**2+(ag.y-a.y)**2) < 150) ag.hp = Math.min(ag.maxHp, ag.hp + 3);
        }
        break;
      case "frost_nova":
        for (const en of this.enemies) en.slowedUntil = this.time + dur;
        this.particles.push(mkRing(a.x, a.y, "#67e8f9"));
        this.particles.push(...mkParticle(a.x, a.y, "#a5f3fc", 16, { spread: 5 }));
        this.waveAnnounce = { text: "❄️ FROST NOVA", timer: 1500, sub: "Enemies slowed!" };
        break;
      case "backstab":
        a.activeBuffs.backstab = 999999999;
        this.particles.push(...mkParticle(a.x, a.y, "#64748b", 8, { spread: 2 }));
        break;
      case "shadow_step":
        a.shadowStepActive = true;
        this.particles.push(...mkParticle(a.x, a.y, "#475569", 6, { spread: 2 }));
        break;
      case "poison_blade":
        a.activeBuffs.poison_blade = this.time + dur;
        this.particles.push(...mkParticle(a.x, a.y, "#22c55e", 8, { spread: 2 }));
        break;
    }
  }

  private nextWave() {
    this.wave++;
    if (this.wave > WAVES) { this.phase = "victory"; return; }
    const isBoss = this.wave === WAVES;
    this.toSpawn = WCOMP[this.wave - 1].map(type => mkEnemy(type, this.wave - 1));
    this.spawnTimer = 0;
    this.waveAnnounce = { text: isBoss ? "⚠️ FINAL BOSS" : `WAVE ${this.wave}`, timer: 2500, sub: isBoss ? "All phases incoming..." : "Enemies incoming..." };
    this.gold += 5 + this.wave * 3;
    this.betweenWaves = false;
  }

  update(dt: number, now: number) {
    if (this.phase !== "playing" || this.baseHP <= 0) return;
    this.time += dt;
    const visibleEnemies = this.enemies.filter(e => !e.isStealthed || e.revealed);

    if (this.screenShake.intensity > 0) {
      this.screenShake.intensity *= 0.92;
      this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
      this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
      if (this.screenShake.intensity < 0.5) this.screenShake.intensity = 0;
    }

    if (this.waveAnnounce.timer > 0) this.waveAnnounce.timer -= dt;
    for (const ef of this.activeEffects) { ef.elapsed += dt; ef.alpha = ef.maxAlpha * (1 - ef.elapsed / ef.duration); }
    this.activeEffects = this.activeEffects.filter(ef => ef.elapsed < ef.duration);

    // ─── Agents: retreat logic ──────────────────────────────────────────────────────────
    for (const a of this.agents) {
      if (a.hp < a.maxHp * 0.25 && !a.isRetreating && !a.isNPC) {
        a.isRetreating = true;
        a.thought = "Retreating...";
        a.thoughtTimer = 3000;
      }
      if (a.isRetreating) {
        if (a.x > AGENT_X) {
          a.x -= 1.5 * (dt / 16);
          a.hp = Math.min(a.maxHp, a.hp + 0.05 * (dt / 16));
        } else {
          a.hp =  Math.min(a.maxHp, a.hp + 0.15 * (dt / 16));
          if (a.hp >= a.maxHp * 0.8) {
            a.isRetreating = false;
            a.thought = "Back to fight!"; a.thoughtTimer = 2000;
          }
        }
        a.targetId = null;
        continue;
      }

      // Update buffs + cooldowns
      for (const key of Object.keys(a.activeBuffs)) {
        if (a.activeBuffs[key] && this.time >= a.activeBuffs[key]) {
          if (key === "battle_cry") a.damage /= 1.5;
          delete a.activeBuffs[key];
        }
      }
      for (const key of Object.keys(a.abilityCooldowns)) {
        if (a.abilityCooldowns[key] > 0) a.abilityCooldowns[key] -= dt;
      }
      if (a.regenHP > 0) a.hp = Math.min(a.maxHp, a.hp + a.regenHP * dt);
      a.hitFlash = Math.max(0, a.hitFlash - dt * 5);
      a.bobPhase += dt * 0.003;
      a.decisionCooldown -= dt;

      // Decision
      if (a.decisionCooldown <= 0) {
        a.decisionCooldown = DECIDE_MS;
        const d = this.brain.decide(a, visibleEnemies, this.command);
        a.targetId = d.targetId; a.thought = d.thought; a.thoughtTimer = 1800;
      }
      if (a.thoughtTimer > 0) a.thoughtTimer -= dt;
      a.attackCooldown -= dt;

      // Attack
      if (a.attackCooldown <= 0 && a.targetId !== null) {
        let target = visibleEnemies.find(e => e.id === a.targetId);
        const snipeTargetId = a.activeBuffs.snipe_target;
        if (snipeTargetId) {
          const st = visibleEnemies.find(e => e.id === snipeTargetId);
          if (st && Math.abs(st.x - a.x) <= a.attackRange) target = st;
          if (st && a.attackCooldown <= 0) delete a.activeBuffs.snipe_target;
        }

        if (target && Math.abs(target.x - a.x) <= a.attackRange) {
          if (a.activeBuffs["multishot"]) {
            const nearby = visibleEnemies.filter(e => Math.sqrt((e.x-a.x)**2+(e.y-a.y)**2) < a.attackRange).slice(0, 3);
            for (const tg of nearby) this.projs.push(mkProj(a, tg));
          } else {
            this.projs.push(mkProj(a, target));
          }
          if (a.activeBuffs["poison_blade"]) {
            this.particles.push(...mkParticle(target.x, target.y, "#22c55e", 3, { spread: 1 }));
            a.poisonTargets.set(target.id, { end: this.time + 4000, dps: a.damage * 0.5 });
          }
          a.attackCooldown = a.maxCooldown;
          a.turretAngle = Math.atan2(target.y - a.y, target.x - a.x);
        } else { a.targetId = null; a.turretAngle *= 0.9; }
      }

      // ── Agent movement: advance toward nearest enemy when idle ──
      if (a.targetId === null && visibleEnemies.length > 0) {
        const nearest = visibleEnemies.reduce((best, e) => {
          const d = e.x - a.x;
          return d > best.d && d > 0 ? { ref: e, d } : best;
        }, { ref: null as GameEnemy | null, d: -Infinity });
        if (nearest.ref) {
          const distToNearest = nearest.ref.x - a.x;
          const desiredRange = a.attackRange - 30;
          if (distToNearest > desiredRange) {
            a.x += 0.8 * (dt / 16);
            a.turretAngle = 0;
          }
        }
      }
      if (visibleEnemies.length === 0 && a.x > AGENT_X + 100) {
        a.x -= 0.5 * (dt / 16);
      }
      a.x = Math.max(AGENT_X - 20, Math.min(BASE_X - 60, a.x));
    }

    // ─── Enemy: healer logic ───────────────────────────────────────────────────────────
    for (const h of this.enemies) {
      if (h.isHealer) {
        h.healCooldown = (h.healCooldown || 0) - dt;
        if (h.healCooldown <= 0) {
          h.healCooldown = 2000;
          for (const other of this.enemies) {
            if (other.id === h.id) continue;
            if (Math.sqrt((other.x-h.x)**2+(other.y-h.y)**2) < 80 && other.hp < other.maxHp) {
              other.hp = Math.min(other.maxHp, other.hp + 1);
              this.particles.push(...mkParticle(other.x, other.y, "#22c55e", 3, { spread: 1, life: 300 }));
            }
          }
        }
      }
    }

    // ─── Boss phase management ─────────────────────────────────────────────────────────
    const boss = this.enemies.find(e => e.type === "boss" && e.hp > 0);
    if (boss && this.bossPhase === 0 && boss.hp <= boss.maxHp * 0.5) {
      // ───┤ Phase 1: RAGE MODE (50% HP) ┠─────────────────────────────────────────────────
      this.bossPhase = 1;
      boss.speed *= 1.6; // faster
      boss.damage *= 1.5; // more damage
      boss.hitFlash = 1;
      this.screenShake.intensity = 20;
      this.waveAnnounce = { text: "🔥 BOSS IS ENRAGED!", timer: 2500, sub: "Speed + Damage increased!" };
      this.particles.push(mkRing(boss.x, boss.y, "#ef4444"));
      this.particles.push(...mkParticle(boss.x, boss.y, "#ff4500", 25, { spread: 6 }));

      // Summon 3 adds
      for (let i = 0; i < 3; i++) {
        const add = mkEnemy(Math.random() > 0.5 ? "tank" : "fast", this.wave - 1);
        add.x = boss.x + (Math.random() - 0.5) * 60;
        add.y = boss.y + (Math.random() - 0.5) * 30;
        this.enemies.push(add);
        this.particles.push(mkRing(add.x, add.y, "#dc2626"));
      }
      this.summonedMinions += 3;
    }
    if (boss && this.bossPhase === 1 && boss.hp <= boss.maxHp * 0.25) {
      // ───┤ Phase 2: ENRAGED (25% HP) ┠──────────────────────────────────────────────────
      this.bossPhase = 2;
      boss.speed *= 1.4; // even faster
      boss.damage *= 1.5; // even more damage
      boss.hitFlash = 1;
      this.screenShake.intensity = 30;
      this.waveAnnounce = { text: "☠️ BOSS IS DESPERATE!", timer: 2500, sub: "Max speed, max damage!" };
      this.particles.push(mkRing(boss.x, boss.y, "#dc2626"));
      this.particles.push(mkRing(boss.x, boss.y, "#ef4444"));
      this.particles.push(...mkParticle(boss.x, boss.y, "#ff0000", 30, { spread: 8 }));

      for (let i = 0; i < 5; i++) {
        const add = mkEnemy(Math.random() > 0.5 ? "tank" : "stealth", this.wave - 1);
        add.x = boss.x + (Math.random() - 0.5) * 80;
        add.y = boss.y + (Math.random() - 0.5) * 40;
        this.enemies.push(add);
        this.particles.push(mkRing(add.x, add.y, "#dc2626"));
      }
      this.summonedMinions += 5;
    }

    // ─── Enemy movement ───────────────────────────────────────────────────────────────
    for (const en of this.enemies) {
      en.wobble += dt * 0.005;
      en.hitFlash = Math.max(0, en.hitFlash - dt * 5);
      const slowFactor = en.slowedUntil && this.time < en.slowedUntil ? 0.5 : 1;
      en.y = MID_Y + Math.sin(en.wobble) * 6;
      en.x -= en.speed * slowFactor * (dt / 16);

      if (en.isStealthed && !en.revealed) {
        const closest = this.agents.reduce((best, a) => {
          const d = Math.sqrt((a.x-en.x)**2+(a.y-en.y)**2);
          return d < best.dist ? { dist: d } : best;
        }, { dist: Infinity });
        if (closest.dist < 150) {
          en.revealed = true;
          this.particles.push(...mkParticle(en.x, en.y, "#a855f7", 6, { spread: 2, life: 400 }));
        }
      }

      if (en.x <= BASE_X - 15) {
        this.baseHP -= en.dmgToBase; this.screenShake.intensity = 8; this.combo = 0;
        this.particles.push(...mkParticle(en.x, en.y, "#f59e0b", 12, { spread: 5 }));
        this.particles.push(mkRing(en.x, en.y, "#f97316"));
        this.particles.push(mkText(en.x, en.y - 15, `-${en.dmgToBase}`, "#ef4444", 13));
        this.enemies = this.enemies.filter(x => x.id !== en.id);
        if (this.baseHP <= 0) this.phase = "defeat";
        continue;
      }

      if (en.hp <= 0) {
        this.score += en.reward; this.enemiesKilled++; this.combo++; this.gold += en.reward;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        const isBoss = en.type === "boss", isTank = en.type === "tank";
        this.particles.push(...mkParticle(en.x, en.y, isBoss ? "#fbbf24" : isTank ? "#f87171" : "#67e8f9", isBoss ? 30 : isTank ? 15 : 8, { spread: isBoss ? 6 : 4 }));
        this.particles.push(mkRing(en.x, en.y, isBoss ? "#f59e0b" : "#22d3ee"));
        this.particles.push(mkText(en.x, en.y - 20, `+${en.reward}`, "#fbbf24", isBoss ? 16 : 13));
        this.screenShake.intensity = isBoss ? 15 : isTank ? 5 : 3;
        if (this.combo >= 5 && this.combo % 5 === 0 && this.combo !== this._lastComboBonus) {
          this._lastComboBonus = this.combo; this.gold += 20;
          this.particles.push(mkText(en.x, en.y - 35, `🔥 ${this.combo}x`, "#ef4444", 11));
        }
        this.enemies = this.enemies.filter(x => x.id !== en.id);
      }
    }

    // ─── Projectiles ──────────────────────────────────────────────────────────────────
    for (const p of [...this.projs]) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 8) p.trail.shift();
      const t = visibleEnemies.find(e => e.id === p.targetId);
      if (!t) { this.projs = this.projs.filter(x => x.id !== p.id); continue; }
      const dx = t.x - p.x, dy = t.y - p.y, dist = Math.sqrt(dx*dx+dy*dy);
      if (dist < 8) {
        t.hp -= p.damage; t.hitFlash = 1;
        if (t.isStealthed && !t.revealed) { t.revealed = true; this.particles.push(...mkParticle(t.x, t.y, "#a855f7", 6, { spread: 2 })); }
        this.particles.push(p.isCrit ? mkText(t.x, t.y-10, `💥${p.damage|0}`, "#fbbf24", 14) : mkText(t.x, t.y-10, `-${p.damage|0}`, p.color, 11));
        if (p.isAoE && p.aoeRadius) {
          for (const nearby of this.enemies) {
            if (nearby.id === t.id) continue;
            if (Math.sqrt((nearby.x-p.x)**2+(nearby.y-p.y)**2) < p.aoeRadius) {
              nearby.hp -= p.damage * 0.5; nearby.hitFlash = 0.5;
              this.particles.push(...mkParticle(nearby.x, nearby.y, "#fb7185", 3, { spread: 2 }));
            }
          }
        }
        this.particles.push(...mkParticle(t.x, t.y, p.color, 4, { spread: 2, life: 250, size: 1.5 }));
        this.projs = this.projs.filter(x => x.id !== p.id);
      } else {
        p.x += (dx/dist)*p.speed*(dt/16); p.y += (dy/dist)*p.speed*(dt/16);
      }
    }

    // ─── Particles ────────────────────────────────────────────────────────────────────
    for (const pp of this.particles) { pp.x += pp.vx||0; pp.y += pp.vy||0; pp.life -= dt; if (pp.type === "ring") pp.size += 3*(dt/16); }
    this.particles = this.particles.filter(pp => pp.life > 0);

    // ─── Starfield ────────────────────────────────────────────────────────────────────
    for (const s of this.starField) { s.x -= s.speed*(dt/16); if (s.x < -2) { s.x = GW+2; s.y = Math.random()*GH; } }

    // ─── Boss aura ─────────────────────────────────────────────────────────────────────
    if (boss && boss.hp > 0) {
      const auraColor = this.bossPhase === 0 ? "#fbbf24" : this.bossPhase === 1 ? "#ff4500" : "#ff0000";
      if (Math.random() < 0.15) {
        const angle = Math.random() * Math.PI * 2;
        const r = 25 + Math.random() * 15;
        this.particles.push({
          x: boss.x + Math.cos(angle) * r, y: boss.y + Math.sin(angle) * r,
          life: 200, maxLife: 200, vx: 0, vy: 0, color: auraColor, size: 2, type: "glow",
        });
      }
    }

    // ─── Wave complete ───────────────────────────────────────────────────────────────
    if (this.toSpawn.length === 0 && this.enemies.length === 0 && this.phase === "playing") {
      if (this.wave < WAVES) {
        this.betweenWaves = true; this.betweenWaveTimer = 3000;
        this.shopOpen = true; this.selectedShopItem = null;
        this.gold += 15 + this.wave * 5;
        this.bossPhase = 0; this.summonedMinions = 0;
        this.waveAnnounce = { text: `Wave ${this.wave} Cleared!`, timer: 1500, sub: "Open shop or continue" };
        this.waveClearBonus[this.wave] = true;
        for (const a of this.agents) a.hp = Math.min(a.maxHp, a.hp + 3);
        this.baseHP = Math.min(this.maxBaseHP, this.baseHP + 2);
      } else { this.phase = "victory"; }
    }

    if (this.betweenWaves) { this.betweenWaveTimer -= dt; if (this.betweenWaveTimer <= 0) { this.closeShop(); } }
  }
}

function getRandomChoices(count: number) {
  return [...WAVE_ABILITIES].sort(() => Math.random() - 0.5).slice(0, count);
}

export function getAgentAbilities(heroClass: HeroClass) {
  return ABILITY_DB[heroClass] || [];
}

export function getShopItems() {
  return SHOP_ITEMS;
}

export function getShopKeys() {
  return SHOP_KEYS;
}
