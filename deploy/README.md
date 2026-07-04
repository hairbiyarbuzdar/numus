# Deploying Numu to a VPS (Ubuntu + PM2 + Nginx + PostgreSQL)

Stack: **Next.js** frontend (port 3000) + **Express/Socket.io** backend (port 4000) + **PostgreSQL** (local). Nginx reverse-proxies everything on one domain over HTTPS.

```
                    ┌──────────────── VPS ────────────────┐
  Browser  ──443──▶ │  Nginx  ─/──────▶ Next.js  :3000     │
  (HTTPS)           │         ─/api───▶ Express  :4000     │
                    │         ─/socket.io─▶ (same :4000)   │
                    │                    PostgreSQL :5432  │
                    └──────────────────────────────────────┘
```

Fill in these two values wherever you see them: **`numu.com.pk`** and **`72.61.118.49`**.

---

## 0. Point DNS at the VPS (do this first — TLS needs it)
In your domain registrar, create an **A record**:

| Type | Name | Value        |
|------|------|--------------|
| A    | @    | 72.61.118.49  |
| A    | www  | 72.61.118.49  |

DNS can take a few minutes to propagate. Verify: `dig +short numu.com.pk` returns your IP.

---

## 1. Provision the server (one time)
SSH in as root and run the setup script. It installs Node 20, PostgreSQL, PM2, Nginx, Certbot, the firewall, and creates the database.

```bash
ssh root@72.61.118.49

# get this repo's deploy script onto the box (either clone the repo, or scp the file)
# then:
bash 01-server-setup.sh
```

**➜ Copy the database password it prints at the end** — you need it in the next step.

---

## 2. Get the code onto the VPS
Pick **one**:

**A) Via your GitHub repo (recommended)**
```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone https://github.com/hairbiyarbuzdar/numus.git numu
sudo chown -R $USER:$USER /var/www/numu
cd /var/www/numu
```

**B) Via rsync from your Windows machine** (run in Git Bash locally, excludes junk):
```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  ./ root@72.61.118.49:/var/www/numu/
```

---

## 3. Create the two env files
```bash
cd /var/www/numu

# Backend secrets
cp deploy/backend.env.production.example backend/.env
nano backend/.env      # paste DB password, set CLIENT_ORIGIN=https://numu.com.pk,
                       # generate JWT_SECRET, add your Resend key

# Generate a fresh JWT secret:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Frontend build-time config
cp deploy/frontend.env.production.example .env.production
nano .env.production   # set NEXT_PUBLIC_API_BASE_URL=https://numu.com.pk/api
```

> These files are git-ignored on purpose — they never get committed.

---

## 4. Install, migrate, build, start
```bash
bash deploy/02-deploy.sh
```
This installs deps, runs DB migrations, builds the frontend (baking in your domain), and starts both apps under PM2. Then make PM2 survive reboots:
```bash
pm2 startup systemd -u $USER --hp $HOME    # run the command it prints back
pm2 save
```

---

## 5. Configure Nginx + HTTPS
The config already has `numu.com.pk` filled in — just install it:
```bash
sudo cp deploy/nginx-numu.conf /etc/nginx/sites-available/numu
sudo ln -sf /etc/nginx/sites-available/numu /etc/nginx/sites-enabled/numu
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Get free HTTPS (auto-renews). This rewrites the config to add port 443:
sudo certbot --nginx -d numu.com.pk -d www.numu.com.pk
```

---

## 6. Verify
```bash
curl -s https://numu.com.pk/health          # {"status":"ok",...}
pm2 status                                   # both apps 'online'
pm2 logs                                      # live logs
```
Open `https://numu.com.pk` in a browser — you should get the app with a valid padlock.

---

## Redeploying later
```bash
cd /var/www/numu
git pull                 # or rsync again
bash deploy/02-deploy.sh
```

## Troubleshooting
| Symptom | Check |
|---|---|
| 502 Bad Gateway | `pm2 status` / `pm2 logs` — an app crashed (often a bad `.env` value) |
| CORS errors in browser | `CLIENT_ORIGIN` in `backend/.env` must exactly equal `https://numu.com.pk` |
| Login emails not arriving | `RESEND_API_KEY` + a **verified** `EMAIL_FROM` domain in Resend |
| Socket not connecting | Confirm Nginx `/socket.io/` block + that you rebuilt after setting the domain |
| DB connection refused | `sudo systemctl status postgresql`; verify `backend/.env` DB_* values |
| Frontend shows localhost API | You changed the domain but didn't rebuild — rerun `deploy/02-deploy.sh` |
