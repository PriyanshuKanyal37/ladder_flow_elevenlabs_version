"""
One-time migration: update existing Neo4j nodes to use new onboarding relationships.

Changes:
  - Removes old EXPERT_IN edges for niche/industry (from onboarding)
  - Creates SPECIALIZES_IN for niche topics
  - Creates OPERATES_IN for industry topics
  - Creates Audience nodes + SPEAKS_TO edges from target_audience property
  - Creates ContentStyle nodes + WRITES_IN edges from content_tone property

Run from: voice-agent/backend/
  python migrate_neo4j_onboarding.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))

from app.core.config import settings
from neo4j import GraphDatabase


def run():
    driver = GraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
    )

    with driver.session() as s:
        # Add new constraints for Audience and ContentStyle
        s.run("CREATE CONSTRAINT IF NOT EXISTS FOR (a:Audience) REQUIRE (a.user_id, a.name) IS UNIQUE")
        s.run("CREATE CONSTRAINT IF NOT EXISTS FOR (c:ContentStyle) REQUIRE (c.user_id, c.name) IS UNIQUE")
        print("Constraints added.")

        # Get all users with profile data
        users = s.run(
            """
            MATCH (u:User)
            WHERE u.niche IS NOT NULL OR u.industry IS NOT NULL
            RETURN u.user_id AS user_id, u.niche AS niche, u.industry AS industry,
                   u.target_audience AS target_audience, u.content_tone AS content_tone
            """
        ).data()

        print(f"Found {len(users)} users to migrate.")

        for u in users:
            uid = u["user_id"]
            niche = u.get("niche") or ""
            industry = u.get("industry") or ""
            audience = u.get("target_audience") or ""
            tone = u.get("content_tone") or ""

            # Remove old EXPERT_IN edges that were created from onboarding
            # (only remove niche/industry ones — EXPERT_IN from interviews stays)
            if niche:
                s.run(
                    """
                    MATCH (u:User {user_id: $uid})-[r:EXPERT_IN]->(t:Topic {user_id: $uid, name: $name, category: 'Niche'})
                    DELETE r
                    """,
                    uid=uid, name=niche,
                )
                # Create SPECIALIZES_IN
                s.run(
                    """
                    MERGE (u:User {user_id: $uid})
                    MERGE (t:Topic {user_id: $uid, name: $name})
                    SET t.category = 'Niche', t.depth = 'deep'
                    MERGE (u)-[:SPECIALIZES_IN]->(t)
                    """,
                    uid=uid, name=niche,
                )
                print(f"  [{uid[:8]}] SPECIALIZES_IN -> {niche}")

            if industry and industry != niche:
                s.run(
                    """
                    MATCH (u:User {user_id: $uid})-[r:EXPERT_IN]->(t:Topic {user_id: $uid, name: $name, category: 'Industry'})
                    DELETE r
                    """,
                    uid=uid, name=industry,
                )
                # Create OPERATES_IN
                s.run(
                    """
                    MERGE (u:User {user_id: $uid})
                    MERGE (t:Topic {user_id: $uid, name: $name})
                    SET t.category = 'Industry', t.depth = 'deep'
                    MERGE (u)-[:OPERATES_IN]->(t)
                    """,
                    uid=uid, name=industry,
                )
                print(f"  [{uid[:8]}] OPERATES_IN -> {industry}")

            if audience:
                s.run(
                    """
                    MERGE (u:User {user_id: $uid})
                    MERGE (a:Audience {user_id: $uid, name: $name})
                    MERGE (u)-[:SPEAKS_TO]->(a)
                    """,
                    uid=uid, name=audience,
                )
                print(f"  [{uid[:8]}] SPEAKS_TO -> {audience}")

            if tone:
                s.run(
                    """
                    MERGE (u:User {user_id: $uid})
                    MERGE (c:ContentStyle {user_id: $uid, name: $name})
                    MERGE (u)-[:WRITES_IN]->(c)
                    """,
                    uid=uid, name=tone,
                )
                print(f"  [{uid[:8]}] WRITES_IN -> {tone}")

    driver.close()
    print("\nMigration complete.")


if __name__ == "__main__":
    run()
