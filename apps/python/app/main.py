import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.db import close_pool, migrate
from app.llm.ollama import wait_for_ollama
from app.rag.ingest import ingest_guidelines
from app.routes import health, loan, rules
from app.routes.errors import error_response

logger = logging.getLogger("app")

VALIDATION_ERRORS = {
    "/api/check-eligibility": "Invalid application",
    "/api/rules": "Invalid rules payload",
}


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("Waiting for Postgres...")
    await migrate()

    logger.info("Waiting for Ollama...")
    await wait_for_ollama()
    logger.info("Ollama is ready.")

    logger.info("Ingesting guidelines...")
    count = await ingest_guidelines()
    logger.info("Indexed %d chunks.", count)

    yield
    await close_pool()


def _flatten(err: RequestValidationError) -> dict:
    """Shape validation errors like zod's `error.flatten()` used by the TS API."""
    form_errors: list[str] = []
    field_errors: dict[str, list[str]] = {}
    for issue in err.errors():
        loc = [str(p) for p in issue["loc"] if p != "body"]
        if loc:
            field_errors.setdefault(loc[0], []).append(issue["msg"])
        else:
            form_errors.append(issue["msg"])
    return {"formErrors": form_errors, "fieldErrors": field_errors}


def create_app(*, run_startup: bool = True) -> FastAPI:
    app = FastAPI(
        title="Loan Eligibility RAG API",
        version="2.0.0",
        lifespan=lifespan if run_startup else None,
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(loan.router, prefix="/api")
    app.include_router(rules.router, prefix="/api")

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, err: RequestValidationError):
        message = VALIDATION_ERRORS.get(request.url.path, "Invalid request")
        return error_response(400, message, _flatten(err))

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(_: Request, err: StarletteHTTPException):
        if err.status_code == 404:
            return error_response(404, "Not found")
        return error_response(err.status_code, str(err.detail))

    @app.exception_handler(Exception)
    async def _error_handler(_: Request, err: Exception):
        logger.exception("Unhandled error")
        return error_response(500, "Internal server error", str(err))

    return app


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
app = create_app()
