"use client";
import type { HeroClass } from "@/core/game/types";
import { getShopKeys } from "@/core/game/GameEngine";

const SHOP_ITEMS: Record<string, { icon: string; label: string; cost: number }> = {
  gold_damage: { icon: "⚔️", label: "+15% Damage (all)", cost: 60 },
  gold_hp: { icon: "❤️", label: "+20% Max HP (all)", cost: 50 },
  gold_base_heal: { icon: "🏥", label: "Repair Base (+5)", cost: 40 },
  gold_speed: { icon: "⚡", label: "+15% Speed (all)", cost: 70 },
  gold_range: { icon: "📏", label: "+10% Range (all)", cost: 55 },
  gold_crit: { icon: "💥", label: "+10% Crit (all)", cost: 60 },
};

interface Props {
  gold: number;
  wave: number;
  onBuy: (itemId: string) => void;
  onClose: () => void;
}

export default function Shop({ gold, wave, onBuy, onClose }: Props) {
  const keys = getShopKeys();
  const purchased = useRef<string[]>([]);
  
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg backdrop-blur-sm z-10">
      <div className="bg-gray-900/95 border border-yellow-600 rounded-2xl p-5 max-w-sm mx-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-yellow-300">🛒 Wave {wave} Shop</h3>
          <span className="text-sm text-yellow-400 font-mono">🪙 {gold}</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">Buy global upgrades for the team</p>
        <div className="space-y-2">
          {keys.map(key => {
            const item = SHOP_ITEMS[key];
            const canBuy = gold >= item.cost && !purchased.current.includes(key);
            return (
              <button
                key={key}
                onClick={() => { onBuy(key); purchased.current.push(key); }}
                disabled={!canBuy}
                className="w-full p-3 bg-gray-800/80 hover:bg-yellow-900/30 border border-gray-700 hover:border-yellow-500 rounded-xl text-left transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-semibold text-sm text-white">{item.label}</span>
                  </div>
                  <span className="text-yellow-400 font-mono font-bold">{item.cost}g</span>
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 bg-green-600 hover:bg-green-500 rounded-xl font-semibold transition">
          Continue to Wave {wave + 1}
        </button>
      </div>
    </div>
  );
}

import { useRef } from "react";
