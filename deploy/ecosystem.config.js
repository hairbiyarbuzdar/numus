// PM2 process definitions for Numu.
// Runs the Express/Socket.io backend and the Next.js frontend, keeps them
// alive, and (via `pm2 startup` + `pm2 save`) restarts them on server reboot.
//
//   cd /var/www/numu
//   pm2 start deploy/ecosystem.config.js
//   pm2 save
//
// Assumes the repo lives at /var/www/numu. Change APP_DIR if you cloned elsewhere.
//
// NOTE: this box (72.62.126.88) is a SHARED server hosting other sites
// (bloodbank, ib-panaflex, marquee, star-panaflex, wa-bridge under PM2, plus
// several more under nginx/docker). Ports 3000-3003, 3007, 3010, 3011, 3014,
// 3019-3022, 3030 and 5050/5051 were already taken at deploy time, so numu
// uses 4100/4101 instead of the usual 3000/4000. If port 4000 is genuinely
// free you could use it for the backend, but 4100/4101 keeps a clean gap
// away from everything else already observed on the box.

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
        PORT: "4100",
      },
      // Reads secrets from backend/.env via dotenv (already wired in index.js).
      max_memory_restart: "400M",
      time: true,
    },
    {
      name: "numu-frontend",
      cwd: APP_DIR,
      // `next start` — serves the production build on port 4101.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 4101",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "4101",
      },
      max_memory_restart: "500M",
      time: true,
    },
  ],
};
