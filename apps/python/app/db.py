import asyncio
import logging

from psycopg_pool import AsyncConnectionPool

from app.config import config

logger = logging.getLogger(__name__)

_pool: AsyncConnectionPool | None = None


async def get_pool() -> AsyncConnectionPool:
    global _pool
    if _pool is None:
        _pool = AsyncConnectionPool(
            config.database_url,
            min_size=1,
            max_size=10,
            max_idle=20,
            timeout=30,
            open=False,
        )
        await _pool.open()
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


MIGRATIONS = [
    "CREATE EXTENSION IF NOT EXISTS vector",
    f"""
    CREATE TABLE IF NOT EXISTS guideline_chunks (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding vector({config.embedding_dimensions}) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS guideline_chunks_source_idx
    ON guideline_chunks (source)
    """,
    """
    CREATE INDEX IF NOT EXISTS guideline_chunks_embedding_hnsw_idx
    ON guideline_chunks
    USING hnsw (embedding vector_cosine_ops)
    """,
    """
    CREATE TABLE IF NOT EXISTS loan_applications (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      monthly_income INTEGER NOT NULL,
      employment_status TEXT NOT NULL,
      months_employed INTEGER NOT NULL DEFAULT 0,
      loan_amount INTEGER NOT NULL,
      loan_term_months INTEGER NOT NULL,
      credit_score INTEGER NOT NULL,
      existing_debt INTEGER NOT NULL,
      eligible BOOLEAN,
      reasons JSONB,
      matched_rules JSONB,
      matched_chunk_ids JSONB,
      similarity_scores JSONB,
      raw_llm TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    ALTER TABLE loan_applications
    ADD COLUMN IF NOT EXISTS months_employed INTEGER NOT NULL DEFAULT 0
    """,
]


async def migrate(retries: int = 30, delay_s: float = 2.0) -> None:
    """Ensure pgvector + tables exist. Safe to run on every boot."""
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                for statement in MIGRATIONS:
                    await conn.execute(statement)
            logger.info("Database migrations applied.")
            return
        except Exception as err:  # noqa: BLE001
            last_error = err
            logger.warning("Waiting for Postgres... (%d/%d) %s", attempt + 1, retries, err)
            await close_pool()
            await asyncio.sleep(delay_s)

    raise RuntimeError(f"Database migration failed: {last_error}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    async def _main() -> None:
        try:
            await migrate()
        finally:
            await close_pool()

    asyncio.run(_main())
