// ===== Canvas Component =====
"use client";

import { useRef, useEffect } from "react";
import { GameEngine } from "@/game/engine";
import { drawBackground, drawPath, drawGrid, drawDefender, drawEnemy, drawProjectile, drawParticles } from "@/game/sprites";
import { WAYPOINTS, GAME_W, GAME_H, CELL_W, CELL_H, GRID_COLS, GRID_ROWS, DEFENDER_BLUEPRINTS } from "@/types";
import type { DefenderType } from "@/types";

interface CanvasProps {
  engine: GameEngine;
  selectedType: DefenderType | null;
  onCanvasClick: (gx: number, gy: number) => void;
  hoveredCell: { gx: number; gy: number } | null;
  onHover: (cell: { gx: number; gy: number } | null) => void;
}

export default function GameCanvas({ engine, selectedType, onCanvasClick, hoveredCell, onHover }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    let lastFrame = 0;

    function frame(time: number) {
      // Game tick
      engine.tick();

      // Render
      render(ctx);

      animRef.current = requestAnimationFrame(frame);
      lastFrame = time;
    }

    function render(ctx: CanvasRenderingContext2D) {
      const state = engine.state;
      const s = state;

      // Clear
      ctx.clearRect(0, 0, GAME_W, GAME_H);

      // Background
      drawBackground(ctx);

      // Path
      drawPath(ctx, WAYPOINTS);

      // Grid overlay
      drawGrid(ctx, CELL_W, CELL_H, GRID_COLS, GRID_ROWS);

      // Hovered cell highlight
      if (hoveredCell && selectedType) {
        const hx = hoveredCell.gx * CELL_W;
        const hy = hoveredCell.gy * CELL_H;
        const bp = DEFENDER_BLUEPRINTS[selectedType];
        const canPlace = s.money >= bp.cost;
        ctx.fillStyle = canPlace ? "rgba(0,255,0,0.2)" : "rgba(255,0,0,0.2)";
        ctx.fillRect(hx, hy, CELL_W, CELL_H);
        if (canPlace) {
          ctx.strokeStyle = "rgba(0,255,0,0.4)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(hx, hy, CELL_W, CELL_H);
        }
      }

      // Defenders
      for (const [, d] of s.defenders) {
        drawDefender(ctx, d.defenderType, d.x, d.y, d.range);
      }

      // Enemies
      for (const [, en] of s.enemies) {
        drawEnemy(ctx, en.type, en.x, en.y, en.hp, en.maxHp, en.hit);
      }

      // Projectiles
      for (const [, proj] of s.projectiles) {
        drawProjectile(ctx, proj.x, proj.y, proj.color, proj.type);
      }

      // Particles
      drawParticles(ctx, Array.from(s.particles.values()));

      // Game over / won overlay
      if (s.gameOver && !s.gameWon) {
        drawOverlay(ctx, "DEFEAT", "Your base has fallen!");
      } else if (s.gameWon) {
        drawOverlay(ctx, "VICTORY",  "All waves defeated!");
      }
    }

    function drawOverlay(ctx: CanvasRenderingContext2D, title: string, subtitle: string) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, GAME_H / 2 - 15, GAME_W, 30);

      ctx.fillStyle = "#fff";
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.fillText(title, GAME_W / 2, GAME_H / 2 - 4);

      ctx.font = "3px monospace";
      ctx.fillStyle = "#aaa";
      ctx.fillText(subtitle, GAME_W / 2, GAME_H / 2 + 5);
      ctx.fillText("Refresh to restart", GAME_W / 2, GAME_H / 2 + 11);
    }

    animRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [engine, selectedType, hoveredCell]);

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_W / rect.width;
    const scaleY = GAME_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const gx = Math.floor(mx / CELL_W);
    const gy = Math.floor(my / CELL_H);
    if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
      onHover({ gx, gy });
    } else {
      onHover(null);
    }
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_W / rect.width;
    const scaleY = GAME_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const gx = Math.floor(mx / CELL_W);
    const gy = Math.floor(my / CELL_H);
    if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
      onCanvasClick(gx, gy);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={GAME_W}
      height={GAME_H}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      className="border border-gray-700"
      style={{
        width: `${GAME_W * 4}px`,
        height: `${GAME_H * 4}px`,
        imageRendering: "pixelated",
        cursor: selectedType ? "crosshair" : "default",
      }}
    />
  );
}
