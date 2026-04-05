"use client";
interface Props { thought: string; x: number; visible: boolean; }

export default function ThoughtBubble({ thought, x, visible }: Props) {
  if (!visible || !thought) return null;
  return (
    <div className="absolute pointer-events-none z-20" style={{ left: x - 55, top: -48 }}>
      <div className="bg-gray-900/90 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-xs text-indigo-200 whitespace-nowrap backdrop-blur-sm shadow-lg shadow-indigo-500/10">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[7px] w-2 h-2 bg-gray-900/90 border-r border-b border-indigo-500/40 rotate-45"/>
        {thought}
      </div>
    </div>
  );
}
