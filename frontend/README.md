# File Linker — Frontend

React 18 SPA for uploading and sharing files. Supports anonymous uploads, JWT auth (email/password + Google/GitHub OAuth), file management, and Stripe payment upgrade.

## Quick Start

Everything runs in Docker — no host Node needed. Commands are run from the
**repo root**:

```bash
cp frontend/build/.env.example frontend/build/.env   # set VITE_API_BASE_URL
make up-frontend                                     # http://localhost:13000
```

## Features

- Upload files via file picker, drag & drop, or clipboard paste (Ctrl+V)
- Anonymous uploads: 10 MB max, 1-day links
- Registered uploads: 10 MB max, 10-day links
- Paid uploads: 100 MB max, permanent links
- Optional password protection on a file
- Manage your uploads at `/files` — replace contents, set/remove the password, delete
- Login / register with email and password (with email verification)
- OAuth login via Google and GitHub
- Account settings: change password, cancel subscription
- Upgrade to the paid tier via Stripe
- Preview images, video, PDF, and text files inline

## Environment Variables

`frontend/build/.env` (copy from `.env.example`):

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (e.g. `http://localhost:10000`) |

Vite only exposes variables prefixed `VITE_`, and inlines them at build time —
changing this value needs a rebuild (`make up-frontend` rebuilds).

## Development Commands

From the repo root:

```bash
make up-frontend     # build + start the dev server on http://localhost:13000
make sh-frontend     # shell into the container
make test-frontend   # vitest run, in the container
make lint-frontend   # eslint, in the container
make e2e             # bring the frontend up for Playwright-driven E2E
```

`make check` is not usable yet: the backend targets it depends on are still
unimplemented. The frontend gate is `make test-frontend && make lint-frontend`.

## Stack

React 18 · React Router DOM v7 · styled-components · Vite 5 · Vitest + @testing-library · ESLint 9 · Docker
