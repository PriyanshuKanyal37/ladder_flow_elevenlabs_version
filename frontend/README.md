# LadderFlow Frontend (Path B)

Next.js frontend for the LadderFlow voice interview flow.

## Runtime Architecture

- Voice transport: LiveKit room connection from browser
- Agent backend: FastAPI + LiveKit worker (Path B)
- Transcript UX:
  - interim captions from `RoomEvent.TranscriptionReceived`
  - committed transcript from worker data-channel `type: "transcript"`
- Session persistence:
  - interview row is created at `/agent-config`
  - dispatch happens after room join via `/agent-dispatch`

## Main Flow

1. `/discover` -> `/discover/trending`
2. `/interview/new` calls `/api/agent/config`
3. `/interview` connects to LiveKit and then calls `/api/agent/dispatch`
4. User ends session -> pending review snapshot in sessionStorage
5. `/review/new` generates content and patches existing interview row

## Key API Proxies (Next.js)

- `POST /api/agent/config` -> backend `/agent-config`
- `POST /api/agent/dispatch` -> backend `/agent-dispatch`
- `POST /api/agent/extract` -> backend `/extract`
- `GET/POST/PATCH /api/interviews*` -> backend interview routes
- `POST /api/content/*` -> backend content generation routes
- `POST /api/trending` -> backend research route
- `GET /api/me`, `GET /api/users/profile`, `POST /api/users/onboarding`

## Environment

Set in frontend runtime:

- `BACKEND_URL` (default `http://localhost:8000`)
- `TRENDING_API_URL` (optional override)

## Local Dev

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
npm run build
npm run lint
```

## Notes

- This frontend is Path B only. Legacy Deepgram interview client paths were removed.
- Auth guard validates token with `/api/me` instead of token-presence only.
