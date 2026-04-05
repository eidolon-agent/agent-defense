"use client";

import { useRef, useEffect } from "react";
import { updateWithSpawn, resetElapsed, getState, getConstants } from "@/engine";
import {
  drawBackground,
  drawGrid,
  drawDefender,
  drawProjectile,
  drawParticles,
  spawnExplosion,
} from "@/game/sprites";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    resetElapsed();
    let lastTime = 0;

    function render(timestamp: number) {
      updateWithSpawn(canvas, timestamp);
      lastTime = timestamp;

      const state = getState();
      const constants = getConstants();

      // Clear
      ctx.clearRect(0, 0, constants.GAME_W, constants.GAME_H);

      // Draw background
      drawBackground(ctx);

      // Draw grid
      drawGrid(ctx, new Set()); // TODO: buildable cells

      // Draw defenders
      for (const def of state.defenders) {
        const selected = state.selectedDefenderType === def.defenderType;
        drawDefender(ctx, def.defenderType, def.x, def.y, selected ? def.range : undefined);
      }

      // Draw enemies
      for (const e of state.enemies) {
        // Simple enemy drawing (sprites.ts has drawEnemy but it depends on type)
        ctx.fillStyle =
          e.type === "scout"
            ? "#1a1a2a"
            : e.type === "soldier"
            ? "#3a3a3a"
            : e.type === "tank"
            ? "#4a4a2a"
            : "#6a2a2a";
        const size = e.type === "boss" ? 6 : e.type === "tank" ? 4 : 3;
        ctx.fillRect(e.x - size / 2, e.y - size / 2, size, size);

        // HP bar
        if (e.maxHp > 1) {
          const hpW = 10;
          const hpY = e.y - size / 2 - 2;
          const hpX = e.x - hpW / 2;
          const ratio = Math.max(0, e.hp / e.maxHp);
          ctx.fillStyle = "#222";
          ctx.fillRect(hpX, hpY, hpW, 1);
          ctx.fillStyle = ratio > 0.5 ? "#4a4" : ratio > 0.25 ? "#aa4" : "#a44";
          ctx.fillRect(hpX, hpY, Math.ceil(hpW * ratio), 1);
        }
      }

      // Draw projectiles
      for (const p of state.projectiles) {
        drawProjectile(ctx, p);
      }

      // Draw particles
      drawParticles(ctx, state.particles);

      // Scale canvas for crisp pixel art
      ctx.imageSmoothingEnabled = false;

      animRef.current = requestAnimationFrame(render);
    }

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={125}
      className="pixelated w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
