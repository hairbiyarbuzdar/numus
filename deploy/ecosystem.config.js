// PM2 process definitions for Numu.
// Runs the Express/Socket.io backend and the Next.js frontend, keeps them
// alive, and (via `pm2 startup` + `pm2 save`) restarts them on server reboot.
//
//   cd /var/www/numu
//   pm2 start deploy/ecosystem.config.js
//   pm2 save
//
// Assumes the repo lives at /var/www/numu. Change APP_DIR if you cloned elsewhere.

const APP_DIR = "/var/www/numu";

module.exports = {
  apps: [
    {
      name: "numu-backend",
      cwd: `${APP_DIR}/backend`,
      script: "src/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      // Reads secrets from backend/.env via dotenv (already wired in index.js).
      max_memory_restart: "400M",
      time: true,
    },
    {
      name: "numu-frontend",
      cwd: APP_DIR,
      // `next start` — serves the production build on port 3000.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "500M",
      time: true,
    },
  ],
};
