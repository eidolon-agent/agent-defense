// Pixel art sprites — all procedurally generated
// Each sprite is drawn on a small offscreen canvas, then scaled up with nearest-neighbor

const SPRITE_SCALE = 3;

// Color palette
const C = {
  // Background
  sky1: "#0f0b2e", sky2: "#1a1040", sky3: "#231657",
  ground: "#1a1a2e", groundDark: "#121220", groundLight: "#252545", groundAccent: "#2d2d50",
  // Defender
  defBody: "#3b82f6", defDark: "#1e40af", defLight: "#60a5fa", defGlow: "#93c5fd", defEye: "#bfdbfe",
  // Sniper
  snpBody: "#e11d48", snpDark: "#9f1239", snpLight: "#fb7185", snpGlow: "#fecdd3", snpEye: "#ffe4e6",
  // Tank enemy
  tankBody: "#7f1d1d", tankDark: "#450a0a", tankLight: "#dc2626", tankEye: "#fca5a5",
  // Fast enemy
  fastBody: "#b45309", fastDark: "#78350f", fastLight: "#f59e0b", fastEye: "#fef3c7",
  // Base
  baseBody: "#1e3a5f", baseDark: "#0f1d30", baseLight: "#3b82f6", baseTop: "#2563eb", baseAccent: "#60a5fa", baseWindow: "#93c5fd",
  // Effects
  fire: "#ef4444", fireLight: "#fbbf24", star: "#e0e0ff", hitFlash: "#ffffff",
  explosion: "#ff6b35", expLight: "#ffdb4d", trail: "#60a5fa", trailSniper: "#fb7185",
  grassDark: "#143d24", grass: "#1a4731", grassLight: "#22603d",
  path: "#3d3557", pathDark: "#2d2345",
};

/** Draw a pixel at grid (x,y) with pixel size 1 on the given context */
function p(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Create a sprite canvas from a draw function */
function makeSprite(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, frame: number) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  // Expose frame via global (ugly but fast — fine for game dev)
  // We'll draw on-demand instead
  (c as any)._draw = draw;
  return c;
}

/** Pre-render a sprite and return a function that draws it scaled */
function createSpriteDrawer(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, frame: number, flash: boolean) => void) {
  const cache: HTMLCanvasElement[] = [];
  const CACHE_SIZE = 8;
  
  return (ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, flash: boolean) => {
    const key = frame % CACHE_SIZE;
    if (!cache[key]) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const cx = c.getContext("2d")!;
      cx.imageSmoothingEnabled = false;
      draw(cx, frame, flash);
      cache[key] = c;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cache[key], Math.round(x - w / 2 * SPRITE_SCALE), Math.round(y - h / 2 * SPRITE_SCALE), w * SPRITE_SCALE, h * SPRITE_SCALE);
  };
}

// ══════════════════════════════════
// SPRITE: Defender (robot, 16x16)
// ══════════════════════════════════
function drawDefenderRaw(ctx: CanvasRenderingContext2D, frame: number, flash: boolean) {
  const body = flash ? C.hitFlash : C.defBody;
  const dark = flash ? C.hitFlash : C.defDark;
  const light = flash ? C.hitFlash : C.defLight;
  const eye = flash ? C.hitFlash : C.defEye;

  // Antenna
  rect(ctx, 7, 0, 2, 2, light);
  p(ctx, 8, 0, frame % 30 < 15 ? C.fireLight : C.defGlow);

  // Head
  rect(ctx, 4, 2, 8, 1, light);
  rect(ctx, 3, 3, 10, 2, body);

  // Eyes + visor
  rect(ctx, 2, 5, 12, 2, body);
  rect(ctx, 3, 5, 6, 1, dark); // visor dark
  // Eye pupils
  p(ctx, 4, 5, eye); p(ctx, 6, 5, eye); p(ctx, 8, 5, eye);

  // Torso
  rect(ctx, 3, 7, 10, 1, body);
  rect(ctx, 3, 8, 10, 2, body);
  // Belt
  rect(ctx, 4, 10, 8, 1, dark);

  // Arms with bob animation
  const armB = frame % 8 < 4 ? 0 : -1;
  rect(ctx, 1, 7 + armB, 2, 3, dark);
  rect(ctx, 13, 7 - armB, 2, 3, dark);
  // Hands
  p(ctx, 1, 9 + armB, light); p(ctx, 14, 9 - armB, light);

  // Legs
  const legB = frame % 8 < 4 ? 0 : 1;
  rect(ctx, 4, 12, 3, 1, dark);
  rect(ctx, 9, 12, 3, 1, dark);
  p(ctx, 4, 13 + legB, dark); p(ctx, 11, 13 - legB, dark);
  // Feet
  p(ctx, 3, 14 + legB, dark); p(ctx, 12, 14 - legB, dark);

  // Shield emblem
  p(ctx, 7, 8, light); p(ctx, 6, 9, light); p(ctx, 7, 9, light); p(ctx, 8, 9, light);

  // Glow outline
  if (!flash) {
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(frame * 0.1);
    rect(ctx, 2, 1, 12, 1, C.defGlow);
    rect(ctx, 1, 6, 1, 1, C.defGlow);
    rect(ctx, 14, 6, 1, 1, C.defGlow);
    ctx.globalAlpha = 1;
  }
}

