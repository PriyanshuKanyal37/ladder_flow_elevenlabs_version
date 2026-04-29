# LadderFlow Backend (Path B)

FastAPI backend + LiveKit worker for the LadderFlow voice system.

## Stack

- FastAPI (HTTP API)
- LiveKit Agents worker (Path B)
- STT: Deepgram
- LLM: OpenAI
- TTS: ElevenLabs
- Postgres (users, interviews, memory)
- Neo4j (knowledge graph)

## Process Model

Start one API process:

```bash
python -m uvicorn app.main:app --port 8000
```

`app.main` launches `agent_worker.py` as a managed child process during startup.

## Health and Readiness

- `GET /health` -> status + `voice_worker_alive`
- `GET /ready` -> `200` only when worker is alive, else `503`

## Voice Session API

### `POST /agent-config`

Creates:

- personalized prompt/greeting
- interview row (status `INTERVIEWING`)
- signed LiveKit token

Returns:

- `token`, `livekitUrl`, `roomName`, `topicTitle`, `userName`, `greeting`, `interviewId`

### `POST /agent-dispatch`

Idempotent dispatch trigger, called after frontend joins the room.

- input: `{ interview_id }`
- reads room + dispatch metadata from interview outline
- creates LiveKit dispatch only once

### `POST /extract`

Queues memory extraction for an existing interview.

## Other APIs

- `POST /generate-linkedin`
- `POST /generate-twitter`
- `POST /generate-newsletter`
- `POST /api/research`
- onboarding/profile/user/auth/interviews routes

## Local Setup

```bash
cd voice-agent/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

Required env vars include:

- `OPENAI_API_KEY`
- `DEEPGRAM_API_KEY`
- `ELEVENLABS_API_KEY`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- DB + auth settings (`DATABASE_URL`, `SECRET_KEY`, etc.)

## Notes

- Path B only. Legacy `/transcript` formatting route was removed from runtime flow.
- Dispatch race is avoided by decoupling config and dispatch.
