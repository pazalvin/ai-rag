from fastapi import APIRouter

from app.config import config
from app.rag.retriever import count_chunks

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "llmModel": config.llm_model,
        "embedModel": config.embed_model,
        "indexedChunks": await count_chunks(),
    }
