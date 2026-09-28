import asyncio
import json
import re
from typing import Literal, TypedDict

import httpx
from pydantic import Field

from app.config import config
from app.models import CamelModel
from app.rag.retriever import MatchedChunk
from app.schemas import LoanApplication


class ChatMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


class EligibilityJudgment(CamelModel):
    eligible: bool
    reasons: list[str]
    matched_rules: list[str] = Field(alias="matched_rules")
    raw: str


async def wait_for_ollama(retries: int = 60, delay_s: float = 2.0) -> None:
    """Poll Ollama until /api/tags responds successfully."""
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=10) as client:
        for _ in range(retries):
            try:
                res = await client.get(f"{config.ollama_base_url}/api/tags")
                if res.is_success:
                    return
                last_error = RuntimeError(f"Ollama returned {res.status_code}")
            except httpx.HTTPError as err:
                last_error = err
            await asyncio.sleep(delay_s)

    raise RuntimeError(f"Ollama not reachable at {config.ollama_base_url}: {last_error}")


async def chat(messages: list[ChatMessage], temperature: float = 0.1) -> str:
    """Short one-shot chat completion via Ollama /api/chat."""
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{config.ollama_base_url}/api/chat",
            json={
                "model": config.llm_model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": 256},
            },
        )

    if not res.is_success:
        raise RuntimeError(f"LLM chat failed ({res.status_code}): {res.text}")

    data = res.json()
    return ((data.get("message") or {}).get("content") or "").strip()


async def judge_eligibility(
    application: LoanApplication, chunks: list[MatchedChunk]
) -> EligibilityJudgment:
    """Ask the LLM to judge eligibility using only retrieved guideline context."""
    context = "\n".join(f"[{i + 1}] {c.text}" for i, c in enumerate(chunks))
    customer = application.model_dump(by_alias=True, exclude={"full_name"})

    messages: list[ChatMessage] = [
        {
            "role": "system",
            "content": (
                "You are a loan eligibility checker. Use ONLY the given guidelines. "
                'Reply with JSON only: {"eligible":boolean,"reasons":string[],'
                '"matched_rules":string[]}. No extra text.'
            ),
        },
        {
            "role": "user",
            "content": (
                f"Guidelines:\n{context}\n\n"
                f"Applicant:\n{json.dumps(customer, separators=(',', ':'))}\n\nJSON:"
            ),
        },
    ]

    raw = await chat(messages)
    return parse_judgment(raw)


def parse_judgment(raw: str) -> EligibilityJudgment:
    fallback = EligibilityJudgment(
        eligible=False,
        reasons=["Could not parse model response"],
        matched_rules=[],
        raw=raw,
    )

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return fallback

    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return fallback
    if not isinstance(parsed, dict):
        return fallback

    reasons = parsed.get("reasons")
    matched_rules = parsed.get("matched_rules")
    return EligibilityJudgment(
        eligible=bool(parsed.get("eligible")),
        reasons=[str(r) for r in reasons] if isinstance(reasons, list) else [],
        matched_rules=[str(r) for r in matched_rules] if isinstance(matched_rules, list) else [],
        raw=raw,
    )
