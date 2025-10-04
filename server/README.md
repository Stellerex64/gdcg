# GDCG Server (Node + Socket.IO)

## Local dev
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Visit http://localhost:8080

## Deploy (Render)
- Create a new Web Service from this folder/repo
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables from `.env.example`
- Set ALLOWED_ORIGINS to your frontend URL(s), e.g. `https://play.yourdomain.com,https://your-vercel-app.vercel.app`
