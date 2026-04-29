# Render Deployment Guide

This guide deploys the current MVP repo to Render with two services:

- `backend/` -> FastAPI Web Service
- `frontend/` -> Next.js Web Service

Repo URL:

```text
https://github.com/PriyanshuKanyal37/ladder_flow_elevenlabs_version.git
```

## 1. Deployment Flow

```mermaid
flowchart TD
    A[GitHub Repo] --> B[Render Backend Service]
    A --> C[Render Frontend Service]

    B --> D[(Postgres / Neon)]
    B --> E[(Neo4j Aura)]
    B --> F[OpenAI]
    B --> G[Anthropic]
    B --> H[Perplexity]
    B --> I[ElevenLabs Agent]
    B --> J[LiveKit]

    C --> K[Browser]
    K --> C
    C -->|BACKEND_URL proxy routes| B
    K -->|login/signup direct calls| B

    B --> L[/health]
    B --> M[/ready]
```

## 2. Before You Deploy

You need these accounts/services ready:

- GitHub repo pushed.
- Render account.
- Postgres database, recommended: Neon.
- Neo4j Aura database.
- ElevenLabs API key and Agent ID.
- OpenAI API key.
- Anthropic API key, needed for memory extraction and brain chat.
- Perplexity API key, needed for research/trending.
- LiveKit project, if your current voice flow still uses LiveKit settings.

Important:

- Never paste `.env` files into GitHub.
- Add secrets only inside Render environment variables.
- Deploy backend first, then frontend.

## 3. Backend Service

### 3.1 Create Backend Web Service

In Render:

1. Go to `New +`.
2. Choose `Web Service`.
3. Connect GitHub repo:

```text
PriyanshuKanyal37/ladder_flow_elevenlabs_version
```

4. Use these settings:

| Setting | Value |
|---|---|
| Name | `ladderflow-backend` |
| Runtime | `Python 3` |
| Root Directory | `backend` |
| Branch | `main` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free/Starter for MVP |

### 3.2 Backend Environment Variables

Add these in Render backend service -> `Environment`.

Required:

```env
PYTHON_VERSION=3.11.9
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME?ssl=require
SECRET_KEY=put-a-long-random-secret-here

OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
PERPLEXITY_API_KEY=your_perplexity_key

ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_AGENT_ID=your_elevenlabs_agent_id
ELEVENLABS_VOICE_ID=cjVigY5qzO86Huf0OWal

NEO4J_URI=neo4j+s://your-neo4j-host.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
```

If LiveKit is still used by your deployed flow, also add:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

Optional/unused unless you enable them:

```env
ANTHROPIC_API_KEY=your_anthropic_key
SUPABASE_URL=
SUPABASE_KEY=
```

### 3.3 Database URL Format

Your backend uses SQLAlchemy asyncpg, so the URL must start like this:

```text
postgresql+asyncpg://
```

If Neon gives you this:

