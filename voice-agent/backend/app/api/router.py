from fastapi import APIRouter
from app.api import routes_audio
from app.api import routes_brain
from app.api import routes_social
from app.api import routes_research
from app.api import routes_users
from app.api import routes_interviews
from app.api import routes_posts
from app.api import routes_content_pack
from app.api import routes_content_outputs
from app.auth.auth_config import fastapi_users, auth_backend
from app.schemas.user_schemas import UserRead, UserCreate, UserUpdate

api_router = APIRouter()

api_router.include_router(routes_audio.router, tags=["audio"])
api_router.include_router(routes_brain.router, tags=["brain"])
api_router.include_router(routes_social.router, tags=["social"])
api_router.include_router(routes_research.router, prefix="/api", tags=["research"])
api_router.include_router(routes_users.router)
api_router.include_router(routes_interviews.router)
api_router.include_router(routes_posts.router)
api_router.include_router(routes_content_pack.router)
api_router.include_router(routes_content_outputs.router)

api_router.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth", tags=["auth"]
)
api_router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate), prefix="/auth", tags=["auth"]
)
api_router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate), prefix="/users", tags=["users"]
)
