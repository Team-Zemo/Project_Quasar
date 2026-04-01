# Quasar Platform — Deployment Guide

> **Domains**  
> - Frontend: `https://quasar.teamzemo.tech`  
> - Backend API: `https://quasarserver.teamzemo.tech`  
> **Stack:** Ubuntu 22.04 · Node.js 20 LTS · Nginx · systemd · MongoDB Atlas

---

## 1. Server Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx & Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Verify
node -v   # v20.x.x
nginx -v
```

---

## 2. Deploy the Backend

```bash
# Create deployment directory
sudo mkdir -p /var/www/quasar-backend
sudo chown $USER:$USER /var/www/quasar-backend

# On the server — clone repo or copy files via scp:
# Option A (git on server):
cd /tmp && git clone https://github.com/Team-Zemo/Project_Quasar.git _q
cp -r _q/quasar-backend/* /var/www/quasar-backend/
rm -rf /tmp/_q

# Option B (scp from Windows — run in PowerShell locally):
# scp -r C:\Users\asus\IdeaProjects\Project_Quasar\quasar-backend\* user@SERVER_IP:/var/www/quasar-backend/

# Install production dependencies
cd /var/www/quasar-backend
npm install --omit=dev

# Upload .env (already configured with production values)
# scp C:\Users\asus\IdeaProjects\Project_Quasar\quasar-backend\.env user@SERVER_IP:/var/www/quasar-backend/.env
sudo chmod 600 /var/www/quasar-backend/.env
```

> [!IMPORTANT]
> **Replace the JWT secrets before deploying!**
> Generate strong secrets:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```
> Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env` to the generated values.

---

## 3. Deploy the Frontend

```bash
# Build locally (Windows PowerShell):
cd C:\Users\asus\IdeaProjects\Project_Quasar\quasar-frontend
npm run build
# Output: quasar-frontend\dist\

# Create web root on server
sudo mkdir -p /var/www/quasar-frontend/dist
sudo chown $USER:$USER /var/www/quasar-frontend/dist

# Upload built files
# scp -r C:\Users\asus\IdeaProjects\Project_Quasar\quasar-frontend\dist\* user@SERVER_IP:/var/www/quasar-frontend/dist/
```

---

## 4. Configure Nginx

```bash
# Copy both site configs from the repo
sudo cp /var/www/quasar-backend/../deploy/nginx/quasar.teamzemo.tech.conf       /etc/nginx/sites-available/
sudo cp /var/www/quasar-backend/../deploy/nginx/quasarserver.teamzemo.tech.conf /etc/nginx/sites-available/

# Enable both sites
sudo ln -sf /etc/nginx/sites-available/quasar.teamzemo.tech.conf       /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/quasarserver.teamzemo.tech.conf /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Obtain SSL Certificates

> Make sure both DNS A records point to your server IP before running certbot.

```bash
sudo certbot --nginx \
  -d quasar.teamzemo.tech \
  -d quasarserver.teamzemo.tech \
  --non-interactive --agree-tos \
  -m udaykhare77@gmail.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## 6. Install & Start the systemd Service

```bash
# Copy service unit
sudo cp /var/www/quasar-backend/../deploy/systemd/quasar-backend.service /etc/systemd/system/

# Set ownership
sudo chown -R www-data:www-data /var/www/quasar-backend

# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable quasar-backend
sudo systemctl start quasar-backend

# Verify
sudo systemctl status quasar-backend
sudo journalctl -u quasar-backend -f
```

---

## 7. Update OAuth Callback URLs

| Provider | New Callback URL |
|----------|-----------------|
| Google   | `https://quasarserver.teamzemo.tech/auth/google/callback` |
| GitHub   | `https://quasarserver.teamzemo.tech/auth/github/callback` |

Update these in **Google Cloud Console** → Credentials, and **GitHub** → OAuth Apps.

---

## 8. Verify Deployment

```bash
# Backend health
curl https://quasarserver.teamzemo.tech/health
# → {"success":true,"message":"Quasar Backend API Health Okay",...}

# Frontend — open in browser
# https://quasar.teamzemo.tech
```

---

## 9. Day-to-Day Operations

| Task | Command |
|------|---------|
| Restart backend | `sudo systemctl restart quasar-backend` |
| View backend logs | `sudo journalctl -u quasar-backend -f` |
| Reload Nginx | `sudo systemctl reload nginx` |
| Redeploy frontend | rebuild dist → scp → no restart needed |
| Redeploy backend | upload files → `sudo systemctl restart quasar-backend` |

---

## Server File Layout

```
/var/www/
├── quasar-backend/        ← Node.js API + WS server
│   ├── .env               ← production secrets  (chmod 600, never commit)
│   ├── index.js
│   ├── src/
│   └── node_modules/
└── quasar-frontend/
    └── dist/              ← Vite static build (served by Nginx directly)

/etc/nginx/sites-available/
├── quasar.teamzemo.tech.conf
└── quasarserver.teamzemo.tech.conf

/etc/systemd/system/
└── quasar-backend.service
```
