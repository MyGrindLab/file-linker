# File Linker Frontend

React 18 SPA for the File Linker service. Handles file upload (with tier limits), viewing, auth (JWT + OAuth), and Stripe payment upgrade.

## Tech Stack

- **React 18**, **React Router DOM v7**
- **styled-components** — all component styling
- **Create React App** (`react-scripts`) — build tooling
- **Docker** — containerized deployment

## Dev Commands

```bash
npm start          # start dev server (port 3000)
npm run build      # production build
make startd        # start via Docker Compose (port 13000)
make logs          # stream container logs
make down          # stop containers
```

## Project Structure

```
src/
├── context/
│   └── AuthContext.jsx      # Global JWT auth state (login, logout, user)
├── services/
│   └── api.js               # Fetch wrapper with auto Authorization header
├── components/
│   ├── Navbar.jsx            # Sticky top nav — auth state, upgrade link
│   ├── FileUploader.jsx      # Upload via file picker or clipboard paste
│   └── FileViewer.jsx        # Render images, video, PDF, text from URL
└── pages/
    ├── HomePage.jsx          # Upload page with tier info + upgrade banner
    ├── ViewPage.jsx          # File preview page
    ├── LoginPage.jsx         # Email/password + Google/GitHub OAuth
    ├── RegisterPage.jsx      # Email/password registration
    ├── AuthCallbackPage.jsx  # OAuth redirect handler (?token= → localStorage)
    └── UpgradePage.jsx       # Free vs Pro comparison + Stripe checkout
```

## Auth Flow

1. **Email/password:** form → `POST /auth/login/` or `POST /auth/register/` → receive JWT → `AuthContext.login(token)`
2. **OAuth:** button → redirect to `{API}/auth/google/` → Google → backend callback → redirect to `/auth/callback?token=...` → `AuthCallbackPage` stores token
3. **JWT storage:** `localStorage` key `token`; decoded on load via `atob(token.split('.')[1])`
4. **Auth expiry:** checked on mount — expired tokens are cleared automatically

## User Tiers

The JWT payload includes `is_paid`. The frontend uses this to:
- Show tier limits in `FileUploader` (`5 MB / 7-day` vs `100 MB / 100-day`)
- Show "Upgrade" CTA in `Navbar` and `HomePage`
- Gate the `UpgradePage` (redirect to `/login` if unauthenticated)

## API Service (`src/services/api.js`)

All requests go through `apiFetch()` which injects `Authorization: Bearer <token>` when logged in. A `401` response automatically clears the token and reloads the page.

Named exports: `uploadFile(file)`, `createCheckoutSession()`, `loginUser(email, password)`, `registerUser(email, password)`, `googleOAuthUrl()`, `githubOAuthUrl()`.

## Environment Variables

Copy `build/.env.example` to `build/.env`:

| Variable | Description |
|---|---|
| `REACT_APP_API_BASE_URL` | Backend base URL (e.g. `http://localhost:10000`) |

## Routes

| Path | Component | Description |
|---|---|---|
| `/` | `HomePage` | Upload + tier info |
| `/view/:filename` | `ViewPage` | File preview |
| `/login` | `LoginPage` | Sign in |
| `/register` | `RegisterPage` | Sign up |
| `/auth/callback` | `AuthCallbackPage` | OAuth token handler |
| `/upgrade` | `UpgradePage` | Stripe checkout |

## CI/CD

GitHub Actions (`.github/workflows/frontend-docker.yml`, at the monorepo root) builds and pushes the Docker image to `ghcr.io` on push to `master`.
