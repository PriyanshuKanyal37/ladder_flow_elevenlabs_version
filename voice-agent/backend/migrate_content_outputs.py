"""
One-time Postgres migration for weekly content packs.

Adds the content_outputs table plus interviews.content_pack_summary. Backfills
the legacy one-output-per-platform interview columns into content_outputs.

Run from: voice-agent/backend/
  python migrate_content_outputs.py
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
    "CREATE EXTENSION IF NOT EXISTS pgcrypto",
    "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS content_pack_summary JSONB",
    """
    CREATE TABLE IF NOT EXISTS content_outputs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        platform VARCHAR(30) NOT NULL,
        content_type VARCHAR(50) NOT NULL,

        title TEXT NULL,
        raw_content TEXT NOT NULL,
        edited_content TEXT NULL,

        status VARCHAR(20) NOT NULL DEFAULT 'generated',
        sort_order INTEGER NOT NULL DEFAULT 1,

        signal_snapshot JSONB NULL,
        generation_metadata JSONB NULL,

        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_content_outputs_interview_id
    ON content_outputs(interview_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_content_outputs_user_id
    ON content_outputs(user_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_content_outputs_interview_platform
    ON content_outputs(interview_id, platform)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_content_outputs_user_status
    ON content_outputs(user_id, status)
    """,
]


BACKFILL_STATEMENTS = [
    """
    INSERT INTO content_outputs (
        interview_id,
        user_id,
        platform,
        content_type,
        title,
        raw_content,
        status,
        sort_order,
        generation_metadata,
        created_at,
        updated_at
    )
    SELECT
        i.id,
        i.user_id,
        'linkedin',
        'linkedin_post',
        'Legacy LinkedIn post',
        i.linkedin_post,
        COALESCE(i.linkedin_status, 'generated'),
        1,
        jsonb_build_object('source', 'legacy_interviews_column'),
        i.created_at,
        COALESCE(i.linkedin_updated_at, i.updated_at)
    FROM interviews i
    WHERE i.linkedin_post IS NOT NULL
      AND btrim(i.linkedin_post) <> ''
      AND NOT EXISTS (
          SELECT 1
          FROM content_outputs co
          WHERE co.interview_id = i.id
            AND co.platform = 'linkedin'
            AND co.content_type = 'linkedin_post'
            AND co.sort_order = 1
      )
    """,
    """
    INSERT INTO content_outputs (
        interview_id,
        user_id,
        platform,
        content_type,
        title,
        raw_content,
        status,
        sort_order,
        generation_metadata,
        created_at,
        updated_at
    )
    SELECT
        i.id,
        i.user_id,
        'x',
        'x_thread',
        'Legacy X thread',
        i.twitter_thread,
        COALESCE(i.twitter_status, 'generated'),
        1,
        jsonb_build_object('source', 'legacy_interviews_column'),
        i.created_at,
        COALESCE(i.twitter_updated_at, i.updated_at)
    FROM interviews i
    WHERE i.twitter_thread IS NOT NULL
      AND btrim(i.twitter_thread) <> ''
      AND NOT EXISTS (
          SELECT 1
          FROM content_outputs co
          WHERE co.interview_id = i.id
            AND co.platform = 'x'
            AND co.content_type = 'x_thread'
            AND co.sort_order = 1
      )
    """,
    """
    INSERT INTO content_outputs (
        interview_id,
        user_id,
        platform,
        content_type,
        title,
        raw_content,
        status,
        sort_order,
        generation_metadata,
        created_at,
        updated_at
    )
    SELECT
        i.id,
        i.user_id,
        'newsletter',
        'newsletter_issue',
        'Legacy newsletter',
        i.newsletter_post,
        COALESCE(i.newsletter_status, 'generated'),
        1,
        jsonb_build_object('source', 'legacy_interviews_column'),
        i.created_at,
        COALESCE(i.newsletter_updated_at, i.updated_at)
    FROM interviews i
    WHERE i.newsletter_post IS NOT NULL
      AND btrim(i.newsletter_post) <> ''
      AND NOT EXISTS (
          SELECT 1
          FROM content_outputs co
          WHERE co.interview_id = i.id
            AND co.platform = 'newsletter'
            AND co.content_type = 'newsletter_issue'
            AND co.sort_order = 1
      )
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
    print("content_outputs migration complete.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
