from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import API_PREFIX, CORS_ORIGINS
from app.routers import comparisons, content, dataset, experiments, overview, system
from app.security import install_security_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm lightweight metadata caches without loading event-level data.
    from app.services import content as content_service

    content_service.research_status()
    content_service.experiment_registry()
    content_service.roadmap()
    yield


app = FastAPI(
    title="APT Detection Research API",
    description=(
        "Read-only research intelligence API over CICAPT-IIoT provenance experiments. "
        "All metrics are loaded from existing research artifacts; nothing is retrained."
    ),
    version=__version__,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

install_security_middleware(app)

for router in (
    overview.router,
    experiments.router,
    comparisons.router,
    dataset.router,
    content.router,
    system.router,
):
    app.include_router(router, prefix=API_PREFIX)


@app.get("/")
def root() -> dict:
    return {
        "name": "APT Detection Research API",
        "version": __version__,
        "docs": "/api/docs",
        "health": f"{API_PREFIX}/health",
        "read_only": True,
    }
