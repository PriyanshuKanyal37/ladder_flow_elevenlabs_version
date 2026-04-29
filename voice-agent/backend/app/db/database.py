import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Load connection string from environment variable
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(dotenv_path=env_path)
# Neon connection string
DATABASE_URL = os.environ.get("DATABASE_URL")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,           # turn off per-query SQL logging in production
    pool_pre_ping=True,   # test connection health before using it from the pool
    pool_recycle=300,     # recycle connections every 5 min to avoid stale handles
)

async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_async_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session
