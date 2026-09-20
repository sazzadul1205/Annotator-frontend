# Annotator — Frontend

A **React + Vite** single-page dashboard for the Annotator comment-annotation tool. Admins manage
accounts, define reusable **taxonomies** (custom sentiment + language label sets), assign datasets,
configure imports, inspect audit logs, and view analytics; annotators label every comment with one
value from each axis. Annotations are versioned, and any earlier version can be restored.

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
- [Feature surface](#feature-surface)
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
| Charts             | [recharts](https://recharts.org)                                         | `^2.x`               |
| Alerts & dialogs   | [sweetalert2](https://sweetalert2.github.io)                             | `^11.10.5`           |
| Linting            | [ESLint](https://eslint.org) (flat config, `eslint.config.js`)           | `^10.9.0`            |

No TypeScript — the project is plain `.jsx` / `.js` with ESLint only.

## Requirements

- **Node.js** `^20.19.0 || >=22.12.0` (required by Vite 8).
- A reachable **backend instance** (defaults to `http://localhost:5000`).

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Create a `.env` file in the project root:

```dotenv
VITE_API_URL=http://localhost:5000/
```

### 3. Start the dev server

```bash
npm run dev
```

Vite prints the local URL (default <http://localhost:5173>). Because the app performs a health check
on boot, the backend must be running — otherwise you land on the _Service Unavailable_ screen.

On a brand-new database, open `/bootstrap` first to create the initial admin account, then sign in.

## npm scripts

| Script            | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Start the Vite dev server with hot module replacement. |
| `npm run build`   | Produce a production build in `dist/`.                 |
| `npm run lint`    | Run ESLint over the whole project.                     |
| `npm run preview` | Serve the built `dist/` bundle locally.                |

## Environment variables

| Variable       | Purpose                                                                                                         | Example                  |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `VITE_API_URL` | Base URL of the backend. Read **only** by `vite.config.js` for the dev proxy — application code never reads it. | `http://localhost:5000/` |

Application code always calls **relative** paths (`/api/...` and `/health`). In development the Vite
proxy forwards those to `VITE_API_URL`, sidestepping CORS. A production deployment must either
replicate the same `/api` and `/health` reverse-proxy routes or change `baseURL` in
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
│   │   ├── HealthGate.jsx              # /health check before the app renders
│   │   ├── ImportPreviewModal.jsx      # preview + dedupe strategy + taxonomy picker
│   │   └── ProtectedRoute.jsx          # auth + admin-only route guard
│   ├── context/
│   │   ├── AuthContext.js              # createContext
│   │   ├── AuthProvider.jsx            # user/token state, login, logout
│   │   └── useAuth.js                  # useContext hook
│   ├── hooks/
│   │   └── useDatasetTaxonomy.js       # resolves effective taxonomy for a dataset
│   ├── layouts/
│   │   └── PublicLayout.jsx            # sticky header, sidebar nav, <Outlet />
│   ├── lib/
│   │   ├── datasetStatus.js            # import-status → display-status mapping
│   │   └── swal.js                     # sweetalert2 helpers styled with daisyUI
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── BootstrapPage.jsx       # one-time first-admin creation
│   │   │   └── LoginPage.jsx
│   │   ├── AnalyticsPage.jsx           # global + per-dataset charts + ML export
│   │   ├── AuditPage.jsx               # admin-only audit log browser
│   │   ├── DashboardPage.jsx           # workspace overview
│   │   ├── DatasetDetailPage.jsx       # annotation workspace
│   │   ├── DatasetsPage.jsx            # dataset list, import, assign, filter
│   │   ├── NotFoundPage.jsx            # 404
│   │   ├── ServiceUnavailablePage.jsx  # shown when /health fails
│   │   ├── TaxonomiesPage.jsx          # admin-only taxonomy CRUD
│   │   └── UsersPage.jsx               # admin-only user management
│   ├── services/
│   │   ├── analyticsApi.js
│   │   ├── api.js                      # axios instance + tokenStore
│   │   ├── auditApi.js
│   │   ├── authApi.js
│   │   ├── commentApi.js
│   │   ├── datasetApi.js
│   │   ├── getErrorMessage.js
│   │   ├── healthApi.js
│   │   ├── taxonomyApi.js
│   │   └── userApi.js
│   ├── App.jsx                         # <Routes> definitions
│   ├── index.css                       # Tailwind + daisyUI setup
│   └── main.jsx                        # providers: QueryClient → Router → HealthGate → Auth
├── .env                                # git-ignored
├── eslint.config.js
├── index.html
├── package.json
└── vite.config.js
```

Provider nesting in `src/main.jsx` is significant: `QueryClientProvider` → `BrowserRouter` →
`HealthGate` → `AuthProvider` → `App`. `BrowserRouter` must wrap `HealthGate` because the gate
navigates, and `HealthGate` must wrap `AuthProvider` so no authenticated request is attempted while
the backend is known to be down.

## Routes

| Path                      | Component                | Access                 | Purpose                                            |
| ------------------------- | ------------------------ | ---------------------- | -------------------------------------------------- |
| `/login`                  | `LoginPage`              | public                 | Email + password sign-in.                          |
| `/bootstrap`              | `BootstrapPage`          | public                 | Creates the first admin; disabled once one exists. |
| `/service-unavailable`    | `ServiceUnavailablePage` | public                 | Shown when `/health` fails; retries automatically. |
| `/`                       | —                        | protected              | Redirects to `/dashboard`.                         |
| `/dashboard`              | `DashboardPage`          | protected              | Workspace overview (stats, progress, activity).    |
| `/datasets`               | `DatasetsPage`           | protected              | Dataset list, import, filter, assign, export.      |
| `/datasets/:id`           | `DatasetDetailPage`      | protected              | Annotation workspace for one dataset.              |
| `/datasets/:id/analytics` | `AnalyticsPage`          | protected              | Per-dataset charts + ML export.                    |
| `/taxonomies`             | `TaxonomiesPage`         | protected (admin only) | Create / edit / deactivate taxonomies.             |
| `/analytics`              | `AnalyticsPage`          | protected (admin only) | Workspace-wide charts (global mode).               |
| `/audit`                  | `AuditPage`              | protected (admin only) | Browse + filter audit log entries.                 |
| `/users`                  | `UsersPage`              | protected (admin only) | Create / activate / delete users, reset passwords. |
| `*`                       | `NotFoundPage`           | public                 | 404 with the attempted path.                       |

All protected routes render inside `PublicLayout`, which supplies the header, the sidebar
(Dashboard, Datasets, and — for admins — Users, Audit Log, Taxonomies, Analytics) and the `<Outlet />`.

## Authentication & session

- The JWT is kept in `localStorage` under the key `annotator_token`, managed by `tokenStore` in
  `src/services/api.js` (`get` / `set` / `clear`).
- A **global axios request interceptor** reads the token and attaches
  `Authorization: Bearer <token>` to every request. Individual service modules never touch headers.
- A **global axios response interceptor** handles `401` responses: except for `/auth/login`,
  `/auth/bootstrap`, and `/auth/bootstrap-status`, it clears the token and dispatches
  `window.dispatchEvent(new CustomEvent("auth-expired"))`. `AuthProvider` listens for that event
  and clears the signed-in user.
- `AuthProvider` initialises `loading` from whether a token exists. If one does, it calls
  `GET /auth/me` to hydrate the user; on failure the token is cleared and the user is treated as
  signed out.
- `AuthProvider` exposes `user`, `loading`, `login`, `logout`, `isAuthenticated` and `isAdmin`.
- `ProtectedRoute` renders a full-screen spinner while `loading`, redirects unauthenticated users to
  `/login`, and redirects non-admins away from `adminOnly` routes to `/`.
- **Sign in:** `login(email, password)` → `POST /auth/login` → stores `res.token`, sets `res.user`.
- **Sign out:** `logout()` calls `POST /auth/logout`, ignores any error from that call, then clears
  the stored token; `PublicLayout` navigates to `/login`.
- **First-run bootstrap:** `BootstrapPage` calls `GET /auth/bootstrap-status`; if `adminCount > 0`
  it shows an "Admin already exists" card instead of the form. Otherwise it collects name, email,
  password and confirmation, then `POST /auth/bootstrap` and redirects to `/login`. Password
  confirmation is validated client-side with react-hook-form's `useWatch`.

### User roles

| Role        | Capabilities                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| `admin`     | Everything: users, taxonomies, audit log, analytics, dataset import/assign/duplicate/delete, annotation.        |
| `annotator` | Annotate the datasets assigned to them; view version history, restore versions, and view per-dataset analytics. |

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
force the same redirect. **Nothing currently dispatches that event** (see
[Known issues](#known-issues--cleanup-candidates) #3).

## API layer

All modules live in `src/services/`. `src/services/api.js` exports a shared axios instance with
`baseURL: "/api"` and a 30-second timeout, plus the `tokenStore` helper and the two global
interceptors described above. `healthApi.js` intentionally uses its own axios client with an empty
`baseURL` so it can reach `/health` outside the `/api` prefix.

`src/services/getErrorMessage.js` provides a small fallback helper
(`err.response.data.error` → `err.message` → `"Something went wrong"`), though most components
inline that same expression instead.

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

| Function                                                       | Method | Endpoint                                                |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `listDatasets(params)`                                         | GET    | `/datasets`                                             |
| `getDataset(id)`                                               | GET    | `/datasets/:id`                                         |
| `renameDataset(id, data)`                                      | PATCH  | `/datasets/:id`                                         |
| `assignDataset(id, assignedTo)`                                | PATCH  | `/datasets/:id/assign`                                  |
| `duplicateDataset(id, name)`                                   | POST   | `/datasets/:id/duplicate`                               |
| `deleteDataset(id)`                                            | DELETE | `/datasets/:id`                                         |
| `getDatasetStats()`                                            | GET    | `/datasets/stats`                                       |
| `previewImport(file)`                                          | POST   | `/datasets/preview`                                     |
| `importDataset(file, name, onProgress, dedupeStrategy, taxId)` | POST   | `/datasets/import` (multipart; reports upload progress) |

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
| `getCommentVersions(id, params)`     | GET    | `/comments/:id/versions`         |
| `restoreCommentVersion(id, version)` | POST   | `/comments/:id/restore/:version` |
| `exportComments(params)`             | GET    | `/comments/export` (blob)        |
| `bulkAnnotateComments(data)`         | POST   | `/comments/bulk-annotate`        |
| `bulkAssignComments(data)`           | POST   | `/comments/bulk-assign`          |

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
<summary><strong>taxonomyApi.js</strong></summary>

| Function                                    | Method | Endpoint                             |
| ------------------------------------------- | ------ | ------------------------------------ |
| `listTaxonomies(params)`                    | GET    | `/taxonomies`                        |
| `getDefaultTaxonomy()`                      | GET    | `/taxonomies/defaults`               |
| `getTaxonomyForDataset(datasetId)`          | GET    | `/taxonomies/for-dataset/:datasetId` |
| `getTaxonomy(id)`                           | GET    | `/taxonomies/:id`                    |
| `createTaxonomy(data)`                      | POST   | `/taxonomies`                        |
| `updateTaxonomy(id, data)`                  | PATCH  | `/taxonomies/:id`                    |
| `deleteTaxonomy(id, hard)`                  | DELETE | `/taxonomies/:id?hard=true`          |
| `assignTaxonomyToDataset(taxonomyId, dsId)` | PATCH  | `/taxonomies/:id/assign/:datasetId`  |
| `unassignTaxonomyFromDataset(taxId, dsId)`  | DELETE | `/taxonomies/:id/assign/:datasetId`  |

</details>

<details>
<summary><strong>auditApi.js</strong></summary>

| Function              | Method | Endpoint         |
| --------------------- | ------ | ---------------- |
| `listAuditEntries(p)` | GET    | `/audit`         |
| `listAuditActions()`  | GET    | `/audit/actions` |

</details>

<details>
<summary><strong>analyticsApi.js</strong></summary>

| Function                                 | Method | Endpoint                                  |
| ---------------------------------------- | ------ | ----------------------------------------- |
| `getDatasetAnalytics(datasetId)`         | GET    | `/analytics/dataset/:id`                  |
| `getGlobalAnalytics()`                   | GET    | `/analytics/global`                       |
| `exportMLData(datasetId, format, split)` | GET    | `/analytics/dataset/:id/export-ml` (blob) |

</details>

<details>
<summary><strong>healthApi.js</strong></summary>

| Function        | Method | Endpoint  | Notes                                                   |
| --------------- | ------ | --------- | ------------------------------------------------------- |
| `checkHealth()` | GET    | `/health` | 5s timeout; returns `{ ok, reason? }` and never throws. |

</details>

## Feature surface

Feature-by-feature map of what the UI currently does, and where.

### Dashboard (`/dashboard`)

Stat tiles for datasets / total comments / annotated / pending; an overall progress bar; a per-status
breakdown of datasets; and a compact activity bar chart of the last 7 days. Polls `GET /datasets/stats`
every 30 seconds.

### Datasets list (`/datasets`)

- **Import** (admin-only): drag-and-drop or browse a `.csv` / `.xlsx` file. `ImportPreviewModal` calls
  `POST /datasets/preview`, then shows row counts, duplicate rows (with sample IDs), a preview of the
  first 10 rows, and per-row errors. Duplicate rows are handled via a radio choice between **skip**
  and **rename** (`-dup1`, `-dup2`). The modal also lets the admin attach a **taxonomy** at import
  time. After confirming, the file is uploaded with `POST /datasets/import` (multipart, with a
  progress callback). A live in-modal queue shows upload %, then polling status: `parsing → inserting →
versions → finalizing`, with an ETA derived from sample deltas.
- **Filter pills** — All / In progress / Ready / Unassigned / Complete / Failed, each showing a live
  count.
- **Cards** — one per dataset, with import progress (when applicable), annotation progress, pending
  count, renamed/skipped row counts, and a link to the dataset.
- **Per-card actions** — View / Analytics / Export (CSV / XLSX) / `⋯` menu with: assign annotator,
  assign taxonomy, rename, duplicate, delete.
- **Pagination** — page size 10 / 20 / 50.
- Auto-refetch every 2 seconds while any upload is running.

### Dataset detail (`/datasets/:id`)

The annotation workspace:

- **Sticky progress strip** — overall percent, annotated / total, pending count, dirty-row counter,
  status chip.
- **Toolbar** — status pills (To do / All / Pending / Done), search box, page size, page navigation.
- **Table** — one row per comment. Each row shows the source ID, a truncated comment, and two
  `<select>` dropdowns populated from the dataset's effective taxonomy (via `useDatasetTaxonomy`).
  Changing a value marks the row dirty; the Save button is enabled only when both axes are set. Admin
  rows additionally expose version history and delete.
- **Bulk bar** — when rows are selected, a floating bar lets you apply one sentiment and/or type to
  all of them via `POST /comments/bulk-annotate`.
- **History modal** — paginated list of a comment's versions, with a Restore button per non-current
  version.
- **Header chips** — assignee (admin can reassign), taxonomy (admin can swap), and a shortcut link to
  the dataset's analytics.

### Dataset analytics (`/datasets/:id/analytics`)

- **Readiness card** — verdict + numeric score + reasons.
- **Warnings** — imbalanced classes, low annotation coverage, near-duplicates.
- **KPI tiles** — total, annotated (% annotated), pending, near-duplicates.
- **Charts** — sentiment distribution (bar), type/language distribution (donut), comment-length
  histogram (bar), activity timeline (line).
- **ML export** — buttons for JSONL / CSV / XLSX, all of which call
  `GET /analytics/dataset/:id/export-ml` with an 80/10/10 split by default.

### Global analytics (`/analytics`, admin only)

KPI tiles (datasets, comments, coverage %, active users); 14-day activity line chart; sentiment and
type distribution charts; a table of top datasets ranked by comment count, with per-dataset progress
bars.

### Users (`/users`, admin only)

Search by name or email; create a user (name / email / password / role); reset password; toggle active
status; delete. Admins cannot deactivate or delete their own account.

### Taxonomies (`/taxonomies`, admin only)

Search, create, edit, deactivate (soft delete), delete. Each taxonomy holds two ordered lists —
`sentiment` and `type` — each item `{ value, label, order }`. The editor exposes label + value fields
per row, with an Add button. Sentinels (`unannotated` / `unclassified`) are appended automatically by
the backend.

### Audit log (`/audit`, admin only)

Filter by action name and target type; paginated list of entries with an icon per action, actor
email + role, timestamp, and a collapsible metadata blob.

## UI conventions

- **Styling:** daisyUI component classes (`card`, `btn`, `badge`, `alert`, `modal`, `navbar`,
  `loading`) combined with Tailwind utilities. `src/index.css` registers Tailwind and loads daisyUI
  with `themes: light --default`, so **light is the only available theme**.
- **Icons:** `lucide-react`, imported per page rather than from a barrel file.
- **Dialogs & feedback:** everything goes through `src/lib/swal.js`, which mixes sweetalert2 with
  daisyUI button classes and `buttonsStyling: false`. Available helpers: `toast`, `alertSuccess`,
  `alertError`, `alertInfo`, `confirmAction`, `confirmDelete`, `promptText` and
  `promptPasswordReset`. Destructive actions always go through `confirmAction` / `confirmDelete`
  first.
- **Loading states:** each screen ships its own skeleton components (for example `DashboardSkeleton`,
  `DatasetsListSkeleton`, `DatasetDetailSkeleton`, `CommentsTableSkeleton`, `HistoryListSkeleton`,
  `AuditSkeleton`, `TaxonomyListSkeleton`, `UsersTableSkeleton`, `AnalyticsSkeleton`) rather than one
  global spinner. Full-screen spinners are reserved for `ProtectedRoute` and `HealthGate`.
- **Server state:** TanStack Query only — no `useEffect` data fetching. Cache keys in use include
  `["users"]`, `["datasets"]`, `["dataset", id]`, `["comments", params]`, `["versions", commentId,
page]`, `["taxonomies"]`, `["taxonomy-for-dataset", id]`, `["audit", params]`,
  `["audit-actions"]`, `["analytics-global"]`, `["analytics-dataset", id]`, and
  `["dataset-stats"]`. Mutations call `queryClient.invalidateQueries` afterwards.
- **Forms:** react-hook-form with inline validation messages (`errors.<field>.message`) and an
  `input-error` / `text-error` treatment on the offending field.
- **Floating menus:** dropdown menus and pickers use React portals positioned with `getBoundingClientRect`,
  auto-flipping above the trigger when there isn't enough room below. See `DatasetActions`,
  `AssignDropdown`, and `DatasetTaxonomyPicker` in `DatasetDetailPage.jsx`.
- **Accessibility:** inputs carry `autoComplete` hints, decorative icons inside inputs are marked
  `pointer-events-none`, and icon-only buttons use `title` attributes for labelling.

## Known issues & cleanup candidates

Verified gaps in the current tree:

1. **`backend-down` event has no dispatcher.** `HealthGate` listens for `window.addEventListener("backend-down", ...)`,
   but nothing in `src/services/api.js` ever dispatches it. The only global interceptor currently
   installed handles `401`. A response interceptor for network errors and `503` that dispatches the
   event would close the loop.
2. **Unused imports in `ProtectedRoute.jsx`.** It imports `alertSuccess`, `alertError`,
   `confirmAction`, `confirmDelete` and `promptPasswordReset` from `../lib/swal` but never calls any
   of them. `npm run lint` reports these as warnings because `no-unused-vars` is set to `warn` in
   `eslint.config.js`.
3. **Bundle size.** The production bundle is ~515 kB (151 kB gzipped) and triggers Vite's >500 kB
   chunk warning. Route-level `React.lazy` splitting for the admin pages and `AnalyticsPage` would
   bring this down.
4. **`AuditPage.jsx` action icon/color map is hand-maintained.** New backend actions won't appear in
   the icon map until they're added here — they'll fall back to a generic `FileText` icon. Minor, but
   worth noting when new actions are introduced.
5. **No global 401 → login redirect.** The interceptor clears the token and fires `auth-expired`, and
   `AuthProvider` clears the user — but there's no direct navigation to `/login`. In practice
   `ProtectedRoute` catches the ensuing unauthenticated render and redirects, but a router-aware
   interceptor would be more explicit.

## Contributing

`eslint.config.js` enforces a small custom rule set beyond the React presets — `eqeqeq`, `no-undef`,
`no-redeclare`, `no-unreachable` and `no-debugger` are errors, while `no-console` and `no-unused-vars`
are warnings. Run `npm run lint` before committing.

## License

Private project — `"private": true` in `package.json`. Not published to npm.
