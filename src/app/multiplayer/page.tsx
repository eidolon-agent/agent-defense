"use client";

import { useState, useCallback } from "react";
import MultiplayerGame from "@/components/MultiplayerGame";

export default function MultiplayerPage() {
  const [room, setRoom] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const createRoom = useCallback(() => {
    const id = Math.random().toString(36).substring(2, 8);
    setRoom(id);
    setIsHost(true);
  }, []);

  const joinRoom = useCallback((code: string) => {
    setRoom(code.toLowerCase().trim());
    setIsHost(false);
  }, []);

  if (room) {
    return <MultiplayerGame roomCode={room} isHost={isHost} />;
  }

  return <LobbyScreen onCreate={createRoom} onJoin={joinRoom} />;
}

function LobbyScreen({ onCreate, onJoin }: {
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [input, setInput] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-stone-950 to-gray-950 flex items-center justify-center">
      <div className="text-center max-w-md w-full px-4">
        <div className="text-6xl mb-3">⚔️</div>
        <h1 className="text-4xl font-bold text-orange-500 mb-2">AGENT DEFENSE</h1>
        <p className="text-stone-500 mb-8 text-sm">Multiplayer — Co-op Tower Defense</p>

        <div className="flex flex-col gap-4">
          <button
            onClick={onCreate}
            className="px-8 py-4 bg-gradient-to-r from-amber-900/80 to-red-900/80 hover:from-amber-800 hover:to-red-800 text-amber-100 rounded-xl font-semibold transition border border-amber-700/30 shadow-lg shadow-amber-900/20 text-lg"
          >
            🏰 Create Room
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter room code..."
              className="flex-1 px-4 py-3 bg-stone-900/80 border border-stone-700 rounded-xl text-amber-100 placeholder-stone-600 focus:border-amber-500 focus:outline-none font-mono"
              onKeyDown={e => {
                if (e.key === "Enter" && input.length > 3) onJoin(input);
              }}
            />
            <button
              onClick={() => input.length > 3 && onJoin(input)}
              className="px-6 py-3 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded-xl font-semibold transition border border-amber-500/50"
            >
              Join
            </button>
          </div>
        </div>

        <p className="text-stone-700 text-xs mt-8">Up to 4 players per room</p>
      </div>
    </div>
  );
}
