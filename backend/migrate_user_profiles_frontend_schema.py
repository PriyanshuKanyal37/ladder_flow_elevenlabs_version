"""
One-time Postgres migration for the expanded frontend onboarding/settings schema.

Run from: voice-agent/backend/
  python migrate_user_profiles_frontend_schema.py
"""

import asyncio
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


def _database_url() -> str:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    load_dotenv(dotenv_path=env_path)
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")
    return database_url


DDL_STATEMENTS = [
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS icp TEXT",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS offer TEXT",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pain_solved TEXT",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS differentiator TEXT",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS primary_goal TEXT",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS posting_frequency TEXT",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS default_visibility VARCHAR(20)",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_analytics BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS proof_points JSONB",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tone JSONB",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS taboo_words JSONB",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cta_preferences JSONB",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS content_examples JSONB",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS key_themes JSONB",
    "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS platforms JSONB",
]


BACKFILL_STATEMENTS = [
    """
    UPDATE user_profiles
    SET default_visibility = 'private'
    WHERE default_visibility IS NULL
    """,
    """
    UPDATE user_profiles
    SET tone = to_jsonb(ARRAY[content_tone])
    WHERE tone IS NULL AND content_tone IS NOT NULL AND btrim(content_tone) <> ''
    """,
    """
    UPDATE user_profiles
    SET icp = target_audience
    WHERE icp IS NULL AND target_audience IS NOT NULL AND btrim(target_audience) <> ''
    """,
]


async def main() -> None:
    engine = create_async_engine(_database_url(), echo=False, pool_pre_ping=True)
    async with engine.begin() as conn:
        for statement in DDL_STATEMENTS:
            await conn.execute(text(statement))
        for statement in BACKFILL_STATEMENTS:
            await conn.execute(text(statement))
    await engine.dispose()
    print("user_profiles schema migration complete.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
