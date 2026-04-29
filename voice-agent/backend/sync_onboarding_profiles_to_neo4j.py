"""
Backfill onboarding profiles from Neon -> Neo4j.

Use this after deploying onboarding/KG changes or when auditing data drift.

Run from: voice-agent/backend/
  python sync_onboarding_profiles_to_neo4j.py
"""

import asyncio
import os
import sys

import asyncpg
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))
load_dotenv(".env")

from app.services.neo4j_service import init_constraints, sync_onboarding_to_neo4j  # noqa: E402


QUERY = """
SELECT
    u.id::text AS user_id,
    u.email,
    u.full_name,
    up.niche,
    up.industry,
    up.content_tone,
    up.target_audience,
    up.bio,
    up.icp,
    up.offer,
    up.pain_solved,
    up.differentiator,
    up.primary_goal,
    up.key_themes,
    up.platforms
FROM users u
JOIN user_profiles up ON up.user_id = u.id
WHERE up.onboarding_completed = true
ORDER BY up.updated_at DESC
"""


async def main():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")

    init_constraints()

    conn = await asyncpg.connect(dsn=dsn, timeout=30)
    rows = await conn.fetch(QUERY)
    await conn.close()

    print(f"Found {len(rows)} onboarding-complete users in Neon.")

    ok = 0
    failed = 0

    for row in rows:
        user_id = row["user_id"]
        try:
            sync_onboarding_to_neo4j(
                user_id=user_id,
                niche=row["niche"],
                industry=row["industry"],
                content_tone=row["content_tone"],
                target_audience=row["target_audience"],
                display_name=row["full_name"],
                bio=row["bio"],
                icp=row["icp"],
                offer=row["offer"],
                pain_solved=row["pain_solved"],
                differentiator=row["differentiator"],
                primary_goal=row["primary_goal"],
                key_themes=row["key_themes"] or [],
                platforms=row["platforms"] or [],
            )
            ok += 1
            print(f"[OK] {row['email']} ({user_id})")
        except Exception as exc:
            failed += 1
            print(f"[FAIL] {row['email']} ({user_id}) -> {exc}")

    print(f"Done. Success={ok}, Failed={failed}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