// ══════════════════════════════════
// SPRITE: Sniper (15x15)
// ══════════════════════════════════
function drawSniperRaw(ctx: CanvasRenderingContext2D, frame: number, flash: boolean) {
  const body = flash ? C.hitFlash : C.snpBody;
  const dark = flash ? C.hitFlash : C.snpDark;
  const light = flash ? C.hitFlash : C.snpLight;
  const eye = flash ? C.hitFlash : C.snpEye;

  // Head + hat
  rect(ctx, 4, 1, 8, 2, body);
  rect(ctx, 3, 3, 10, 2, body);
  rect(ctx, 2, 3, 1, 2, dark); // brim

  // Visor + eyes
  rect(ctx, 4, 3, 8, 1, dark);
  p(ctx, 5, 3, eye); p(ctx, 9, 3, eye);
  rect(ctx, 4, 4, 8, 1, body);
  p(ctx, 5, 4, eye); p(ctx, 9, 4, eye);

  // Torso
  rect(ctx, 5, 5, 6, 1, body);
  rect(ctx, 4, 6, 8, 3, body);
  rect(ctx, 5, 9, 6, 1, dark);

  // Arms + weapon
  p(ctx, 2, 7, dark); p(ctx, 3, 7, body); // gun barrel
  p(ctx, 2, 8, dark);
  p(ctx, 13, 7, dark); p(ctx, 13, 8, dark);

  // Legs
  const legB = frame % 8 < 4 ? 0 : 1;
  rect(ctx, 5, 10, 2, 1, dark);
  rect(ctx, 9, 10, 2, 1, dark);
  p(ctx, 5, 11 + legB, dark); p(ctx, 10, 11 - legB, dark);

  if (!flash) {
    ctx.globalAlpha = 0.2 + 0.1 * Math.sin(frame * 0.12);
    rect(ctx, 3, 0, 1, 1, C.snpGlow);
    rect(ctx, 12, 0, 1, 1, C.snpGlow);
    ctx.globalAlpha = 1;
  }
}

// ══════════════════════════════════
// SPRITE: Tank Enemy (14x12)
// ══════════════════════════════════
function drawTankRaw(ctx: CanvasRenderingContext2D, frame: number, flash: boolean) {
  const body = flash ? C.hitFlash : C.tankBody;
  const dark = flash ? C.hitFlash : C.tankDark;
  const light = flash ? C.hitFlash : C.tankLight;
  const eye = flash ? C.hitFlash : C.tankEye;

  // Top plate
  rect(ctx, 3, 0, 8, 1, dark);
  // Body upper
  rect(ctx, 2, 1, 10, 1, light);
  rect(ctx, 1, 2, 12, 2, body);

  // Eyes (menacing)
  p(ctx, 5, 2, eye); p(ctx, 8, 2, eye);
  // Eyebrow (angry)
  rect(ctx, 4, 1, 3, 1, dark);
  rect(ctx, 7, 1, 3, 1, dark);

  // Body mid
  rect(ctx, 1, 4, 12, 2, body);
  rect(ctx, 0, 6, 14, 2, body);

  // Mouth/grill
  rect(ctx, 4, 6, 6, 1, dark);
  p(ctx, 5, 6, light); p(ctx, 8, 6, light);

  // Body lower
  rect(ctx, 2, 8, 10, 1, body);
  // Tracks/rubber feet
  rect(ctx, 1, 9, 12, 1, dark);
  rect(ctx, 2, 10, 2, 1, dark); rect(ctx, 6, 10, 2, 1, dark); rect(ctx, 10, 10, 2, 1, dark);
  rect(ctx, 1, 11, 12, 1, dark);

  if (!flash) {
    ctx.globalAlpha = 0.2;
    p(ctx, 0, 3, C.fire); p(ctx, 13, 3, C.fire);
    ctx.globalAlpha = 1;
  }
}

// ══════════════════════════════════
// SPRITE: Fast Enemy (diamond, 10x10)
// ══════════════════════════════════
function drawFastRaw(ctx: CanvasRenderingContext2D, frame: number, flash: boolean) {
  const body = flash ? C.hitFlash : C.fastBody;
  const dark = flash ? C.hitFlash : C.fastDark;
  const light = flash ? C.hitFlash : C.fastLight;
  const eye = flash ? C.hitFlash : C.fastEye;

  // Diamond shape pointing toward agents (left)
  p(ctx, 5, 0, light); p(ctx, 4, 1, light); p(ctx, 6, 1, light);
  rect(ctx, 3, 2, 4, 1, light);
  rect(ctx, 1, 3, 8, 2, body);
  // Eye at front (left)
  p(ctx, 1, 4, eye);
  // Core
  rect(ctx, 2, 5, 6, 2, body);
  rect(ctx, 3, 7, 4, 1, light);
  p(ctx, 4, 8, dark); p(ctx, 5, 9, dark);

  // Speed trail
  if (!flash) {
    ctx.globalAlpha = 0.3;
    const trailOff = (frame * 2) % 3;
    p(ctx, 7 + trailOff, 3, C.fastLight);
    p(ctx, 8 + trailOff, 4, C.fastLight);
    p(ctx, 9 + trailOff, 5, C.fastLight);
    ctx.globalAlpha = 1;
  }
}

