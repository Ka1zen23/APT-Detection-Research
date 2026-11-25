from __future__ import annotations

import secrets
from typing import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app import config

PUBLIC_API_PATHS = {
    f"{config.API_PREFIX}/health",
}


def auth_required() -> bool:
    return bool(config.API_KEY)


def install_security_middleware(app: FastAPI) -> None:
    """Protect data-bearing API routes with a service-to-service key.

    The Vercel proxy injects the key server-side. The health endpoint remains
    public so Fly.io and other container hosts can perform health checks.
    """

    @app.middleware("http")
    async def api_key_guard(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if not config.API_KEY:
            return await call_next(request)

        path = request.url.path
        protected = path.startswith(config.API_PREFIX) and path not in PUBLIC_API_PATHS
        if not protected or request.method == "OPTIONS":
            return await call_next(request)

        provided = request.headers.get("x-api-key", "")
        if provided and secrets.compare_digest(provided, config.API_KEY):
            return await call_next(request)

        return JSONResponse(
            status_code=401,
            content={"detail": "A valid X-API-Key header is required."},
            headers={"WWW-Authenticate": "ApiKey"},
        )
