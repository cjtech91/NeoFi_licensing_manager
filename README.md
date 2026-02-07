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
