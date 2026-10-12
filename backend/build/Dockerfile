FROM python:3.13-alpine AS base

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.6.12 /uv /uvx /bin/

# Dependencies first so source edits don't invalidate this layer.
# --no-dev keeps the test tooling (dev group) out of the production image.
COPY pyproject.toml uv.lock /app/
RUN uv sync --frozen --no-cache --no-dev

COPY /app /app/

EXPOSE 8080

ENV PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc

# Test / lint (used by `make lint-backend` and `make test-backend`)
FROM base AS test

RUN uv sync --frozen --no-cache
COPY tests /app/tests

# Development
FROM base AS dev

CMD ["sh", "-c", "mkdir -p ${PROMETHEUS_MULTIPROC_DIR:?} && rm -rf ${PROMETHEUS_MULTIPROC_DIR:?}/* && exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --loop uvloop --reload"]

# Production
FROM base AS production

CMD ["sh", "-c", "mkdir -p ${PROMETHEUS_MULTIPROC_DIR:?} && rm -rf ${PROMETHEUS_MULTIPROC_DIR:?}/* && exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080 --loop uvloop --workers 4"]
