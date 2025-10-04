# Game Design Card Game — Starter (Vercel + Render path)

This starter gives you:
- **server/** Node + Socket.IO (Render-ready)
- **client/** Vite web client (Vercel-ready)

## Quick Start (local)
1) **Server**
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
2) **Client**
```bash
cd client
cp .env.example .env   # ensure VITE_API_URL points to your server
npm install
npm run dev
```

## Deploy
- **Server → Render**: New Web Service from `server`, set env vars from `.env.example`, start command `npm start`.
- **Client → Vercel**: New Project from `client`, set `VITE_API_URL` to your server URL, deploy, map subdomain.

## Next Steps
- Swap the demo client UI with your React/Tailwind wireframe.
- Port the rule logic (commit timing, action timing, decks) into server events.
- Add rooms/room IDs to support multiple concurrent matches.