// ══════════════════════════════════
// SPRITE: Base Tower (12x16)
// ══════════════════════════════════
function drawBaseRaw(ctx: CanvasRenderingContext2D, hpRatio: number, frame: number) {
  const low = hpRatio < 0.3;
  const body = low ? "#7f1d1d" : C.baseBody;
  const dark = low ? "#450a0a" : C.baseDark;
  const light = low ? "#dc2626" : C.baseLight;
  const top = low ? "#b91c1c" : C.baseTop;
  const window = low ? "#fca5a5" : C.baseWindow;

  // Side walls
  rect(ctx, 0, 2, 1, 13, light);
  rect(ctx, 11, 2, 1, 13, light);

  // Top battlements
  p(ctx, 1, 0, top); p(ctx, 2, 0, top); p(ctx, 4, 0, top); p(ctx, 7, 0, top); p(ctx, 10, 0, top);
  rect(ctx, 0, 1, 12, 1, light);

  // Main body
  rect(ctx, 1, 2, 1, 13, dark);
  rect(ctx, 11, 2, 1, 13, dark);
  rect(ctx, 2, 3, 8, 12, body);

  // Windows
  p(ctx, 3, 4, window); p(ctx, 8, 4, window);
  p(ctx, 3, 7, window); p(ctx, 8, 7, window);

  // Door
  rect(ctx, 5, 10, 2, 5, dark);
  p(ctx, 5, 9, body); p(ctx, 8, 9, body);

  // Signal tower
  p(ctx, 6, 1, frame % 20 < 10 ? C.fireLight : light);
  rect(ctx, 6, 2, 1, 1, light);

  // Low HP damage effect
  if (low) {
    if (frame % 8 < 4) { p(ctx, 0, 0, C.fire); }
    if (frame % 10 < 3) { p(ctx, 10, 1, C.explosion); p(ctx, 1, 5, C.explosion); }
  }
}

// ══════════════════════════════════
// PRE-RENDER ALL SPRITES
// ══════════════════════════════════
function preRenderAll() {
  const all: { [key: string]: ReturnType<typeof createSpriteDrawer> } = {};

  all.defender = createSpriteDrawer(16, 15, drawDefenderRaw);
  all.sniper = createSpriteDrawer(15, 12, drawSniperRaw);
  all.tank = createSpriteDrawer(14, 12, drawTankRaw);
  all.fast = createSpriteDrawer(10, 10, drawFastRaw);
  all.base = createSpriteDrawer(12, 15, (ctx, frame, _flash) => drawBaseRaw(ctx, 0.5, frame));

  return all;
}

// Export pixel art drawing functions for use in renderer
function getPixelSpriteDrawers() {
  const all: {
    defender: ReturnType<typeof createSpriteDrawer>;
    sniper: ReturnType<typeof createSpriteDrawer>;
    tank: ReturnType<typeof createSpriteDrawer>;
    fast: ReturnType<typeof createSpriteDrawer>;
    base: (ctx: CanvasRenderingContext2D, x: number, y: number, hpRatio: number, frame: number) => void;
  } = {} as any;

  // Defender
  all.defender = createSpriteDrawer(16, 15, drawDefenderRaw);
  // Sniper
  all.sniper = createSpriteDrawer(15, 12, drawSniperRaw);
  // Tank
  all.tank = createSpriteDrawer(14, 12, drawTankRaw);
  // Fast
  all.fast = createSpriteDrawer(10, 10, drawFastRaw);
  // Base (special — needs hpRatio)
  all.base = (ctx: CanvasRenderingContext2D, x: number, y: number, hpRatio: number, frame: number) => {
    const cacheKey = hpRatio < 0.3 ? 1 : 0;
    if (!baseCache[cacheKey]) {
      const frames: HTMLCanvasElement[] = [];
      for (let i = 0; i < 4; i++) {
        const c = document.createElement("canvas");
        c.width = 12; c.height = 15;
        const cx = c.getContext("2d")!;
        cx.imageSmoothingEnabled = false;
        drawBaseRaw(cx, hpRatio, i * 4);
        frames.push(c);
      }
      baseCache[cacheKey] = frames;
    }
    const f = baseCache[cacheKey][frame % 4];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(f, Math.round(x - 6 * SPRITE_SCALE), Math.round(y - 7.5 * SPRITE_SCALE), 12 * SPRITE_SCALE, 15 * SPRITE_SCALE);
  };

  return all;
}

const baseCache: Record<number, HTMLCanvasElement[]> = {};

export { getPixelSpriteDrawers, C, SPRITE_SCALE };
