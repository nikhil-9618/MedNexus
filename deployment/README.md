# deployment/README.md — MedNexus Deployment Record

## Stack

| Layer | Platform |
|---|---|
| Frontend | Vercel (React + Vite static build from `src/client`) |
| Backend | Render (Node.js + Express from `src/server`) |
| Database | MongoDB Atlas |

## Environment variables (production)

Set these on the host — never commit `.env`:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/mednexus
JWT_SECRET=<long random string, >=32 chars>
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-frontend.vercel.app
AI_API_KEY=            # optional — rule-based assistant is the default
```

The server refuses to boot in production without `MONGODB_URI` and a valid
`JWT_SECRET` (see `src/server/config/env.js`).

## Build & deploy

```bash
# Frontend
cd src/client
npm install
npm run build        # outputs static assets to src/client/dist
# → deploy src/client/dist to Vercel (framework preset: Vite)

# Backend
cd src/server
npm install --omit=dev
npm run seed         # one-time: synthetic demo data (skip in real deployments)
npm start
# → deploy src/server to Render (start command: npm start)
```

## Health check

```
GET /api/health  →  { "status": "ok", "service": "MedNexus API" }
```

## Notes

- CORS is restricted to `CLIENT_URL` (allow-list, never wildcard).
- Rate limits apply to login, registration, and sensitive APIs (429 on abuse).
- All seeded data is synthetic/demo. Do not load real patient data.
- Record the frozen commit SHA in `metadata/submission.yaml` before the deadline.
