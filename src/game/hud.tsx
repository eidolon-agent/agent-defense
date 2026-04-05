// ===== HUD Overlay Component =====
"use client";

import { DEFENDER_BLUEPRINTS } from "@/types";
import type { DefenderType } from "@/types";

interface HUDProps {
  money: number;
  lives: number;
  wave: number;
  waveActive: boolean;
  gameOver: boolean;
  gameWon: boolean;
  selectedType: DefenderType | null;
  onSelectDefender: (type: DefenderType | null) => void;
  onStartWave: () => void;
}

const DEF_ORDER: DefenderType[] = ["rifleman", "machinegun", "mortar", "sniper"];

export default function HUD({
  money,
  lives,
  wave,
  waveActive,
  gameOver,
  gameWon,
  selectedType,
  onSelectDefender,
  onStartWave,
}: HUDProps) {
  return (
    <div className="w-full bg-gray-900 text-white p-3 select-none">
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex gap-4 items-center text-sm">
          <span className="text-yellow-400 font-mono">
            $ {money}
          </span>
          <span className="text-red-400 font-mono">
            ♥ {lives}
          </span>
          <span className="text-blue-300 font-mono">
            Wave {wave} / 5
          </span>
        </div>

        {!waveActive && !gameOver && !gameWon && wave < 5 && (
          <button
            onClick={onStartWave}
            className="px-3 py-1 bg-orange-700 hover:bg-orange-600 text-white rounded font-mono text-xs uppercase transition"
          >
            ▶ Start Wave {wave + 1}
          </button>
        )}

        {waveActive && (
          <span className="text-orange-400 font-mono text-xs uppercase animate-pulse">
            Wave {wave} in progress...
          </span>
        )}

        {gameWon && (
          <span className="text-green-400 font-mono text-xs font-bold">
            VICTORY
          </span>
        )}

        {gameOver && !gameWon && (
          <span className="text-red-500 font-mono text-xs font-bold">
            DEFEAT
          </span>
        )}
      </div>

      {/* Defender selection */}
      <div className="flex gap-1 px-1">
        {DEF_ORDER.map((type) => {
          const bp = DEFENDER_BLUEPRINTS[type];
          const canAfford = money >= bp.cost;
          const isSelected = selectedType === type;

          return (
            <button
              key={type}
              onClick={() => onSelectDefender(isSelected ? null : type)}
              className={`
                px-2 py-1 rounded font-mono text-xs transition border
                ${isSelected
                  ? "bg-green-800 border-green-500 text-green-200"
                  : canAfford
                    ? "bg-gray-800 border-gray-600 hover:border-gray-400 text-gray-200"
                    : "bg-gray-900 border-gray-700 text-gray-600 cursor-not-allowed opacity-50"}
              `}
            >
              <span
                className="inline-block w-2 h-2 mr-1 rounded-sm"
                style={{ backgroundColor: bp.color }}
              />
              {type} [{bp.cost}]
            </button>
          );
        })}

        <button
          onClick={() => onSelectDefender(null)}
          className={`px-2 py-1 rounded font-mono text-xs transition border
            ${!selectedType
              ? "bg-blue-800 border-blue-500 text-blue-200"
              : "bg-gray-800 border-gray-600 hover:border-gray-400 text-gray-200"}
          `}
        >
          ✕ Deselect
        </button>
      </div>
    </div>
  );
}
