# File Linker Frontend

React 18 SPA for the File Linker service. Handles file upload (with tier limits), viewing, auth (JWT + OAuth), file management, account settings, and Stripe payment upgrade.

## Tech Stack

- **React 18**, **React Router DOM v7**
- **styled-components** — all component styling
- **Vite 5** — build tooling and dev server (`vite.config.js`, ESM: `"type": "module"`)
- **Vitest 2 + @testing-library/react + jsdom** — tests (`test` block in `vite.config.js`, `vitest.setup.js`)
- **ESLint 9 flat config** — `eslint.config.js` (plain JS/JSX, no TypeScript)
- **Docker** — everything runs in a container; there is no host toolchain

## Dev Commands

Driven from the **root** `Makefile` — never run `npm` on the host.

```bash
make up-frontend     # build + start the dev server on http://localhost:13000
make sh-frontend     # shell into the container (falls back to a one-shot container)
make test-frontend   # vitest run, in the container
make lint-frontend   # eslint ., in the container
make e2e             # bring the frontend up for Playwright-MCP-driven E2E
```

`make check` (lint + test for the whole repo) is **not usable yet** — the backend
targets are still `$(TODO)` and fail loudly. The frontend gate is
`make test-frontend && make lint-frontend`.

Inside the container the underlying scripts are `npm start` (Vite dev server,
port 3000 → published as 13000), `npm run build`, `npm run test`, `npm run lint`.

## Project Structure

Entry point is `index.html` → `src/main.jsx` (`ReactDOM.createRoot`).

```
src/
├── main.jsx                  # Vite entry — mounts <App /> in StrictMode
├── App.jsx                   # AuthProvider + Toast + router
├── styles.css                # Global styles
├── context/
│   └── AuthContext.jsx       # Global JWT auth state (token, user, login, logout, refresh)
├── services/
│   └── api.js                # Fetch wrapper with auto Authorization header
├── hooks/
│   └── useMyFiles.js         # "My files" list: paging, fetch lifecycle, optimistic row edits
├── components/
│   ├── Navbar.jsx            # Sticky top nav — auth state, upgrade link, My files, Settings
│   ├── FileUploader.jsx      # Upload via file picker, drag & drop, or clipboard paste
│   ├── FileViewer.jsx        # Render images, video, PDF, text from URL
│   ├── Modal.jsx             # Generic accessible dialog (portal, focus trap, Esc, aria-*)
│   ├── Toast.jsx             # Transient messages, fed by utils/toast
│   ├── Seo.jsx               # Imperative <head> tags (title, description, og:, canonical)
│   └── files/                # /files page building blocks
│       ├── FileCard.jsx          # One file row: meta, copy link, action buttons
│       ├── Pagination.jsx        # Prev / "Page N of M" / Next; renders nothing on one page
│       ├── ReplaceFileDialog.jsx # Swap the stored bytes, keep the link
│       ├── PasswordDialog.jsx    # Set / change / remove the download password
│       └── DeleteFileDialog.jsx  # Destructive confirm
├── pages/
│   ├── HomePage.jsx          # Upload page with tier info + upgrade banner
│   ├── ViewPage.jsx          # File preview page
│   ├── FilesPage.jsx         # File management (see below)
│   ├── LoginPage.jsx         # Email/password + Google/GitHub OAuth
│   ├── RegisterPage.jsx      # Registration + email verification code
│   ├── AuthCallbackPage.jsx  # OAuth redirect handler (?token= → localStorage)
│   ├── SettingsPage.jsx      # Account info, change password, cancel subscription
│   ├── UpgradePage.jsx       # Free vs Pro comparison + Stripe checkout
│   └── MarketingPage.jsx     # Static content page renderer (src/data/marketingPages.js)
├── utils/
│   ├── apiError.js           # Response → always-safe message (FastAPI detail shapes)
│   ├── format.js             # formatBytes, formatDate, expiryLabel, fileExtension
│   └── toast.js              # subscribeToToasts / emitToast pub-sub
├── data/
│   └── marketingPages.js     # Marketing page definitions
└── __tests__/
    └── toolchain.smoke.test.jsx  # Harness smoke test — owned by the test setup
```

Component tests live next to what they test; only `src/**/*.{test,spec}.{js,jsx}` is collected.

## Auth Flow

1. **Email/password:** form → `POST /auth/login/` or `POST /auth/register/` → receive JWT → `AuthContext.login(token)`
2. **OAuth:** button → redirect to `{API}/auth/google/` → provider → backend callback → redirect to `/auth/callback?token=...` → `AuthCallbackPage` stores token
3. **JWT storage:** `localStorage` key `token`; decoded on load via `atob(token.split('.')[1])`
4. **Auth expiry:** checked on mount — expired tokens are cleared automatically
5. **Refresh:** `AuthContext.refresh()` calls `POST /auth/refresh/` and swaps in the new `access_token`

