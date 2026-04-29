"""
One-time Postgres migration for posts/drafts/resume feature.

Adds per-platform status + updated_at columns to the interviews table, plus
last_saved_at and resume_state JSONB for draft/resume support. All additive —
existing rows keep working because every new column is nullable or defaulted.

Run from: voice-agent/backend/
  python migrate_posts_and_draft.py
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
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS linkedin_status    VARCHAR(20)",
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS twitter_status     VARCHAR(20)",
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS newsletter_status  VARCHAR(20)",
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS linkedin_updated_at   TIMESTAMPTZ",
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS twitter_updated_at    TIMESTAMPTZ",
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS newsletter_updated_at TIMESTAMPTZ",
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ",
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS resume_state JSONB",
]


BACKFILL_STATEMENTS = [
    # Any existing row that already has post content gets marked 'generated',
    # otherwise NULL. NULL is treated as "no post" by the posts list endpoint.
    """
    UPDATE interviews
    SET linkedin_status = 'generated'
    WHERE linkedin_status IS NULL AND linkedin_post IS NOT NULL AND btrim(linkedin_post) <> ''
    """,
    """
    UPDATE interviews
    SET twitter_status = 'generated'
    WHERE twitter_status IS NULL AND twitter_thread IS NOT NULL AND btrim(twitter_thread) <> ''
    """,
    """
    UPDATE interviews
    SET newsletter_status = 'generated'
    WHERE newsletter_status IS NULL AND newsletter_post IS NOT NULL AND btrim(newsletter_post) <> ''
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
    print("interviews posts/draft migration complete.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
