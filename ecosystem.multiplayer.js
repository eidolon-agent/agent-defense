module.exports = {
  apps: [
    {
      name: "agent-defense-ws",
      script: "backend/multiplayer-ws.ts",
      interpreter: "npx",
      interpreter_args: "tsx",
      cwd: "/root/agent-defense",
      env: {
        GAME_PORT: "8765",
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: "/root/agent-defense/logs/ws-error.log",
      out_file: "/root/agent-defense/logs/ws-out.log",
      merge_logs: true,
    },
    {
      name: "agent-defense-mp",
      script: "node",
      args: "node_modules/next/dist/bin/next start -p 3002",
      cwd: "/root/agent-defense",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: "/root/agent-defense/logs/mp-error.log",
      out_file: "/root/agent-defense/logs/mp-out.log",
      merge_logs: true,
      env: {
        NEXT_PUBLIC_GAME_SERVER: "ws://localhost:8765",
      },
    },
  ],
};