## User Tiers

The JWT payload includes `is_paid`. The frontend uses this to:
- Show tier limits in `FileUploader` (anonymous `10 MB / 1-day`, registered `10 MB / 10-day`, paid `100 MB / permanent`)
- Enforce the same size ceiling client-side in `ReplaceFileDialog`
- Show "Upgrade" CTA in `Navbar` and `HomePage`
- Gate `FilesPage`, `SettingsPage` and `UpgradePage` (redirect to `/login` if unauthenticated)

## API Service (`src/services/api.js`)

All authenticated requests go through `apiFetch()`, which injects
`Authorization: Bearer <token>` when logged in. A `401` clears the token and
reloads the page — those calls resolve to `undefined`, so callers must handle it.
A non-OK response emits its `error` field as a toast; callers add their own
inline messaging via `readApiError`.

Named exports:

| Export | Endpoint |
|---|---|
| `uploadFile(file, password?)` | `POST /file/upload/` |
| `listMyFiles(limit?, offset?, { signal }?)` | `GET /file/my/` |
| `replaceFileContent(shortId, file)` | `PUT /file/{short_id}/content/` |
| `setFilePassword(shortId, password)` | `PUT /file/{short_id}/password/` |
| `removeFilePassword(shortId)` | `DELETE /file/{short_id}/password/` |
| `deleteFile(shortId)` | `DELETE /file/{short_id}/` |
| `loginUser(email, password)` | `POST /auth/login/` |
| `registerUser(email, password)` | `POST /auth/register/` |
| `verifyEmail(email, code)` | `POST /auth/verify-email/` |
| `refreshToken()` | `POST /auth/refresh/` |
| `googleOAuthUrl()` / `githubOAuthUrl()` | `{API}/auth/google/`, `{API}/auth/github/` (URL builders) |
| `getMe()` | `GET /user/me/` |
| `changePassword(old_password, new_password)` | `PUT /user/password/` |
| `createCheckoutSession()` | `POST /payment/checkout/` |
| `cancelSubscription()` | `POST /payment/cancel/` |

The `FileInfo` / `FileListPage` shapes are documented as JSDoc typedefs in the
same file — keep them in sync with the backend schema.

## File Management (`/files`)

`FilesPage` lists the signed-in user's uploads and lets them act on each one. It
is `noindex` and redirects to `/login` when there is no user.

- **List** — `useMyFiles` (page size 20) owns fetching, paging, and in-place row
  edits. Every fetch has its own `AbortController` and a request id, so
  StrictMode double-invokes and fast paging can't write stale state.
- **States** — loading skeleton (`aria-busy`), error card with a retry button,
  empty card with an upload link, and the populated list.
- **Row actions** (`FileCard`) — copy link (with an `execCommand` fallback for
  insecure contexts), open, replace, password, delete.
- **Dialogs** are mounted only while open, so no state (a selected file, a typed
  password) survives a close. Each maps `404` to "file no longer exists" and
  tells the page to drop the stale row and refetch.
- **Delete** refetches rather than splicing, because the list is offset
  paginated; removing the last row of the last page steps back a page.

Endpoints consumed: `GET /file/my/`, `PUT /file/{short_id}/content/`,
`PUT /file/{short_id}/password/`, `DELETE /file/{short_id}/password/`,
`DELETE /file/{short_id}/`.

## Environment Variables

Copy `build/.env.example` to `build/.env`:

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (e.g. `http://localhost:10000`) |

Read in code as `import.meta.env.VITE_API_BASE_URL`. Vite only exposes variables
prefixed `VITE_`, and it inlines them **at build time** — changing it requires a
rebuild, not just a restart.

## Routes

| Path | Component | Description |
|---|---|---|
| `/` | `HomePage` | Upload + tier info |
| `/view/:filename` | `ViewPage` | File preview |
| `/login` | `LoginPage` | Sign in |
| `/register` | `RegisterPage` | Sign up + email verification |
| `/auth/callback` | `AuthCallbackPage` | OAuth token handler |
| `/upgrade` | `UpgradePage` | Stripe checkout |
| `/pricing` | `UpgradePage` | Same page, marketing-facing path |
| `/files` | `FilesPage` | Manage uploaded files (auth required) |
| `/settings` | `SettingsPage` | Account settings (auth required) |

## CI/CD

GitHub Actions (`.github/workflows/frontend-docker.yml`, at the monorepo root) builds and pushes the Docker image to `ghcr.io` on push to `master`.
