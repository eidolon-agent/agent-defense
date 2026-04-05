// ===== Agent Defense — Tower Defense Game Engine =====

import type {
  Defender, DefenderType, Enemy, EnemyType, GameState, Particle,
  Projectile, Wave,
} from "@/types";
import {
  DEFENDER_BLUEPRINTS, WAYPOINTS, GAME_W, buildableCols,
  GRID_COLS, GRID_ROWS, CELL_W, CELL_H,
} from "@/types";
import { spawnExplosion } from "./sprites";

// ==================== WAVE DEFINITIONS ====================

const WAVES: Wave[] = [
  { number: 1, spawners: [{ type: "scout" as EnemyType, count: 5, interval: 1200 }] },
  { number: 2, spawners: [{ type: "scout", count: 4, interval: 1000 }, { type: "soldier" as EnemyType, count: 3, interval: 1800 }] },
  { number: 3, spawners: [{ type: "scout", count: 3, interval: 800 }, { type: "soldier", count: 5, interval: 1500 }, { type: "tank" as EnemyType, count: 1, interval: 3000 }] },
  { number: 4, spawners: [{ type: "soldier", count: 6, interval: 1200 }, { type: "tank", count: 3, interval: 2500 }] },
  { number: 5, spawners: [{ type: "scout", count: 5, interval: 600 }, { type: "soldier", count: 8, interval: 1000 }, { type: "tank", count: 3, interval: 2000 }, { type: "boss" as EnemyType, count: 1, interval: 5000 }] },
];

interface EnnemyConfig {
  hp: number;
  speed: number;
  reward: number;
}

const ENEMY_CONFIGS: Record<EnemyType, EnnemyConfig> = {
  scout:   { hp: 2,  speed: 0.035, reward: 3 },
  soldier: { hp: 5,  speed: 0.025, reward: 5 },
  tank:    { hp: 15, speed: 0.015, reward: 12 },
  boss:    { hp: 50, speed: 0.01,  reward: 30 },
};

// ==================== GAME ENGINE ====================

