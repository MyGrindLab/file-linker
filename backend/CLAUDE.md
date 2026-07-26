# File Linker

FastAPI service for uploading , storing, and retrieving files via S3-compatible storage. Supports anonymous and paid user tiers with TTL-based file expiry.

## Architecture

Clean architecture with 4 layers:
- `app/src/api/` — HTTP endpoints (controllers)
- `app/src/domain/` — Business logic (services) and data models (schemas)
- `app/src/infrastructure/` — External dependencies (S3 client, MongoDB, scheduler)
- `app/src/core/` — Cross-cutting concerns (settings, exceptions, JWT security)

**File upload flow:** POST `/file/upload/` → optional auth → validate extension + size limit → upload to S3 → store metadata in MongoDB (with TTL) → return shareable link

**File retrieval flow:** GET `/file/{filename}/` → fetch from S3 → return `StreamingResponse`

**TTL cleanup:** APScheduler job runs every `CLEANUP_INTERVAL_HOURS`, finds expired records in MongoDB, deletes from S3 and MongoDB.

## User Tiers

| Tier | Max file size | TTL | Price |
|---|---|---|---|
| Anonymous (no token) | 10 MB | 1 day | Free |
| Registered (not paid) | 10 MB | 10 days | Free |
| Pro | 100 MB | Permanent | $2/month (Stripe subscription) |

## Tech Stack

- **Python 3.13**, **FastAPI**, **Uvicorn** (ASGI)
- **aioboto3** — async S3 client
- **motor** — async MongoDB driver
- **python-jose** — JWT auth
- **passlib[bcrypt]** — password hashing
- **stripe** — payment processing
- **httpx** — OAuth HTTP calls (Google, GitHub)
- **apscheduler** — in-process background job for TTL cleanup
- **pydantic-settings** — config management
- **uv** — package manager
- **Ruff** + **mypy** — linting/type checking
- **Docker** + **Docker Compose** — deployment

## Development

```bash
make startd    # Build and start in detached mode (port 10000)
make logs      # Stream container logs
make down      # Stop containers
make ruff      # Run linter
make mypy      # Run type checker
```

App runs on `http://localhost:10000`. Swagger UI at `/docs`.

## Environment Variables

Copy `build/.env.example` to `build/.env`:

| Variable | Description |
|---|---|
| `APP_NAME` | Application name |
| `DEBUG` | Debug mode (enables CORS allow-all) |
| `DOMAIN` | Domain for generating shareable links and OAuth redirect URIs |
| `STORAGE_PATH` | S3 endpoint URL |
| `STORAGE_USER` | AWS Access Key ID |
| `STORAGE_PASS` | AWS Secret Access Key |
| `STORAGE_BUCKET` | S3 bucket name |
| `MONGODB_URL` | MongoDB connection string (default: `mongodb://mongodb:27017`) |
| `MONGODB_DB` | Database name (default: `file_linker`) |
| `REDIS_HOST` | Redis host (default: `redis`) |
| `REDIS_PORT` | Redis port (default: `6379`) |
| `REDIS_USERNAME` | Redis username (optional) |
| `REDIS_PASSWORD` | Redis password (optional) |
| `JWT_SECRET` | Secret for signing JWTs |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_SUCCESS_URL` | Redirect URL after successful payment |
| `STRIPE_CANCEL_URL` | Redirect URL on payment cancel |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |

OAuth redirect URIs are auto-constructed as `{DOMAIN}/api/auth/{provider}/callback/`.

## Key Files

| File | Role |
|---|---|
| `app/main.py` | App setup, lifespan (DB init, scheduler), CORS, routers |
| `app/src/api/file.py` | Upload (`POST /file/upload/`) and download (`GET /file/{filename}/`) |
| `app/src/api/auth.py` | Register, login, Google/GitHub OAuth |
| `app/src/api/payment.py` | Stripe checkout (`POST /payment/checkout/`) and webhook |
| `app/src/core/security.py` | JWT encode/decode, `get_optional_user` / `get_current_user` deps |
| `app/src/domain/services/file.py` | Tier-aware upload (size check, TTL), retrieval |
| `app/src/domain/services/auth.py` | Register, login, OAuth find-or-create user |
| `app/src/domain/services/payment.py` | Stripe session creation, webhook handler |
| `app/src/infrastructure/database/mongo.py` | Motor client init/close/get |
| `app/src/infrastructure/storage/client.py` | Async S3 operations (upload, retrieve, delete) |
| `app/src/infrastructure/scheduler/cleanup.py` | APScheduler TTL cleanup job |

## MongoDB Collections

### `users`
```
{ _id, email, password, oauth_provider, oauth_id, is_paid, stripe_customer_id, created_at }
```

### `files`
```
{ _id, filename, user_id, size_bytes, expires_at, uploaded_at }
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/file/upload/` | Optional | Upload file (tier limits apply) |
| GET | `/file/{filename}/` | None | Download file |
| POST | `/auth/register/` | None | Email/password registration |
| POST | `/auth/login/` | None | Email/password login → JWT |
| GET | `/auth/google/` | None | Redirect to Google OAuth |
| GET | `/auth/google/callback/` | None | Google OAuth callback → JWT |
| GET | `/auth/github/` | None | Redirect to GitHub OAuth |
| GET | `/auth/github/callback/` | None | GitHub OAuth callback → JWT |
| POST | `/payment/checkout/` | Required | Create Stripe checkout session |
| POST | `/payment/webhook/` | Stripe sig | Stripe webhook (marks user paid) |
| GET | `/health/` | None | Health check |

## Supported File Types

- **Images:** jpg, jpeg, png, gif, webp
- **Videos:** mp4, webm, ogg
- **Documents:** pdf
- **Text:** html, txt, log, csv, json, xml

## CI/CD

GitHub Actions (`.github/workflows/backend-docker.yml`, at the monorepo root) builds and pushes a multi-arch Docker image to `ghcr.io` on push to `master`. Production image uses 4 Uvicorn workers.

## Pre-commit Hooks

Ruff and mypy run automatically on commit. Install with:

```bash
uv run pre-commit install
```