```text
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Change it to:

```text
postgresql+asyncpg://USER:PASSWORD@HOST/DBNAME?ssl=require
```

Use the pooled Neon URL if available.

### 3.4 Deploy Backend

Click `Create Web Service`.

Wait until deploy finishes.

Then open:

```text
https://YOUR-BACKEND-SERVICE.onrender.com/health
```

Expected:

```json
{
  "status": "ok",
  "voice_runtime": "elevenagents",
  "eleven_ready": true
}
```

Also check:

```text
https://YOUR-BACKEND-SERVICE.onrender.com/ready
```

Expected:

```json
{
  "status": "ready",
  "eleven_ready": true
}
```

If `/ready` returns `503`, check:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- ElevenLabs account balance/agent status
- Render logs

## 4. Run Database Migrations

After backend deploy, open backend service in Render.

Use `Shell` or `Jobs` if available.

Run these from the backend root:

```bash
python migrate_user_profiles_frontend_schema.py
python migrate_posts_and_draft.py
python migrate_content_outputs.py
python migrate_neo4j_onboarding.py
```

If Render Shell is not available on your plan, run the same commands locally with production env vars set.

Minimum local example:

```bash
cd backend
set DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME?ssl=require
set OPENAI_API_KEY=your_openai_key
set ANTHROPIC_API_KEY=your_anthropic_key
set PERPLEXITY_API_KEY=your_perplexity_key
set ELEVENLABS_API_KEY=your_elevenlabs_key
set ELEVENLABS_AGENT_ID=your_agent_id
set NEO4J_URI=neo4j+s://your-neo4j-host.databases.neo4j.io
set NEO4J_USERNAME=neo4j
set NEO4J_PASSWORD=your_neo4j_password
python migrate_user_profiles_frontend_schema.py
python migrate_posts_and_draft.py
python migrate_content_outputs.py
python migrate_neo4j_onboarding.py
```

PowerShell version:

```powershell
cd backend
$env:DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME?ssl=require"
$env:OPENAI_API_KEY="your_openai_key"
$env:ANTHROPIC_API_KEY="your_anthropic_key"
$env:PERPLEXITY_API_KEY="your_perplexity_key"
$env:ELEVENLABS_API_KEY="your_elevenlabs_key"
$env:ELEVENLABS_AGENT_ID="your_agent_id"
$env:NEO4J_URI="neo4j+s://your-neo4j-host.databases.neo4j.io"
$env:NEO4J_USERNAME="neo4j"
$env:NEO4J_PASSWORD="your_neo4j_password"
python migrate_user_profiles_frontend_schema.py
python migrate_posts_and_draft.py
python migrate_content_outputs.py
python migrate_neo4j_onboarding.py
```

## 5. Frontend Service

### 5.1 Create Frontend Web Service

In Render:

1. Go to `New +`.
2. Choose `Web Service`.
3. Connect the same GitHub repo.
4. Use these settings:

| Setting | Value |
|---|---|
| Name | `ladderflow-frontend` |
| Runtime | `Node` |
| Root Directory | `frontend` |
| Branch | `main` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start -- -p $PORT` |
| Instance Type | Free/Starter for MVP |

### 5.2 Frontend Environment Variables

Add these in Render frontend service -> `Environment`.

```env
NODE_VERSION=22
BACKEND_URL=https://YOUR-BACKEND-SERVICE.onrender.com
NEXT_PUBLIC_API_BASE_URL=https://YOUR-BACKEND-SERVICE.onrender.com
```

Optional:

```env
TRENDING_API_URL=https://YOUR-BACKEND-SERVICE.onrender.com/api/research
```

Important:

- `BACKEND_URL` is used by Next.js server-side API proxy routes.
- `NEXT_PUBLIC_API_BASE_URL` is used by browser-side login/signup/onboarding calls.
- Do not include a trailing slash.

Correct:

```text
https://ladderflow-backend.onrender.com
```

Wrong:

```text
https://ladderflow-backend.onrender.com/
```

### 5.3 Deploy Frontend

Click `Create Web Service`.

After deploy, open:

```text
https://YOUR-FRONTEND-SERVICE.onrender.com
```

## 6. Post-Deploy Test Checklist

Test in this order.

### Backend Health

```text
GET https://YOUR-BACKEND-SERVICE.onrender.com/health
GET https://YOUR-BACKEND-SERVICE.onrender.com/ready
```

Both should work. `/ready` should be `200`.

### Auth

1. Open frontend.
2. Sign up with a test account.
3. Login.
4. Refresh page.
5. Confirm user stays logged in.

### Onboarding

1. Complete onboarding.
2. Check backend logs for errors.
3. Check Postgres `user_profiles`.
4. Check Neo4j user/profile nodes if needed.

### Voice Interview

