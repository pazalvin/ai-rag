import asyncio
import logging

from app.config import config
from app.db import close_pool, get_pool
from app.rag.chunker import chunk_text
from app.rag.documents import list_guideline_files, load_guideline_text
from app.rag.embedder import embed_text, to_vector_literal
from app.rag.retriever import count_chunks

logger = logging.getLogger(__name__)


async def ingest_guidelines(force: bool = False) -> int:
    """Read guideline markdown/PDF files, chunk, embed, and store in Postgres (pgvector)."""
    if not config.guidelines_dir.exists():
        raise FileNotFoundError(f"Guidelines directory not found: {config.guidelines_dir}")

    files = list_guideline_files(config.guidelines_dir)
    if not files:
        raise FileNotFoundError("No guideline files found (.md, .txt, or .pdf)")

    count = await count_chunks()
    if not force and count > 0:
        logger.info("Using existing vector index (%d chunks).", count)
        return count

    pool = await get_pool()
    if count > 0:
        async with pool.connection() as conn:
            await conn.execute("TRUNCATE guideline_chunks RESTART IDENTITY")

    inserted = 0
    for file in files:
        text = load_guideline_text(config.guidelines_dir / file)
        chunks = chunk_text(text, config.chunk_size, config.chunk_overlap)
        logger.info("Embedding %d chunks from %s...", len(chunks), file)

        for chunk in chunks:
            embedding = await embed_text(chunk)
            async with pool.connection() as conn:
                await conn.execute(
                    "INSERT INTO guideline_chunks (source, content, embedding) "
                    "VALUES (%s, %s, %s::vector)",
                    (file, chunk, to_vector_literal(embedding)),
                )
            inserted += 1

    return inserted


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    async def _main() -> None:
        try:
            count = await ingest_guidelines(force=True)
            logger.info("Ingested %d chunks.", count)
        finally:
            await close_pool()

    asyncio.run(_main())
