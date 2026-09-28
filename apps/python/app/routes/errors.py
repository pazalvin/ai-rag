from typing import Any

from fastapi.responses import JSONResponse


def error_response(status_code: int, error: str, detail: Any = None) -> JSONResponse:
    body: dict[str, Any] = {"error": error}
    if detail is not None:
        body["detail"] = detail
    return JSONResponse(status_code=status_code, content=body)
