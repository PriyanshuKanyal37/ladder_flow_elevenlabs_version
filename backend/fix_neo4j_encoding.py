"""
One-time migration: fix UTF-8 Mojibake in Neo4j Memory.content nodes.

Root cause: em dashes and smart quotes (UTF-8 bytes E2 80 94 etc.) were
stored as if they were Latin-1/Windows-1252 characters, producing â€" instead
of —. The Python neo4j driver is UTF-8 native so new writes are clean.
This script fixes only the existing corrupted records.

Run once:
    cd voice-agent/backend
    python fix_neo4j_encoding.py
"""

from neo4j import GraphDatabase
from app.core.config import settings


def fix_mojibake(text: str) -> str:
    """
    Reverses Latin-1-over-UTF-8 Mojibake.
    Safe: returns original string unchanged on any encode/decode failure,
    so already-clean ASCII or real UTF-8 content is never corrupted.
    """
    if not text:
        return text
    # Must use cp1252 (Windows-1252), not latin-1:
    # The euro sign € (U+20AC) maps to byte 0x80 in cp1252 but has no
    # representation in Latin-1 (which only covers U+0000–U+00FF).
    # Em dash UTF-8 bytes are E2 80 94 → cp1252 chars â € " → this reverses it.
    try:
        return text.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def main() -> None:
    driver = GraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
    )

    fixed_count = 0
    skipped_count = 0

    with driver.session() as s:
        records = list(
            s.run(
                "MATCH (m:Memory) WHERE m.content IS NOT NULL "
                "RETURN m.neon_id AS neon_id, m.content AS content"
            )
        )

        for r in records:
            original: str = r["content"]
            repaired: str = fix_mojibake(original)

            if repaired == original:
                skipped_count += 1
                continue

            s.run(
                "MATCH (m:Memory {neon_id: $neon_id}) SET m.content = $content",
                neon_id=r["neon_id"],
                content=repaired,
            )
            fixed_count += 1
            print(f"[FIXED]   {original[:60]!r}")
            print(f"       -> {repaired[:60]!r}\n")

    driver.close()
    print(f"Done. Fixed: {fixed_count}  Already clean: {skipped_count}")


if __name__ == "__main__":
    main()
