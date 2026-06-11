# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Vite dev server (SPA).
- `pnpm build` — production build, outputs static `dist/` (index.html + assets).
- `pnpm build:dev` — development-mode build.
- `pnpm preview` — preview the production build locally.
- `pnpm lint` — ESLint over the repo.
- `pnpm format` — Prettier write.

No test suite. Package manager is pnpm (`pnpm-lock.yaml` is authoritative; a stale `bun.lock` lingers from the Lovable template).

## Architecture

### Stack and deployment target

Plain **Vite + React 19 SPA** (TypeScript). Output is a static `dist/` folder — deploy by uploading it to any static host. No SSR, no Workers, no server. Tailwind v4 via `@tailwindcss/vite`, path alias `@/*` → `src/*` via `vite-tsconfig-paths`. Entry chain: `index.html` → `src/main.tsx` → `src/App.tsx`.

This project used to target TanStack Start SSR on Cloudflare Workers; the SSR scaffolding (server.ts, start.ts, router.tsx, routeTree.gen.ts, routes/, error-capture, error-page, wrangler.jsonc, `@lovable.dev/vite-tanstack-config`) was removed when it was converted to a static SPA. If you see references to those, they're stale.

### App: Web Pay Pro internal tool

Single-page app (`src/App.tsx`) that toggles between `LoginPage` and `DashboardLayout` based on a `LoggedUser` persisted in `localStorage` under `wpp_user` (`STORAGE_KEY` in `api.ts`). All app UI lives in `src/components/webpaypro/`. UI text is French/Arabic for an internal Moroccan workflow.

`DashboardLayout` has five navigation views: **Nouveau client**, **Mes clients**, **Nouvel agent**, **Mes agents**, and **Gestion utilisateurs** (admin-only, hash `#users`).

Notable in-app components:
- `LoginPage` / `DashboardLayout` — auth gate + shell.
- `NewClientForm` — uses `FileInput` + `fileValidation` for the three required uploads, opens `SuccessModal` on success.
- `MyClientsTable` — local search (CIN/nom/prénom/téléphone/opérateur, case-insensitive, trimmed), newest-first via `[...clients].reverse()`, opens `DocumentPreviewModal` for each Drive link.
- `NewAgentForm` — registers agents; see Agent workflow below.
- `MyAgentsTable` — displays agents created by the logged-in user; see Agent list below.
- `UserManagement` — admin-only page at `#users`; create commercial users + list all users; see User management below.
- `DocumentPreviewModal` — extracts the Drive `FILE_ID`, renders `https://drive.google.com/thumbnail?id=<id>&sz=w1600` in an `<img>` with CSS-transform zoom (steps 0.25, range [0.5, 4]); on `onError` falls back to an `<iframe>` at `https://drive.google.com/file/d/<id>/preview` (handles PDFs and images Drive blocks from hotlinking). Always shows the original Drive link via "Ouvrir dans Google Drive".

### Backend = Google Apps Script Web App

There is no first-party backend. `src/components/webpaypro/api.ts` posts JSON to a single Google Apps Script Web App URL (`GOOGLE_SCRIPT_URL`). All actions (`login`, `createClient`, `getClients`, `createAgent`, `getAgents`, `createUser`, `getUsers`) are dispatched by an `action` field in the body. Two constraints to respect:

- **No custom headers.** Apps Script Web Apps would trigger a CORS preflight and reject it. `callScript` deliberately sends a plain-text body and lets the script JSON-parse it server-side. Don't add `Content-Type: application/json` or auth headers.
- **File uploads are base64.** `fileToBase64` strips the data-URL prefix; uploads are sent as `{ name, type, base64 }` objects inline in the JSON payload. Client-side size cap is 10 MB per file (`fileValidation.ts`) — enforced at selection time in `FileInput` and as a defense check in each form's submit handler.

### Agent workflow

`NewAgentForm` registers agents with these required fields:
- nom, prénom, téléphone (Moroccan: `05|06|07` + 8 digits), email (valid format required)
- type agent: `agence` or `détaillant`
- photo document, CIN recto, CIN verso, photo local (files)
- GPS localisation via `navigator.geolocation` — **mandatory before submit**

The frontend captures latitude/longitude and generates `localisationLink` as `https://www.google.com/maps?q=${lat},${lng}`. The payload key is `localisationLink`; Apps Script saves it to the `localisation_link` column. Files are uploaded using the same base64 + Google Drive flow as clients. Agent records are saved into the separate Google Sheet tab `Agents`.

### Agent list

