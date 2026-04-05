"use client";
import type { Command } from "@/core/game/types";

const BTNS: {k:Command; label:string; icon:string; desc:string}[] = [
  {k:"FAST", label:"FAST", icon:"⚡", desc:"Target fastest enemies"},
  {k:"STRONG", label:"STRONG", icon:"🎯", desc:"Focus highest HP"},
  {k:"BASE", label:"BASE", icon:"🛡️", desc:"Closest to base first"},
];

interface Props {
  command: Command; onCommand: (c:Command)=>void;
  wave: number; score: number; baseHP: number; maxBaseHP: number; playing: boolean; gold: number;
}

export default function Controls({ command, onCommand, wave, score, baseHP, maxBaseHP, playing, gold }: Props) {
  const r = maxBaseHP > 0 ? baseHP / maxBaseHP : 0;
  const bc = r > 0.6 ? "bg-green-500" : r > 0.3 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex flex-col items-center gap-2 p-3 w-full">
      <div className="flex justify-between w-full px-2 text-xs">
        <div className="flex gap-3">
          <span className="text-gray-400">Wave <span className="text-indigo-400 font-bold">{wave}/8</span></span>
          <span className="text-yellow-400 font-mono">🪙 {gold}</span>
        </div>
        <span className="text-yellow-400 font-semibold">Score: {score}</span>
      </div>
      <div className="w-full bg-gray-800 rounded-lg h-3 overflow-hidden border border-gray-700">
        <div className={`h-full transition-all duration-200 ${bc}`} style={{width:`${r*100}%`}}/>
      </div>
      <div className="text-[10px] text-gray-500">Base HP: {baseHP} / {maxBaseHP}</div>
      {playing && (
        <div className="flex gap-2">
          {BTNS.map(b => (
            <button key={b.k} onClick={()=>onCommand(b.k)} title={b.desc}
              className={`flex flex-col items-center px-4 py-2 rounded-lg border transition text-sm
                ${command===b.k ? "bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/20 scale-105" : "bg-gray-800 border-gray-700 hover:border-gray-500"}`}>
              <span className="text-lg">{b.icon}</span>
              <span className="font-semibold">{b.label}</span>
              <span className="text-[8px] text-gray-400 mt-0.5">{b.desc}</span>
            </button>
          ))}
        </div>
      )}
      <div className="text-[9px] text-gray-600 text-center mt-1">
        Hover agent for abilities • ⬆️ Upgrades between waves
      </div>
    </div>
  );
}
