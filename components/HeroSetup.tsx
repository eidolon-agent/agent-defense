"use client";
import { useState, useEffect } from "react";

type Lane = "top" | "mid" | "bot";
type AgentClass = "knight" | "archer" | "mage" | "rogue";

const HEROES: { k: AgentClass; icon: string; label: string; desc: string; color: string }[] = [
  { k: "knight", icon: "🛡️", label: "Knight", desc: "Tank + Shield abilities", color: "border-blue-500" },
  { k: "archer", icon: "🏹", label: "Archer", desc: "Ranged + Rapid Fire", color: "border-rose-500" },
  { k: "mage", icon: "🔮", label: "Mage", desc: "AoE + Heal spells", color: "border-purple-500" },
  { k: "rogue", icon: "🗡️", label: "Rogue", desc: "Stealth + Crit", color: "border-slate-500" },
];

const LANES: { k: Lane; label: string; col: string }[] = [
  { k: "top", label: "TOP", col: "text-blue-400" },
  { k: "mid", label: "MID", col: "text-yellow-400" },
  { k: "bot", label: "BOT", col: "text-green-400" },
];

interface HeroSetupData { cls: AgentClass; lane: Lane }

export default function HeroSetup({
  numHeroes,
  onComplete
}: {
  numHeroes: number;
  onComplete: (setup: HeroSetupData[]) => void;
}) {
  const [slots, setSlots] = useState<HeroSetupData[]>(
    Array.from({ length: numHeroes }, (_, i) => ({
      cls: HEROES[i % HEROES.length].k,
      lane: (["top", "mid", "bot"] as Lane[])[i % 3],
    }))
  );

  return (
    <div className="bg-gray-900/95 border border-indigo-700/50 rounded-2xl p-5 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
      <h3 className="text-lg font-bold text-indigo-300 mb-1">⚔️ Prepare Heroes</h3>
      <p className="text-xs text-gray-400 mb-4">Select hero class and lane ({numHeroes} heroes)</p>

      <div className="space-y-3 mb-5">
        {slots.map((s, i) => (
          <div key={i} className="bg-gray-800/50 rounded-xl p-3">
            <div className="text-xs font-bold text-gray-300 mb-2">Hero {i + 1}</div>
            <div className="flex gap-1.5 mb-2">
              {HEROES.map(h => (
                <button key={h.k} onClick={() => {
                  const ns = [...slots]; ns[i] = { ...ns[i], cls: h.k };
                  setSlots(ns);
                }}
                  className={`px-2 py-1 rounded-lg text-sm transition ${s.cls === h.k ? `bg-indigo-900/50 ${h.color} border` : "border border-gray-700 hover:border-gray-500 text-gray-400"}`}>
                  {h.icon} {h.label}
                </button>
              ))}
            </div>
            <div className="text-[9px] text-gray-500 mb-1.5">Lane:</div>
            <div className="flex gap-1.5">
              {LANES.map(l => (
                <button key={l.k} onClick={() => {
                  const ns = [...slots]; ns[i] = { ...ns[i], lane: l.k };
                  setSlots(ns);
                }}
                  className={`px-3 py-1 rounded-lg text-sm font-mono transition ${s.lane === l.k ? `${l.col} bg-gray-800 border border-gray-600` : "border border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lane distribution summary */}
      <div className="mb-4 text-xs text-gray-400 space-y-1">
        <div>Lane distribution:</div>
        {LANES.map(l => {
          const count = slots.filter(s => s.lane === l.k).length;
          return count > 0 && (
            <div key={l.k} className={`${l.col}`}>
              {l.label}: {slots.filter(s => s.lane === l.k).map(s => HEROES.find(h => h.k === s.cls)?.icon).join(' ')}
            </div>
          );
        })}
      </div>

      <button onClick={() => onComplete(slots)}
        className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-semibold transition">
        ⚔️ Enter Battle
      </button>
    </div>
  );
}