`MyAgentsTable` displays agents created by the currently logged-in user. It calls `getAgents()` from `api.ts`. Apps Script filters by `created_by_user_id`. Local search supports nom, prénom, téléphone, email, and type_agent. File columns (photo document, CIN recto, CIN verso, photo local) open `DocumentPreviewModal`. The localisation column renders as a plain `<a target="_blank">` link to Google Maps — **not** via `DocumentPreviewModal`, because `localisation_link` is a Maps URL, not a Drive file. The `agent_pdf_url` column renders as a plain `<a target="_blank">` link labelled "Ouvrir PDF"; shows `—` when empty (e.g. for agents registered before PDF generation was added).

### Role system

Users have a `role` column in the Users sheet: `admin` or `commercial` (default when missing or empty).

- **commercial**: sees only their own clients/agents. Nav labels: "Mes clients" / "Mes agents".
- **admin**: sees all records from all commercials. Nav labels change to "Tous les clients" / "Tous les agents". An `ADMIN` badge appears next to the user name. Both tables gain a date-range filter (Date de / Date à) and a commercial dropdown filter, plus a "Commercial" column showing who created each record.

Role is enforced **server-side** in `handleGetClients` / `handleGetAgents` via `getUserRole(userId)`, which reads the Users sheet on every request. The `role` in `LoggedUser` / localStorage is used only for UI (labels, badge, filter visibility) and is never trusted by the backend.

Date filters in the tables use a `datePart()` helper that validates the `"yyyy-MM-dd HH:mm"` format from `formatDate()` before comparing with `<input type="date">` values.

### User management

`UserManagement` (`src/components/webpaypro/UserManagement.tsx`) is an admin-only page at hash `#users`. It has two sections:

1. **Create user form** — fields: nom complet, nom d'utilisateur, mot de passe, confirmer le mot de passe. Password match validated client-side ("Les mots de passe ne correspondent pas."). `confirmPassword` is never sent to the backend. Always creates users with role `commercial` — creating admin users is not supported from the UI.
2. **Users list table** — shows all accounts (user_id, username, name, role badge, status badge) plus per-row action buttons: `Modifier`, `Bloquer`/`Débloquer`. Fetched via `getUsers` action.

**Edit modal** — opened via `Modifier`. Prefills name, username, status. Password fields are blank; confirm password field is conditionally rendered only when a new password is typed. Note shown: "Laissez le mot de passe vide pour le conserver." Role is never shown or editable from this UI.

**Block / Unblock** — clicking `Bloquer` or `Débloquer` calls `updateUser` directly with the same name/username and the new status. The `Bloquer` button is hidden for the admin's own row (self-block prevention). Backend also rejects self-block with: "Vous ne pouvez pas bloquer votre propre compte."

**Status badges** — `active` → "Actif" (green), `blocked` → "Bloqué" (red), unknown → raw value (red).

**Login and status** — `handleLogin` finds user by username+password first, then checks status. Only `blocked` is rejected (message: "Votre compte est bloqué. Veuillez contacter l'administrateur."). Missing, empty, or any other unknown status allows login for backward compatibility.

`api.ts` functions:
- `createUser(requester, { username, password, name })` — always sends `role: "commercial"` in payload (no role param exposed).
- `getUsers(requester)` — returns `UserRow[]` (no passwords — password column is never included in the response).
- `updateUser(requester, { user_id, username, name, status, password? })` — `password` is optional; omit to keep existing password.

Apps Script handlers:
- `handleCreateUser` — admin-only (checks `getUserRole(requesterId)`); always stores `role = "commercial"` regardless of incoming payload; checks username uniqueness (case-insensitive); uses `getSheetColumnMap(sheet)` for column-order-safe row insertion; generates `user_id` via `generateUserId()`.
- `handleGetUsers` — admin-only; returns all users without passwords.
- `handleUpdateUser` — admin-only; validates `user_id`, `name`, `username` (required), `status` (must be `"active"` or `"blocked"`); prevents self-block; checks username uniqueness excluding current user; uses `getSheetColumnMap` for column-safe writes; updates password only if non-empty; never updates `role`; returns clear error if `status` column is missing from Users sheet.

Users sheet (`USERS_SHEET_NAME = "Users"`) must have `role` and `status` columns. Missing or empty role defaults to `"commercial"`.

### Apps Script local reference

`src/google-apps-script/code.gs` is a local reference copy of the deployed Google Apps Script. It is **not** executed from this repo. After editing this file, the updated content must be manually copied into the real Google Apps Script editor and deployed as a new version for changes to take effect.

### UI primitives

`src/components/ui/` is a full shadcn/ui (new-york style) tree backed by Radix primitives, Tailwind v4, and Lucide icons. The Web Pay Pro screens in `src/components/webpaypro/` mostly do *not* use these primitives — they use raw Tailwind with the brand palette (`#003C18`, `#00562B`, `#2F9E32`, `#B7F000`, `#C8D0C4`). Match the existing style of the file you're editing rather than mixing the two.
