FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APT_REPO_ROOT=/app \
    APT_DEPLOYMENT_MODE=container \
    APT_DASHBOARD_HOST=0.0.0.0 \
    APT_DASHBOARD_PORT=8000

RUN groupadd --system app && useradd --system --gid app --create-home app

WORKDIR /app

COPY web/backend/requirements-runtime.txt /tmp/requirements-runtime.txt
RUN pip install --no-cache-dir -r /tmp/requirements-runtime.txt

# Preserve the repository layout so config.py resolves the same paths as local development.
COPY --chown=app:app web/backend/app /app/web/backend/app
COPY --chown=app:app web/content /app/web/content
COPY --chown=app:app results /app/results
COPY --chown=app:app data/processed/cicapt-iiot-v2 /app/data/processed/cicapt-iiot-v2
COPY --chown=app:app data/splits /app/data/splits

WORKDIR /app/web/backend
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*"]
