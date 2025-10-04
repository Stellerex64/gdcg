# GDCG Client (Vite)

## Local dev
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Open the printed local URL. Ensure the server is running (see ../server).

## Deploy (Vercel)
- Import the `client` folder as a Vercel project.
- Add env var `VITE_API_URL` pointing to your server (Render) URL, e.g. `https://api.yourdomain.com`.
- Deploy. Your app will be available at a Vercel URL; map a subdomain like `play.yourdomain.com`.

## Notes
- This is a minimal demo shell. Replace the demo controls with your React/Tailwind UI when ready.
