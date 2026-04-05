// ===== Pixel Art Sprite Definitions & Drawing Functions =====
// All sprites drawn at pixel scale on the 200x125 canvas.

import type { EnemyType, DefenderType } from "@/types";

type Color = string;
type Row = Color[];
type SpriteDef = Row[];

// --- Constants defined locally to avoid circular imports ---
const GAME_W = 200;
const GAME_H = 125;

// --- Drawing primitives ---

/** Draw a single pixel */
export function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
}

/** Draw a sprite from a 2D string array with color mapping at given center x,y */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  data: string[][],
  colors: Record<string, string>,
  cx: number,
  cy: number
): void {
  const h = data.length;
  const w = data.length > 0 ? data[0].length : 0;
  const ox = cx - Math.floor(w / 2);
  const oy = cy - Math.floor(h / 2);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const c = data[row][col];
      if (c === ".") continue;
      const color = colors[c];
      if (color) px(ctx, ox + col, oy + row, color);
    }
  }
}

// --- Helper: draw a line of pixels ---
function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.floor(x1) + 0.5, Math.floor(y1) + 0.5);
  ctx.lineTo(Math.floor(x2) + 0.5, Math.floor(y2) + 0.5);
  ctx.stroke();
}

// ========== ENEMY SPRITES ==========

const scoutSprite: SpriteDef = [
  [".", ".", "1", "1", ".", "."],
  [".", "1", "2", "2", "1", "."],
  [".", "2", "3", "3", "2", "."],
  [".", ".", "4", "4", ".", "."],
];

const soldierSprite: SpriteDef = [
  [".", ".", "1", "1", ".", "."],
  [".", "1", "2", "2", "1", "."],
  [".", "2", "3", "3", "2", "."],
  ["1", ".", "4", "4", ".", "1"],
  [".", ".", "4", "4", ".", "."],
  ["", "4", ".", ".", "4", ""],
];

const tankSprite: SpriteDef = [
  [".", ".", ".", "1", "1", ".", ".", "."],
  [".", ".", "2", "2", "2", "2", ".", "."],
  [".", "2", "3", "1", "1", "3", "2", "."],
  ["4", "4", "4", "4", "4", "4", "4", "4"],
  ["4", ".", "4", "4", "4", "4", ".", "4"],
];

const bossSprite: SpriteDef = [
  [".", ".", ".", "1", "2", ".", ".", "."],
  [".", ".", "2", "2", "2", "2", ".", "."],
  [".", "2", "3", "3", "3", "3", "2", "."],
  ["1", "1", "3", "4", "4", "3", "1", "1"],
  ["5", "5", "5", "5", "5", "5", "5", "5"],
  ["5", ".", "5", ".", ".", "5", ".", "5"],
];

/**
 * Enemy color maps:
 * 1 = base body, 2 = highlight, 3 = dark detail, 4 = shadow/limb, 5 = armor
 */
function getEnemyColors(type: EnemyType): Record<string, string> {
  switch (type) {
    case "scout":
      return { "1": "#2a1a1a", "2": "#3a2a2a", "3": "#4a2020", "4": "#1a0a0a" };
    case "soldier":
      return { "1": "#2a3a1a", "2": "#3a4a2a", "3": "#4a3a2a", "4": "#3a3a1a" };
    case "tank":
      return { "1": "#2a2a2a", "2": "#3a3a3a", "3": "#4a4a3a", "4": "#5a5a4a" };
    case "boss":
      return { "1": "#3a1a1a", "2": "#4a2a2a", "3": "#5a3a2a", "4": "#6a3a3a", "5": "#3a2a1a" };
  }
}

