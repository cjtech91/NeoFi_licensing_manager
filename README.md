# Piso Wifi Management System

A web-based licensing manager for NeoFi devices running on Cloudflare (Pages + Functions + D1 + KV).

## Features

- **Licenses**: Generate, bind/unbind, revoke, delete (Cloudflare D1).
- **Machine Monitoring**: Online/last-seen via heartbeats (Cloudflare KV).
- **License Logs**: View activation/validation/revocation logs (Cloudflare KV).

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Cloudflare Pages Functions
- **Storage**: Cloudflare D1 (licenses) + Cloudflare KV (heartbeats/logs)
- **Deployment**: Cloudflare Pages

## Setup Instructions

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Run Development Server**: `npm run dev`

## Deployment

This project is configured for **Cloudflare Pages**.
- Build Command: `npm run build`
- Build Output Directory: `dist`
- Root Directory: `/`

## Heartbeat (NeoFi device → Cloudflare)

To show near real-time device online status and last-seen timestamps on the website, the NeoFi device should send periodic heartbeats to your Cloudflare Worker endpoint:

- `POST https://<your-worker>/heartbeat`

This repository includes a ready-to-install systemd timer + script for OrangePi:

- [neofi-heartbeat.sh](file:///c:/Users/CJTECH%20NADS/Documents/trae_projects/NeoFi_licensing_manager/deploy/neofi-heartbeat.sh)
- [neofi-heartbeat.service](file:///c:/Users/CJTECH%20NADS/Documents/trae_projects/NeoFi_licensing_manager/deploy/neofi-heartbeat.service)
- [neofi-heartbeat.timer](file:///c:/Users/CJTECH%20NADS/Documents/trae_projects/NeoFi_licensing_manager/deploy/neofi-heartbeat.timer)
- [heartbeat.env.example](file:///c:/Users/CJTECH%20NADS/Documents/trae_projects/NeoFi_licensing_manager/deploy/heartbeat.env.example)

Device install (run on OrangePi):

```bash
sudo install -m 0755 neofi-heartbeat.sh /usr/local/bin/neofi-heartbeat.sh
sudo install -m 0644 neofi-heartbeat.service /etc/systemd/system/neofi-heartbeat.service
sudo install -m 0644 neofi-heartbeat.timer /etc/systemd/system/neofi-heartbeat.timer
sudo mkdir -p /etc/neofi
sudo cp heartbeat.env.example /etc/neofi/heartbeat.env
sudo nano /etc/neofi/heartbeat.env
sudo systemctl daemon-reload
sudo systemctl enable --now neofi-heartbeat.timer
```

Verify:

```bash
systemctl status neofi-heartbeat.timer
journalctl -u neofi-heartbeat.service -n 50 --no-pager
```

## D1 (always save generated licenses)

Bind a D1 database to the Cloudflare Pages project:

- Pages project → Settings → Functions → Bindings → D1 database
- Variable name: `LICENSE_DB`
- Apply schema from [cloudflare/license-worker/schema.sql](file:///c:/Users/CJTECH%20NADS/Documents/trae_projects/NeoFi_licensing_manager/cloudflare/license-worker/schema.sql)

The web UI uses D1 endpoints:

- `GET /api/licenses-list`
- `POST /api/licenses-generate`
- `POST /api/licenses-update`
- `POST /api/licenses-delete`

## Admin auth (Cloudflare only)

Set these Pages secrets:

- `ADMIN_PASSWORD` (login password)
- `ADMIN_TOKEN` (Bearer token used for API calls)
