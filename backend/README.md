# File Linker — Backend

FastAPI service for uploading and sharing files via S3-compatible storage, with JWT auth, Google/GitHub OAuth, Stripe payments, and TTL-based file expiry.

## Quick Start

```bash
cp build/.env.example build/.env   # fill in required values
make startd
```

Swagger UI: `http://localhost:10000/docs`

## User Tiers

| Tier | Max size | Link lifetime |
|---|---|---|
| Anonymous | 5 MB | 7 days |
| Registered (free) | 5 MB | 7 days |
| Paid ($5 one-time) | 100 MB | 100 days |

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/file/upload/` | Optional | Upload file |
| `GET` | `/file/{filename}/` | — | Download file |
| `POST` | `/auth/register/` | — | Register with email/password |
| `POST` | `/auth/login/` | — | Login → JWT |
| `GET` | `/auth/google/` | — | Start Google OAuth |
| `GET` | `/auth/github/` | — | Start GitHub OAuth |
| `POST` | `/payment/checkout/` | Required | Create Stripe checkout session |
| `POST` | `/payment/webhook/` | Stripe sig | Stripe webhook |
| `GET` | `/health/` | — | Health check |
| `GET` | `/api/metrics` | — | Prometheus metrics |

## Environment Variables

| Variable | Description |
|---|---|
| `DOMAIN` | Backend public URL (used for OAuth redirect URIs and file links) |
| `FRONTEND_URL` | Frontend URL (OAuth callbacks redirect here) |
| `STORAGE_PATH` | S3 / MinIO endpoint URL |
| `STORAGE_USER` | S3 access key |
| `STORAGE_PASS` | S3 secret key |
| `STORAGE_BUCKET` | S3 bucket name |
| `MONGODB_URL` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_SUCCESS_URL` | Redirect after successful payment |
| `STRIPE_CANCEL_URL` | Redirect after cancelled payment |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth credentials |

## Development Commands

```bash
make startd    # build + start (detached, port 10000)
make logs      # stream logs
make down      # stop
make ruff      # lint
make mypy      # type-check
```

Prometheus scrapes the backend at `/api/metrics` from the Docker network. The
Prometheus container and scrape config live in the sibling
`file-linker-infrastructure` project.

## Stack

Python 3.13 · FastAPI · Motor (MongoDB) · aioboto3 (S3) · python-jose (JWT) · passlib (bcrypt) · Stripe · APScheduler · uv · Docker