function getEnemySprite(type: EnemyType): SpriteDef {
  switch (type) {
    case "scout":   return scoutSprite;
    case "soldier": return soldierSprite;
    case "tank":    return tankSprite;
    case "boss":    return bossSprite;
  }
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  type: EnemyType,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  hit: boolean
): void {
  drawSprite(ctx, getEnemySprite(type), getEnemyColors(type), x, y);

  if (hit) {
    ctx.fillStyle = "rgba(255, 200, 100, 0.6)";
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }

  // Mini HP bar
  if (maxHp > 1) {
    const barW = 10;
    const barH = 2;
    const ratio = Math.max(0, hp / maxHp);
    ctx.fillStyle = "#111";
    ctx.fillRect(x - barW / 2, y - 7, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? "#4a4" : ratio > 0.25 ? "#aa4" : "#a44";
    ctx.fillRect(x - barW / 2, y - 7, Math.max(1, Math.ceil(barW * ratio)), barH);
  }
}

// ========== DEFENDER SPRITES ==========

const riflemanDef: SpriteDef = [
  [".", "b", "b", "."],
  ["b", "c", "c", "b"],
  ["b", "c", "a", "b"],
  ["b", "a", "a", "b"],
  ["d", "a", "d", "d"],
  [".", "e", "e", "."],
];

const machinegunDef: SpriteDef = [
  [".", "b", "b", "."],
  ["b", "c", "c", "b"],
  ["b", "c", "a", "c"],
  ["b", "a", "a", "b"],
  ["d", "d", "a", "d"],
  [".", "e", "e", "."],
];

const mortarDef: SpriteDef = [
  [".", ".", "b", "."],
  ["b", "b", "b", "b"],
  ["b", "c", "c", "c"],
  ["b", "c", "c", "b"],
  ["b", "b", "a", "b"],
  [".", "e", "e", "."],
];

const sniperDef: SpriteDef = [
  [".", "b", "b", ".", ".", "."],
  ["b", "c", "c", "b", ".", "."],
  ["b", "c", "a", "c", "d", "d"],
  ["b", "a", "a", "b", ".", "."],
  ["d", "a", "a", "e", ".", "."],
  [".", "e", "e", ".", ".", "."],
];

const DEF_SPRITES: Record<DefenderType, SpriteDef> = {
  rifleman:  riflemanDef,
  machinegun: machinegunDef,
  mortar:    mortarDef,
  sniper:    sniperDef,
};

/** Defender color palette
 * a = gun/body, b = armor, c = helmet, d = barrel, e = boots
 */
function getDefenderColors(_type: DefenderType): Record<string, string> {
  // All defenders share green military theme for now
  return {
    a: "#336633", // body
    b: "#558855", // armor
    c: "#224422", // helmet
    d: "#888888", // barrel
    e: "#333322", // boots
  };
}

export function drawDefender(
  ctx: CanvasRenderingContext2D,
  type: DefenderType,
  x: number,
  y: number,
  range?: number
): void {
  if (range) {
    ctx.strokeStyle = "rgba(80, 255, 80, 0.2)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawSprite(ctx, DEF_SPRITES[type], getDefenderColors(type), x, y);
}

// ========== BACKGROUND ==========

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  // Dark gradient placeholder — parallax sky will be added later
  const grad = ctx.createLinearGradient(0, 0, 0, GAME_H);
  grad.addColorStop(0, "#0a0a14");
  grad.addColorStop(0.35, "#0f1020");
  grad.addColorStop(0.6, "#121a12");
  grad.addColorStop(1, "#0a100a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // Subtle ground noise
  ctx.fillStyle = "rgba(30, 60, 20, 0.12)";
  for (let y = 70; y < GAME_H; y += 3) {
    for (let x = 0; x < GAME_W; x += 3) {
      if (Math.sin(x * 3.7 + y * 2.3) > 0.4) {
        ctx.fillRect(x, y, 2, 1);
      }
    }
  }

  // Path (road) — same waypoints used by game engine
}

// ========== PATH DRAWING ==========

/** Draws the enemy path on the map. Waypoints are imported at call site. */
export function drawPath(ctx: CanvasRenderingContext2D, waypoints: { x: number; y: number }[]): void {
  // Road fill
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#3a3020";
  ctx.beginPath();
  ctx.moveTo(waypoints[0].x, waypoints[0].y);
  for (let i = 1; i < waypoints.length; i++) {
    ctx.lineTo(waypoints[i].x, waypoints[i].y);
  }
  ctx.stroke();

  // Road surface lighter
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#4a4030";
  ctx.beginPath();
  ctx.moveTo(waypoints[0].x, waypoints[0].y);
  for (let i = 1; i < waypoints.length; i++) {
    ctx.lineTo(waypoints[i].x, waypoints[i].y);
  }
  ctx.stroke();

  // Center dashed line
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = "rgba(120, 100, 70, 0.3)";
  ctx.beginPath();
  ctx.moveTo(waypoints[0].x, waypoints[0].y);
  for (let i = 1; i < waypoints.length; i++) {
    ctx.lineTo(waypoints[i].x, waypoints[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

// ========== GRID ==========

export function drawGrid(ctx: CanvasRenderingContext2D, cellW: number, cellH: number, cols: number, rows: number): void {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 0.3;
  for (let gx = 0; gx <= cols; gx++) {
    const x = gx * cellW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_H);
    ctx.stroke();
  }
  for (let gy = 0; gy <= rows; gy++) {
    const y = gy * cellH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_W, y);
    ctx.stroke();
  }
}

// ========== PROJECTILES ==========

export function drawProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, projType: string): void {
  if (projType === "mortar") {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 1, 1, 3);
  } else if (projType === "sniper") {
    ctx.fillStyle = color;
    ctx.fillRect(x - 2, y, 5, 1);
  } else {
    px(ctx, x, y, color);
  }
}

// ========== PARTICLES / EXPLOSIONS ==========

export function spawnExplosion(
  x: number,
  y: number,
  count: number
): Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }> {
  const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }> = [];
  const colors = ["#ff6600", "#ffaa00", "#ff3300", "#ffcc33", "#ff0000", "#ffff44"];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.3 + Math.random() * 1.2;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 10 + Math.random() * 15,
      maxLife: 10 + Math.random() * 15,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() > 0.5 ? 1 : 2,
    });
  }
  return particles;
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  parts: Array<{ x: number; y: number; life: number; maxLife: number; color: string; size: number }>
): void {
  for (const p of parts) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
