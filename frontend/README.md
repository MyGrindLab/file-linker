# File Linker — Frontend

React 18 SPA for uploading and sharing files. Supports anonymous uploads, JWT auth (email/password + Google/GitHub OAuth), and Stripe payment upgrade.

## Quick Start

```bash
cp build/.env.example build/.env   # set REACT_APP_API_BASE_URL
make startd                         # start on http://localhost:13000
```

Or locally:

```bash
npm install
REACT_APP_API_BASE_URL=http://localhost:10000 npm start
```

## Features

- Upload files via file picker or clipboard paste (Ctrl+V)
- Anonymous uploads: 5 MB max, 7-day links
- Paid uploads: 100 MB max, 100-day links
- Login / register with email and password
- OAuth login via Google and GitHub
- Upgrade to paid tier via Stripe ($5 one-time)
- Preview images, video, PDF, and text files inline

## Environment Variables

| Variable | Description |
|---|---|
| `REACT_APP_API_BASE_URL` | Backend base URL (e.g. `http://localhost:10000`) |

## Development Commands

```bash
make startd    # build + start Docker (port 13000)
make logs      # stream logs
make down      # stop
npm start      # local dev server (port 3000)
npm run build  # production build
```

## Stack

React 18 · React Router DOM v7 · styled-components · Create React App · Docker
