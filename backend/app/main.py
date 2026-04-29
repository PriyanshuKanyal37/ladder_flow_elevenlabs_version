"""LadderFlow unified backend entry point."""

import logging
from contextlib import asynccontextmanager

import uvicorn
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.services.neo4j_service import init_constraints

logging.getLogger("neo4j").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        init_constraints()
        logger.info("Neo4j constraints initialized")
    except Exception as exc:
        logger.warning(f"Neo4j init skipped: {exc}")

    yield


app = FastAPI(title="LadderFlow Podcast API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _elevenlabs_ready() -> tuple[bool, str | None]:
    if not settings.ELEVENLABS_API_KEY or not settings.ELEVENLABS_AGENT_ID:
        return False, "missing_elevenlabs_config"

    try:
        response = requests.get(
            "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
            params={"agent_id": settings.ELEVENLABS_AGENT_ID},
            headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
            timeout=8,
        )
    except requests.RequestException:
        return False, "elevenlabs_unreachable"

    if response.status_code == 401:
        return False, "elevenlabs_key_unauthorized"
    if not response.ok:
        return False, f"elevenlabs_error_{response.status_code}"
    return True, None


@app.get("/health")
def health():
    eleven_ready, eleven_reason = _elevenlabs_ready()
    return {
        "status": "ok" if eleven_ready else "degraded",
        "voice_runtime": "elevenagents",
        "eleven_ready": eleven_ready,
        "eleven_reason": eleven_reason,
    }


@app.get("/ready")
def ready():
    eleven_ready, eleven_reason = _elevenlabs_ready()
    if not eleven_ready:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "eleven_ready": False,
                "eleven_reason": eleven_reason,
            },
        )
    return {"status": "ready", "eleven_ready": True}


app.include_router(api_router)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
