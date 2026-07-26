FROM python:3.13-alpine AS base

COPY /app pyproject.toml uv.lock /app/
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.6.12 /uv /uvx /bin/

RUN uv sync --frozen --no-cache

EXPOSE 8080

ENV PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc

# Development
FROM base AS dev

CMD ["sh", "-c", "mkdir -p ${PROMETHEUS_MULTIPROC_DIR:?} && rm -rf ${PROMETHEUS_MULTIPROC_DIR:?}/* && exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --loop uvloop --reload"]

# Production
FROM base AS production

CMD ["sh", "-c", "mkdir -p ${PROMETHEUS_MULTIPROC_DIR:?} && rm -rf ${PROMETHEUS_MULTIPROC_DIR:?}/* && exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --loop uvloop --workers 4"]
