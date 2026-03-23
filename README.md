# Piso Wifi Management System

A comprehensive web-based management system for Piso Wifi vending machines.

## Features

- **Admin Dashboard**: Real-time sales monitoring and machine status.
- **Voucher Management**: Generate, list, and print wifi vouchers.
- **Machine Monitoring**: Track online/offline status of your machines.
- **Sales Reports**: View daily, weekly, and monthly revenue.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Realtime)
- **Deployment**: Cloudflare Pages

## Setup Instructions

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Setup Environment Variables**:
   Create a `.env` file with:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. **Run Development Server**: `npm run dev`

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

If you want every generated license (from the web UI) to also be saved into Cloudflare D1, bind a D1 database to the Cloudflare Pages project:

- Pages project → Settings → Functions → Bindings → D1 database
- Variable name: `LICENSE_DB`
- Apply schema from [cloudflare/license-worker/schema.sql](file:///c:/Users/CJTECH%20NADS/Documents/trae_projects/NeoFi_licensing_manager/cloudflare/license-worker/schema.sql)

The web UI calls `/api/d1-license-upsert` after license generation.