export class GameEngine {
  state: GameState;
  private nextId = 1;
  private waveStart: number | null = null;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      money: 50,
      lives: 20,
      wave: 0,
      waveActive: false,
      waveComplete: true,
      gameOver: false,
      gameWon: false,
      selectedDefenderType: null,
      defenders: new Map(),
      enemies: new Map(),
      projectiles: new Map(),
      particles: new Map(),
      nextId: 1,
      lastTick: Date.now(),
      spawnQueue: [],
    };
  }

  allocId(): number {
    return this.nextId++;
  }

  // --- Wave management ---
  startWave(): void {
    const waveNum = this.state.wave;
    if (waveNum >= WAVES.length) {
      this.state.gameWon = true;
      this.state.gameOver = true;
      return;
    }

    this.state.waveActive = true;
    this.state.waveComplete = false;
    this.state.wave = waveNum + 1;
    this.waveStart = Date.now();

    // Build spawn queue
    const queue: { type: EnemyType; time: number }[] = [];
    let offset = 0;
    for (const spawner of WAVES[waveNum].spawners) {
      for (let i = 0; i < spawner.count; i++) {
        queue.push({ type: spawner.type, time: offset + i * spawner.interval });
        offset += 100;
      }
    }
    queue.sort((a, b) => a.time - b.time);
    this.state.spawnQueue = queue;
  }

  // --- Defender placement ---
  placeDefender(gridX: number, gridY: number, type: DefenderType): boolean {
    const key = `${gridX},${gridY}`;
    const buildable = buildableCols();
    if (!buildable.has(key)) return false;

    const blueprint = DEFENDER_BLUEPRINTS[type];
    if (!blueprint) return false;
    if (this.state.money < blueprint.cost) return false;

    for (const [, d] of this.state.defenders) {
      if (d.gridX === gridX && d.gridY === gridY) return false;
    }

    this.state.money -= blueprint.cost;
    const px = gridX * CELL_W + CELL_W / 2;
    const py = gridY * CELL_H + CELL_H / 2;

    const defender: Defender = {
      id: this.allocId(),
      gridX, gridY, x: px, y: py,
      range: blueprint.range,
      fireRate: blueprint.fireRate,
      damage: blueprint.damage,
      lastFired: 0,
      targetId: null,
      defenderType: type,
    };

    this.state.defenders.set(defender.id, defender);
    return true;
  }

  // --- Main tick ---
  tick(): void {
    if (this.state.gameOver) return;

    const now = Date.now();
    const dt = Math.min(now - this.state.lastTick, 50);
    this.state.lastTick = now;

    this.processSpawns();
    this.moveEnemies(dt);
    this.fireDefenders(now);
    this.moveProjectiles(dt);
    this.updateParticles(dt);
    this.checkWaveStatus();
  }

  private processSpawns(): void {
    if (!this.state.waveActive || this.waveStart === null) return;
    const elapsed = Date.now() - this.waveStart;

    while (
      this.state.spawnQueue.length > 0 &&
      this.state.spawnQueue[0].time <= elapsed
    ) {
      const spawn = this.state.spawnQueue.shift()!;
      this.spawnEnemy(spawn.type);
    }
  }

  private spawnEnemy(type: EnemyType): Enemy {
    const wp = WAYPOINTS[0];
    const cfg = ENEMY_CONFIGS[type];

    const enemy: Enemy = {
      id: this.allocId(),
      x: wp.x, y: wp.y,
      hp: cfg.hp, maxHp: cfg.hp,
      speed: cfg.speed,
      reward: cfg.reward,
      pathIndex: 0,
      type,
      hit: false,
      hitTimer: 0,
    };

    this.state.enemies.set(enemy.id, enemy);
    return enemy;
  }

  private moveEnemies(dt: number): void {
    for (const [id, en] of this.state.enemies) {
      if (en.pathIndex >= WAYPOINTS.length - 1) continue;

      const dest = WAYPOINTS[en.pathIndex + 1];
      const dx = dest.x - en.x;
      const dy = dest.y - en.y;
      const dist = Math.hypot(dx, dy);
      const move = en.speed * dt;

      if (dist <= move) {
        en.x = dest.x;
        en.y = dest.y;
        en.pathIndex++;

        if (en.pathIndex >= WAYPOINTS.length - 1) {
          this.state.lives -= 1;
          this.state.enemies.delete(id);
          this.spawnExplosionAt(en.x, en.y, 8);
          if (this.state.lives <= 0) {
            this.state.gameOver = true;
          }
          continue;
        }
      } else {
        en.x += (dx / dist) * move;
        en.y += (dy / dist) * move;
      }

      if (en.hit) {
        en.hitTimer -= dt;
        if (en.hitTimer <= 0) en.hit = false;
      }
    }
  }

  private fireDefenders(now: number): void {
    const projColors: Record<DefenderType, string> = {
      rifleman: "#ffdd44",
      machinegun: "#ffaa22",
      mortar: "#ff4444",
      sniper: "#44ddff",
    };

    for (const [, def] of this.state.defenders) {
      if (now - def.lastFired < def.fireRate) continue;

      let target: Enemy | null = null;
      let bestDist = Infinity;

      for (const [, en] of this.state.enemies) {
        const d = Math.hypot(en.x - def.x, en.y - def.y);
        if (d <= def.range && d < bestDist) {
          bestDist = d;
          target = en;
        }
      }

      if (target) {
        def.lastFired = now;
        def.targetId = target.id;

        const proj: Projectile = {
          id: this.allocId(),
          x: def.x, y: def.y,
          targetId: target.id,
          speed: 1.5,
          damage: def.damage,
          type: def.defenderType === "mortar" ? "mortar" :
                def.defenderType === "sniper" ? "sniper" : "bullet",
          color: projColors[def.defenderType],
        };

        this.state.projectiles.set(proj.id, proj);
      }
    }
  }

  private moveProjectiles(dt: number): void {
    for (const [pid, proj] of this.state.projectiles) {
      const target = this.state.enemies.get(proj.targetId);
      if (!target) {
        this.state.projectiles.delete(pid);
        continue;
      }

      const dx = target.x - proj.x;
      const dy = target.y - proj.y;
      const dist = Math.hypot(dx, dy);
      const move = proj.speed * dt;

      if (dist <= move + 2) {
        target.hp -= proj.damage;
        target.hit = true;
        target.hitTimer = 80;
        this.state.projectiles.delete(pid);

        if (target.hp <= 0) {
          this.state.money += target.reward;
          this.spawnExplosionAt(target.x, target.y, 6 + Math.floor(target.maxHp));
          this.state.enemies.delete(target.id);
        }
      } else {
        proj.x += (dx / dist) * move;
        proj.y += (dy / dist) * move;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const [id, p] of this.state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.002 * dt;
      p.life -= dt / 10;
    }
    for (const [id, p] of this.state.particles) {
      if (p.life <= 0) this.state.particles.delete(id);
    }
  }

  private spawnExplosionAt(x: number, y: number, count: number): void {
    const newParticles = spawnExplosion(x, y, count);
    for (const p of newParticles) {
      const id = this.allocId();
      this.state.particles.set(id, p);
    }
  }

  private checkWaveStatus(): void {
    if (!this.state.waveActive) return;
    if (this.state.spawnQueue.length === 0 && this.state.enemies.size === 0) {
      this.state.waveActive = false;
      this.state.waveComplete = true;
    }
  }

  reset(): void {
    this.state = this.createInitialState();
    this.nextId = 1;
    this.waveStart = null;
  }
}