1. Start one interview.
2. Confirm ElevenLabs voice connects.
3. Speak for 20-30 seconds.
4. End session using the red end button.
5. Confirm ElevenLabs active calls returns to `0`.
6. Confirm interview row exists in Postgres.
7. Confirm transcript/review page opens.

### Brain

1. Go to Brain page.
2. Confirm memories load.
3. Delete one test memory.
4. Refresh.
5. Confirm deleted memory does not return from Postgres or graph.

### Content Pack

1. Open review page.
2. Generate content.
3. Confirm LinkedIn/X/newsletter output appears.
4. Regenerate one item.
5. Confirm no `429` unless testing too fast.

## 7. Rate Limit Notes

Current MVP rate limiting is in-memory inside the backend process.

This is OK for:

- one Render backend instance
- MVP launch
- protecting against accidental rapid repeat calls

It is not enough for:

- multiple backend instances
- distributed scaling
- strict paid-credit budget control

Later production upgrade:

```text
Move rate limit storage from process memory -> Redis or Postgres.
```

## 8. Multi-User Voice Behavior

Current backend lock is per user, not global.

Meaning:

- Same user cannot accidentally start many voice sessions at once.
- Different users can start voice sessions at the same time.
- Real limit depends on ElevenLabs plan, Render instance size, Postgres connections, and API provider limits.

For MVP, expect a small group of users to work if:

- backend is on a paid Render instance or not sleeping
- Postgres pool is stable
- ElevenLabs has enough credits
- users are not repeatedly refreshing interview start

## 9. Common Render Problems

### Backend Build Fails

Check:

```text
Root Directory = backend
Build Command = pip install -r requirements.txt
```

### Backend Starts But `/ready` Is 503

Most likely:

- wrong `ELEVENLABS_API_KEY`
- wrong `ELEVENLABS_AGENT_ID`
- ElevenLabs agent deleted/disabled
- ElevenLabs account has no usable credits

### Login Fails From Frontend

Check frontend env:

```env
NEXT_PUBLIC_API_BASE_URL=https://YOUR-BACKEND-SERVICE.onrender.com
```

Then redeploy frontend. Next.js public env vars are baked during build.

### Frontend API Routes Fail

Check frontend env:

```env
BACKEND_URL=https://YOUR-BACKEND-SERVICE.onrender.com
```

### Database Connection Fails

Check:

- `DATABASE_URL` starts with `postgresql+asyncpg://`
- SSL is enabled: `?ssl=require`
- database allows external connections
- password has no unescaped special characters

### Cold Start Delay

Render free services sleep. First request can be slow.

For MVP demo, use paid Starter instance for backend at minimum.

## 10. Deployment Order

Use this exact order:

```mermaid
flowchart TD
    A[Push latest code to GitHub] --> B[Create backend Render service]
    B --> C[Add backend env vars]
    C --> D[Deploy backend]
    D --> E[Test /health and /ready]
    E --> F[Run DB migrations]
    F --> G[Create frontend Render service]
    G --> H[Add frontend BACKEND_URL and NEXT_PUBLIC_API_BASE_URL]
    H --> I[Deploy frontend]
    I --> J[Test signup/login/onboarding]
    J --> K[Test voice interview]
    K --> L[Test review/content/brain]
```

## 11. Final MVP Go/No-Go Checklist

Go live only if all are true:

- Backend `/ready` returns `200`.
- Frontend can login/signup.
- Onboarding saves successfully.
- One interview starts and ends cleanly.
- ElevenLabs active calls returns to `0` after ending.
- Review page generates content.
- Brain page loads without deleted memories reappearing.
- Render logs show no repeated 500 errors.
- No `.env` files are committed.

## 12. Useful Commands

Backend local production-like run:

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend local production-like run:

```bash
cd frontend
npm ci
npm run build
npm run start -- -p 3000
```

Git push after doc/code changes:

```bash
git add RENDER_DEPLOYMENT_GUIDE.md
git commit -m "Add Render deployment guide"
git push
```
