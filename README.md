# Annotator — Frontend

A **React + Vite** single-page dashboard for the Annotator comment-annotation tool. Admins manage
accounts and assign datasets; annotators label every comment with a **sentiment**
(`positive` / `negative` / `neutral`) and a **type** (`bangla` / `english` / `banglish`). Annotations
are versioned, and any earlier version can be restored.

This repository is the **UI only**. It talks to the backend API in the sibling `Anotator-backend`
project through an `/api` proxy configured in `vite.config.js`.

## Table of contents

- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [npm scripts](#npm-scripts)
- [Environment variables](#environment-variables)
- [Dev-server proxy](#dev-server-proxy)
- [Project structure](#project-structure)
- [Routes](#routes)
- [Authentication & session](#authentication--session)
- [Backend availability (health gate)](#backend-availability-health-gate)
- [API layer](#api-layer)
- [UI conventions](#ui-conventions)
- [Known issues & cleanup candidates](#known-issues--cleanup-candidates)
- [Contributing](#contributing)
- [License](#license)

## Tech stack

| Concern            | Library / tool                                                           | Version              |
| ------------------ | ------------------------------------------------------------------------ | -------------------- |
| UI library         | [React](https://react.dev)                                               | `^19.2.8`            |
| Build & dev server | [Vite](https://vite.dev)                                                 | `^8.2.2`             |
| Routing            | [react-router-dom](https://reactrouter.com)                              | `^7.18.3`            |
| Server state       | [@tanstack/react-query](https://tanstack.com/query)                      | `^5.102.8`           |
| Styling            | [Tailwind CSS](https://tailwindcss.com) + [daisyUI](https://daisyui.com) | `^4.3.3` / `^5.7.36` |
| Forms              | [react-hook-form](https://react-hook-form.com)                           | `^7.87.0`            |
| HTTP client        | [axios](https://axios-http.com)                                          | `^1.20.0`            |
| Icons              | [lucide-react](https://lucide.dev)                                       | `^1.44.0`            |
| Alerts & dialogs   | [sweetalert2](https://sweetalert2.github.io)                             | `^11.10.5`           |
| Linting            | [ESLint](https://eslint.org) (flat config, `eslint.config.js`)           | `^10.9.0`            |

No TypeScript — the project is plain `.jsx` / `.js` with ESLint only.

## Requirements

- **Node.js** `^20.19.0 || >=22.12.0` (required by Vite 8). Verified locally with Node `v24.18.0` and
  npm `12.0.2`.
- A reachable **backend instance** (defaults to `http://localhost:5000`).

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Create a `.env` file in the project root (it is git-ignored, so you must create it yourself):

```dotenv
VITE_API_URL=http://localhost:5000/
```

### 3. Start the dev server

```bash
npm run dev
```

Vite prints the local URL (default <http://localhost:5173>). Because the app performs a health check on
boot, the backend must be running — otherwise you land on the *Service Unavailable* screen.

On a brand-new database, open `/bootstrap` first to create the initial admin account, then sign in.

## npm scripts

| Script          | Description                                           |
| --------------- | ----------------------------------------------------- |
| `npm run dev`   | Start the Vite dev server with hot module replacement. |
| `npm run build` | Produce a production build in `dist/`.                 |
| `npm run lint`  | Run ESLint over the whole project.                     |
| `npm run preview` | Serve the built `dist/` bundle locally.              |

## Environment variables

| Variable       | Purpose                                                                                                           | Example                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `VITE_API_URL` | Base URL of the backend. Read **only** by `vite.config.js` for the dev proxy — application code never reads it.    | `http://localhost:5000/` |

Application code always calls **relative** paths (`/api/...` and `/health`). In development the Vite
proxy forwards those to `VITE_API_URL`, which sidesteps CORS entirely. A production deployment must
either replicate the same `/api` and `/health` reverse-proxy routes or change `baseURL` in
`src/services/api.js` to an absolute URL.

## Dev-server proxy

`vite.config.js` loads the environment with `loadEnv(mode, import.meta.dirname, "")` and proxies two
prefixes to the backend:

```js
server: {
  proxy: {
    "/api":    { target: env.VITE_API_URL, changeOrigin: true },
    "/health": { target: env.VITE_API_URL, changeOrigin: true },
  },
}
```

## Project structure

```
Annotator-frontend/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── components/
│   │   ├── HealthGate.jsx          # /health check before the app renders
│   │   └── ProtectedRoute.jsx      # auth + admin-only route guard
│   ├── context/
│   │   ├── AuthContext.js          # createContext
│   │   ├── AuthProvider.jsx        # user/token state, login, logout
│   │   └── useAuth.js              # useContext hook
│   ├── layouts/
│   │   └── PublicLayout.jsx        # sticky header, sidebar nav, <Outlet />
│   ├── lib/
│   │   └── swal.js                 # sweetalert2 helpers styled with daisyUI
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── BootstrapPage.jsx   # one-time first-admin creation
│   │   │   └── LoginPage.jsx
│   │   ├── DatasetDetailPage.jsx   # annotation workspace
│   │   ├── DatasetsPage.jsx        # see "Known issues"
│   │   ├── NotFoundPage.jsx        # 404
│   │   ├── ServiceUnavailablePage.jsx
│   │   └── UsersPage.jsx           # admin-only user management
│   ├── services/
│   │   ├── api.js                  # axios instance + tokenStore
│   │   ├── authApi.js
│   │   ├── commentApi.js
│   │   ├── datasetApi.js
│   │   ├── getErrorMessage.js
│   │   ├── healthApi.js
│   │   └── userApi.js
│   ├── App.jsx                     # <Routes> definitions
│   ├── index.css                   # Tailwind + daisyUI setup
│   └── main.jsx                    # providers: QueryClient → Router → HealthGate → Auth
├── .env                            # git-ignored
├── eslint.config.js
├── index.html
├── package.json
└── vite.config.js
```

Provider nesting in `src/main.jsx` is significant: `QueryClientProvider` → `BrowserRouter` →
`HealthGate` → `AuthProvider` → `App`. `BrowserRouter` must wrap `HealthGate` because the gate
navigates, and `HealthGate` must wrap `AuthProvider` so no authenticated request is attempted while the
backend is known to be down.

## Routes

| Path                   | Component                | Access                 | Purpose                                             |
| ---------------------- | ------------------------ | ---------------------- | --------------------------------------------------- |
| `/login`               | `LoginPage`              | public                 | Email + password sign-in.                            |
| `/bootstrap`           | `BootstrapPage`          | public                 | Creates the first admin; disabled once one exists.   |
| `/service-unavailable` | `ServiceUnavailablePage` | public                 | Shown when `/health` fails; retries automatically.   |
| `/`                    | —                        | protected              | Redirects to `/datasets`.                            |
| `/datasets`            | `DatasetsPage`           | protected              | See [Known issues](#known-issues--cleanup-candidates). |
| `/datasets/:id`        | `DatasetDetailPage`      | protected              | Annotation workspace for one dataset.                |
| `/users`               | `UsersPage`              | protected (admin only) | Create / activate / delete users, reset passwords.   |
| `*`                    | `NotFoundPage`           | public                 | 404 with the attempted path.                         |

All protected routes render inside `PublicLayout`, which supplies the header, the Datasets/Users
sidebar (the Users link and Admin section appear only for `role === "admin"`) and the `<Outlet />`.

## Authentication & session

- The JWT is kept in `localStorage` under the key `annotator_token`, managed by `tokenStore` in
  `src/services/api.js` (`get` / `set` / `clear`).
- `AuthProvider` initialises `loading` from whether a token exists. If one does, it calls
  `GET /auth/me` to hydrate the user; on failure the token is cleared and the user is treated as signed
  out.
- `AuthProvider` exposes `user`, `loading`, `login`, `logout`, `isAuthenticated` and `isAdmin`.
- Every service call attaches the token **explicitly** via an `authHeader()` helper
  (`Authorization: Bearer <token>`) — there is no global axios request interceptor.
- `ProtectedRoute` renders a full-screen spinner while `loading`, redirects unauthenticated users to
  `/login`, and redirects non-admins away from `adminOnly` routes to `/`.
- **Sign in:** `login(email, password)` → `POST /auth/login` → stores `res.token`, sets `res.user`.
- **Sign out:** `logout()` calls `POST /auth/logout`, ignores any error from that call, then clears the
  stored token; `PublicLayout` navigates to `/login`.
- **First-run bootstrap:** `BootstrapPage` calls `GET /auth/bootstrap-status`; if `adminCount > 0` it
  shows an "Admin already exists" card instead of the form. Otherwise it collects name, email, password
  and confirmation, then `POST /auth/bootstrap` and redirects to `/login`. Password confirmation is
  validated client-side with react-hook-form's `useWatch`.

### User roles

| Role        | Capabilities                                                                                |
| ----------- | ------------------------------------------------------------------------------------------- |
| `admin`     | Everything: manage users, assign/unassign datasets, annotate, view history, delete comments. |
| `annotator` | Annotate the datasets assigned to them, view version history, restore versions.              |

`UsersPage` lets an admin create accounts (default role `annotator`), search by name or email,
activate/deactivate, reset a password, and delete a user. An admin cannot deactivate or delete their
own account — the delete action is guarded by comparing against the signed-in user's `_id`.

## Backend availability (health gate)

`HealthGate` avoids rendering the app against a dead API:

1. On mount it calls `checkHealth()` (`GET /health`, separate axios instance, 5-second timeout) and
   shows a "Connecting to server…" spinner meanwhile.
2. On success it renders the app. On failure it redirects to `/service-unavailable`, passing `reason`
   and the originating `from` path in router state.
3. `checkHealth()` distinguishes three failure modes, each with its own message: `503` (server up,
   database down), no response (server unreachable), and any other status.

`ServiceUnavailablePage` shows the reason, counts down from 15 seconds, re-checks `/health` on that
interval, offers a manual **Retry now** button, and navigates back to `from` as soon as a check
succeeds.

`HealthGate` also subscribes to a `window` event named `backend-down` so that a runtime outage can
force the same redirect. Note that **nothing currently dispatches that event** (see
[Known issues](#known-issues--cleanup-candidates)).

## API layer

All modules live in `src/services/`. `src/services/api.js` exports a shared axios instance with
`baseURL: "/api"` and a 30-second timeout, plus the `tokenStore` helper. `healthApi.js` intentionally
uses its own client with an empty `baseURL` so it can reach `/health` outside the `/api` prefix.

`src/services/getErrorMessage.js` provides a small fallback helper
(`err.response.data.error` → `err.message` → `"Something went wrong"`), though most components inline
that same expression instead.

<details>
<summary><strong>authApi.js</strong></summary>

| Function               | Method | Endpoint                 |
| ---------------------- | ------ | ------------------------ |
| `getBootstrapStatus()` | GET    | `/auth/bootstrap-status` |
| `bootstrapAdmin(data)` | POST   | `/auth/bootstrap`        |
| `login(data)`          | POST   | `/auth/login`            |
| `logout()`             | POST   | `/auth/logout`           |
| `getMe()`              | GET    | `/auth/me`               |

</details>

<details>
<summary><strong>datasetApi.js</strong></summary>

| Function                                | Method | Endpoint                  |
| --------------------------------------- | ------ | ------------------------- |
| `listDatasets(params)`                  | GET    | `/datasets`               |
| `getDataset(id)`                        | GET    | `/datasets/:id`           |
| `renameDataset(id, data)`               | PATCH  | `/datasets/:id`           |
| `assignDataset(id, assignedTo)`         | PATCH  | `/datasets/:id/assign`    |
| `duplicateDataset(id, name)`            | POST   | `/datasets/:id/duplicate` |
| `deleteDataset(id)`                     | DELETE | `/datasets/:id`           |
| `importDataset(file, name, onProgress)` | POST   | `/datasets/import` (`multipart/form-data`, reports upload progress) |

</details>

<details>
<summary><strong>commentApi.js</strong></summary>

| Function                             | Method | Endpoint                         |
| ------------------------------------ | ------ | -------------------------------- |
| `listComments(params)`               | GET    | `/comments`                      |
| `getComment(id)`                     | GET    | `/comments/:id`                  |
| `createComment(data)`                | POST   | `/comments`                      |
| `updateComment(id, data)`            | PATCH  | `/comments/:id`                  |
| `deleteComment(id)`                  | DELETE | `/comments/:id`                  |
| `annotateComment(id, data)`          | PATCH  | `/comments/:id/annotation`       |
| `getCommentVersions(id)`             | GET    | `/comments/:id/versions`         |
| `restoreCommentVersion(id, version)` | POST   | `/comments/:id/restore/:version` |
| `exportComments(params)`             | GET    | `/comments/export` (`responseType: "blob"`) |

</details>

<details>
<summary><strong>userApi.js</strong></summary>

| Function                      | Method | Endpoint                    |
| ----------------------------- | ------ | --------------------------- |
| `listUsers()`                 | GET    | `/users`                    |
| `getUser(id)`                 | GET    | `/users/:id`                |
| `createUser(data)`            | POST   | `/users`                    |
| `updateUser(id, data)`        | PATCH  | `/users/:id`                |
| `toggleUserStatus(id)`        | PATCH  | `/users/:id/status`         |
| `resetUserPassword(id, data)` | POST   | `/users/:id/reset-password` |
| `deleteUser(id)`              | DELETE | `/users/:id`                |

</details>

<details>
<summary><strong>healthApi.js</strong></summary>

| Function        | Method | Endpoint  | Notes                                                |
| --------------- | ------ | --------- | ---------------------------------------------------- |
| `checkHealth()` | GET    | `/health` | 5s timeout; returns `{ ok, reason? }` and never throws. |

</details>

## UI conventions

- **Styling:** daisyUI component classes (`card`, `btn`, `badge`, `alert`, `modal`, `navbar`, `loading`)
  combined with Tailwind utilities. `src/index.css` registers Tailwind and loads daisyUI with
  `themes: light --default`, so **light is the only available theme**.
- **Icons:** `lucide-react`, imported per page rather than from a barrel file.
- **Dialogs & feedback:** everything goes through `src/lib/swal.js`, which mixes sweetalert2 with daisyUI
  button classes and `buttonsStyling: false`. Available helpers: `toast`, `alertSuccess`, `alertError`,
  `alertInfo`, `confirmAction`, `confirmDelete`, `promptText` and `promptPasswordReset`. Destructive
  actions always go through `confirmAction` / `confirmDelete` first.
- **Loading states:** each screen ships its own skeleton components (for example `StatTile`,
  `DatasetDetailSkeleton`, `CommentsTableSkeleton`, `HistoryListSkeleton`) rather than one global
  spinner. Full-screen spinners are reserved for `ProtectedRoute` and `HealthGate`.
- **Server state:** TanStack Query only — no `useEffect` data fetching. Cache keys in use are
  `["users"]`, `["dataset", id]` and `["comments", params]`; mutations call
  `queryClient.invalidateQueries` afterwards.
- **Forms:** react-hook-form with inline validation messages (`errors.<field>.message`) and an
  `input-error` / `text-error` treatment on the offending field.
- **Accessibility:** inputs carry `autoComplete` hints, decorative icons inside inputs are marked
  `pointer-events-none`, and icon-only buttons use `title` attributes for labelling.

## Known issues & cleanup candidates

These are verified gaps in the current tree, worth addressing before treating the UI as complete:

1. **Duplicated dataset-detail screen.** `src/pages/DatasetsPage.jsx` (1132 lines) and
   `src/pages/DatasetDetailPage.jsx` (920 lines) are two variants of the same annotation view and
   **both** default-export a component named `DatasetDetailPage`. `DatasetsPage.jsx` is the newer,
   redesigned variant (it adds `StatTile`, status filtering, a page-size control, per-row saving state
   and `SnapshotChip`).
2. **No dataset list screen yet.** The `/datasets` route renders `src/pages/DatasetsPage.jsx`, which is
   the *detail* component and expects a `:id` route param (it guards its queries with `enabled: !!id`).
   A real landing/list page still needs to be built.
3. **Unused dataset services.** `listDatasets`, `importDataset`, `renameDataset`, `duplicateDataset`,
   `deleteDataset` and `exportComments` are defined but not referenced by any component, so import,
   rename, duplicate, delete and Excel export have no UI wired up yet.
4. **`backend-down` event has no dispatcher.** `HealthGate` listens for it, but no axios interceptor
   exists in `src/services/api.js`, so a backend outage that happens *after* boot only surfaces as
   individual request errors. Adding a response interceptor for network errors / `503` that dispatches
   the event would close the loop; a `401` handler that clears the token would also remove several
   copies of the same error handling.
5. **`context/context.js` at the repo root** duplicates `src/context/AuthContext.js` and is unused.
6. **Unused imports.** `ProtectedRoute.jsx` imports five `swal` helpers it never calls; the same was
   recently cleaned up in `PublicLayout.jsx`. `npm run lint` reports these as warnings because
   `no-unused-vars` is configured as `warn` in `eslint.config.js`.
7. **Bundle size.** The production bundle is ~515 kB (151 kB gzipped) and triggers Vite's >500 kB chunk
   warning. Route-level `React.lazy` splitting for `UsersPage` and the dataset pages would bring this
   down.

## Contributing

`eslint.config.js` enforces a small custom rule set beyond the React presets — `eqeqeq`, `no-undef`,
`no-redeclare`, `no-unreachable` and `no-debugger` are errors, while `no-console` and `no-unused-vars`
are warnings. Run `npm run lint` before committing.

## License

Private project — `"private": true` in `package.json`. Not published to npm.
