module.exports = {
  apps: [
    {
      name: "agent-defense-frontend",
      cwd: "/root/agent-defense",
      script: "node",
      args: "node_modules/next/dist/bin/next start -p 3000",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "/root/agent-defense/logs/frontend-error.log",
      out_file: "/root/agent-defense/logs/frontend-out.log",
      merge_logs: true,
    },
    {
      name: "agent-defense-backend",
      cwd: "/root/agent-defense/backend",
      script: "npx",
      args: "tsx server.ts",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      error_file: "/root/agent-defense/logs/backend-error.log",
      out_file: "/root/agent-defense/logs/backend-out.log",
      merge_logs: true,
    },
  ],
};
