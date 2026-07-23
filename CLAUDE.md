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

`DashboardLayout` has nine navigation views: **Nouveau client**, **Mes clients**, **Nouvel agent**, **Mes agents**, **Wafacash**, **Mes Wafacash**, **We Pay Pro Form**, **Mes We Pay Pro**, and **Gestion utilisateurs** (admin-only, hash `#users`).

Notable in-app components:
- `LoginPage` / `DashboardLayout` — auth gate + shell.
- `NewClientForm` — uses `FileInput` + `fileValidation` for the three required uploads, opens `SuccessModal` on success.
- `MyClientsTable` — local search (CIN/nom/prénom/téléphone/opérateur, case-insensitive, trimmed), newest-first via `[...clients].reverse()`, opens `DocumentPreviewModal` for each Drive link.
- `NewAgentForm` — registers agents; see Agent workflow below.
- `MyAgentsTable` — displays agents created by the logged-in user; see Agent list below.
- `NewWafacashForm` — registers Wafacash entries; see Wafacash workflow below. (Formerly named "Form cache" / `NewCacheForm` — renamed to Wafacash; `#cache` still maps to this view for backward compatibility.)
- `MyWafacashTable` — displays Wafacash entries; see Wafacash list below.
- `NewWePayProForm` — registers We Pay Pro dossiers; see We Pay Pro workflow below.
- `MyWePayProTable` — displays We Pay Pro dossiers; see We Pay Pro list below.
- `UserManagement` — admin-only page at `#users`; create commercial users + list all users; see User management below.
- `DocumentPreviewModal` — extracts the Drive `FILE_ID`, renders `https://drive.google.com/thumbnail?id=<id>&sz=w1600` in an `<img>` with CSS-transform zoom (steps 0.25, range [0.5, 4]); on `onError` falls back to an `<iframe>` at `https://drive.google.com/file/d/<id>/preview` (handles PDFs and images Drive blocks from hotlinking). Always shows the original Drive link via "Ouvrir dans Google Drive".

### Backend = Google Apps Script Web App

There is no first-party backend. `src/components/webpaypro/api.ts` posts JSON to a single Google Apps Script Web App URL (`GOOGLE_SCRIPT_URL`). All actions (`login`, `createClient`, `getClients`, `createAgent`, `getAgents`, `createWafacash`, `getWafacash`, `updateWafacash`, `createWePayPro`, `getWePayPro`, `createUser`, `getUsers`) are dispatched by an `action` field in the body. `doPost` also still accepts the legacy `createCache` action name as an alias that routes to the same Wafacash handler, so any stale cached frontend bundle keeps working. Two constraints to respect:

- **No custom headers.** Apps Script Web Apps would trigger a CORS preflight and reject it. `callScript` deliberately sends a plain-text body and lets the script JSON-parse it server-side. Don't add `Content-Type: application/json` or auth headers.
- **File uploads are base64.** `fileToBase64` strips the data-URL prefix; uploads are sent as `{ name, type, base64 }` objects inline in the JSON payload. Two size tiers apply (`fileValidation.ts`): `FileInput` enforces a shared `MAX_FILE_SIZE_MB = 10` cap at selection time for every form; `NewClientForm`/`NewAgentForm`/`NewWafacashForm`/`NewWePayProForm` additionally compress images and re-validate against a tighter `MAX_COMPRESSED_FILE_SIZE_MB = 3` at submit time — see "Client-side image compression" below.
- **Drive folder organization.** Every form nests its uploads two levels under `DRIVE_FOLDER_ID`: a form-type subfolder (via `getOrCreateChildFolder`), then a `sanitizeFolderName(nom)-sanitizeFolderName(prenom)` person subfolder inside it (via `getOrCreatePersonFolder`), both created lazily on first use. Layout:
  ```
  DRIVE_FOLDER_ID/
    Clients/Nom-prenom/         ← handleCreateClient (CIN recto/verso, pièce jointe)
    Agents/Nom-prenom/          ← handleCreateAgent (photo document, CIN recto/verso, photo local, generated PDF — reuses the same `folder` reference)
    Wafacash/Nom-prenom/        ← handleCreateWafacash (CIN recto/verso, photo local)
    We pay pro Form/Nom-prenom/ ← handleCreateWePayPro (CIN recto/verso, pièce jointe)
  ```
  File URLs are still `https://drive.google.com/file/d/<fileId>/view`, keyed by file ID — moving the containing folder never changes or breaks an existing link. This is layered on top of prior history, and nothing is moved or migrated: files uploaded before the original person-subfolder change remain directly in the root `DRIVE_FOLDER_ID`; files uploaded between that change and this type-subfolder change remain in the older flat `DRIVE_FOLDER_ID/Nom-prenom/` layout (no type subfolder); only new uploads after this change land in `DRIVE_FOLDER_ID/<FormType>/Nom-prenom/`.
- **Drive file naming.** New uploads are named via `buildFileLabel(baseLabel, nom, prenom)`, which appends the sanitized person name to the base label (e.g. `cin_recto_dupont-jean`, `photo_document_dupont-jean`). Used for client (`cin_recto`, `cin_verso`, `piece_jointe`), agent (`photo_document`, `cin_recto`, `cin_verso`, `photo_local`), Wafacash (`cin_recto`, `cin_verso`, `photo_local`), and We Pay Pro (`cin_recto`, `cin_verso`, `piece_jointe`) uploads. The final filename is still `${id}_${label}_${Date.now()}${extension}` — only the `label` portion changed, so uniqueness (ID + timestamp) is unaffected. Files uploaded before this change keep their old (non-name-suffixed) filenames.

### Sheet write reliability (`operation_id`, explicit spreadsheet ID, locking)

Commercials occasionally reported a submission that the frontend confirmed as successful (and that always exists in the Drive JSON backup) not showing up in the Google Sheet. Investigation ruled out backup-before-append ordering (backup is already the last step in every create handler) and concluded the most likely cause was `SpreadsheetApp.getActiveSpreadsheet()` — which resolves to whatever spreadsheet the *executing* script instance happens to be bound to — being ambiguous across deployments/copies, while the Drive backup uses a hardcoded folder ID and is immune to that ambiguity. The following hardening was added:

- **`SPREADSHEET_ID` + `getSpreadsheet()`.** Every one of the 8 former `SpreadsheetApp.getActiveSpreadsheet()` call sites (`handleGetAgents`, `handleGetWafacash`, `handleGetWePayPro`, `getUserRole`, `getSheet`, `getOrCreateAgentsSheet`, `getOrCreateWafacashSheet`, `getOrCreateWePayProSheet`) now calls `getSpreadsheet()`, which does `SpreadsheetApp.openById(SPREADSHEET_ID)`. **`SPREADSHEET_ID` is a placeholder (`"PUT_SPREADSHEET_ID_HERE"`) that must be replaced with the real Sheet ID before deploying** — deploying with the placeholder in place makes every request fail immediately (loudly, not silently). This guarantees every execution, regardless of which deployment/copy of the script handled the request, writes to the same spreadsheet.
- **`operation_id`.** Generated via `generateOperationId(prefix)` as the first line of every `handleCreateX` (prefixes: `CL` client, `AG` agent, `WF` wafacash, `WPP` wepaypro). Threaded through the Sheet row (new last column in every sheet — `Clients`, `Agents`, `Wafacash`, `We Pay Pro`), the backup JSON record (both success and failure), every `Logger.log` line in that handler, and the JSON response (`operation_id` field) — so a specific reported-missing submission can be traced end to end by searching for one ID across the Sheet, the backup files, and the Apps Script Execution log. The column is added via the generic `ensureColumnExists(sheet, headerName, insertAfterHeaderName)` helper (a no-op if already present), always inserted **after the sheet's current last column** so the hardcoded telephone-column-index literals (`7` for Clients/We Pay Pro, `4` for Agents) and the dynamic Wafacash/PDF column lookups are never shifted. `getOrCreateAgentsSheet`/`getOrCreateWafacashSheet`/`getOrCreateWePayProSheet` also include `operation_id` in their literal header arrays for brand-new sheets. Old rows have a blank `operation_id` — nothing is migrated retroactively. All four `handleGet*` responses include `operation_id` per row (no frontend UI change yet — searchable today via the Sheet, backup JSON, or Execution log).
- **`sheet_saved` / `sheet_failed` backup status.** Each create handler's sheet-write phase (ensure `operation_id` column → `appendRow` → telephone formatting → `logSheetWrite`) is wrapped in try/catch. On success, the existing `create*_success` backup record gains `status: "sheet_saved"` and `operation_id`. On failure, a new `create*_failed` backup record is written first (`status: "sheet_failed"`, `operation_id`, `error_message`, all submitted fields, and any Drive URLs already uploaded — uploads happen before the sheet-write phase, so they're known even if the sheet write itself fails; no base64 ever stored), then the error is rethrown so `doPost`'s existing catch still returns `success:false` to the frontend — the CORS/plain-text response contract is unchanged.
- **`logSheetWrite(operationId, sheet, lastRow, keyLabel, keyValue)`.** Logged right after every successful append. Its main value isn't self-correction within a single execution (it can't detect "wrong spreadsheet" — it reads back from the very object it just wrote to) but diagnostics for the *next* incident: it logs `sheet.getParent().getUrl()` alongside the `operation_id`, so a specific complaint can be grepped in the Execution log and cross-checked against which spreadsheet it actually hit.
- **`LockService.getScriptLock()`** wraps only the sheet-write phase (not file uploads) in every create handler — `lock.waitLock(30000)` then `try { ... } finally { lock.releaseLock(); }` — to close concurrent-execution races on `sheet.appendRow()` as a contributing cause of intermittent write issues. If lock acquisition itself throws (timeout), that propagates through the existing `doPost` catch as `success:false`, same as any other handler error.
- **Trimmed `userId` at write time.** `const userId = String(body.userId || "").trim();` at the top of every create handler, used in the row and backup record instead of raw `body.userId`. `handleGet*` filters already trimmed the *stored* value before comparing (so this wasn't a live visibility bug), but this closes the gap at the source too.

### Client-side image compression (performance)

Real-world submissions were producing base64 JSON payloads large enough to make submissions from the field take up to ~15 minutes over mobile data — a single Agent submission was observed uploading ~21 MB of raw images (`photo_document` 6.1 MB, `cin_recto` 3.7 MB, `cin_verso` 3.7 MB, `photo_local` 7.5 MB) before base64 inflation. `src/components/webpaypro/imageCompression.ts` exports a shared `compressImageFile(file, { maxDimension = 1280, quality = 0.75 })` helper: it resizes images to a max dimension (preserving aspect ratio) and re-encodes them as JPEG via an off-screen `<canvas>`. PDFs and GIFs pass through unchanged (GIF re-encoding would flatten animation). If compression throws or doesn't actually shrink the file, it falls back to the original file — compression never blocks submission by itself.

`NewClientForm`, `NewAgentForm`, and `NewWafacashForm` all use this helper the same way: in `submit()`, every required file is compressed in parallel via `Promise.all`, each result is re-validated with `validateFile(f, MAX_COMPRESSED_FILE_SIZE_MB)` (from `fileValidation.ts`, `= 3`) — surfacing a clear French error ("Le fichier ne doit pas dépasser 3 MB.") and aborting submission instead of silently sending an oversized file — and only then converted via `fileToBase64`. This catches both compression failures and files still too large after compression (e.g. a dense photo, or a PDF like the client form's `pieceJointe`, which can legitimately be a PDF and is not resized). `FileInput.tsx` itself is intentionally untouched — selection-time validation still uses the shared 10 MB default from `MAX_FILE_SIZE_MB`, so there's no behavior drift between forms and no new props needed.

All three forms' `FullScreenLoadingOverlay` shows the same copy while `submitting` is true: "Téléchargement des documents..." / "Compression et envoi des images en cours. Veuillez patienter quelques secondes." — replacing each form's previous generic loading copy, since compression adds a visible (if short) delay before the network request starts.

`handleCreateClient`, `handleCreateAgent`, `handleCreateWafacash`, and `handleCreateWePayPro` in `code.gs` each have `Logger.log` timing checkpoints (start, before uploads, after each file upload, after sheet append, after backup/PDF generation, done — each as milliseconds elapsed since `start`) to help distinguish "Apps Script itself is slow" from "the client's network upload is slow" the next time a submission is reported as hanging. These are permanent, not temporary — `Logger.log` calls are cheap and show up in the Apps Script executions log.

### Agent workflow

`NewAgentForm` registers agents with these required fields:
- nom, prénom, téléphone (Moroccan: `05|06|07` + 8 digits), email (valid format required)
- type agent: `agence` or `détaillant`
- photo document, CIN recto, CIN verso, photo local (files)
- GPS localisation via `navigator.geolocation` — **mandatory before submit**

The frontend captures latitude/longitude and generates `localisationLink` as `https://www.google.com/maps?q=${lat},${lng}`. The payload key is `localisationLink`; Apps Script saves it to the `localisation_link` column. Files are uploaded using the same base64 + Google Drive flow as clients. Agent records are saved into the separate Google Sheet tab `Agents`.

### Agent list

`MyAgentsTable` displays agents created by the currently logged-in user. It calls `getAgents()` from `api.ts`. Apps Script filters by `created_by_user_id`. Local search supports nom, prénom, téléphone, email, and type_agent. File columns (photo document, CIN recto, CIN verso, photo local) open `DocumentPreviewModal`. The localisation column renders as a plain `<a target="_blank">` link to Google Maps — **not** via `DocumentPreviewModal`, because `localisation_link` is a Maps URL, not a Drive file. The `agent_pdf_url` column renders as a plain `<a target="_blank">` link labelled "Ouvrir PDF"; shows `—` when empty (e.g. for agents registered before PDF generation was added).

### Wafacash workflow

`NewWafacashForm` registers Wafacash entries with these required fields:
- nom, prénom, téléphone (Moroccan: `05|06|07` + 8 digits, same validation as the agent form), adresse
- GPS localisation via `navigator.geolocation` — **mandatory before submit**, same pattern as client/agent forms
- CIN recto, CIN verso, photo du local / magasin (files)

The frontend captures latitude/longitude and generates `localisationLink` as `https://www.google.com/maps?q=${lat},${lng}`, same as the other forms. Files are uploaded using the same base64 + Google Drive flow, into the submission's person subfolder (see Drive folder organization above), with filenames built via `buildFileLabel` (see Drive file naming above). Records are saved into the Google Sheet tab `Wafacash` with columns: `created_at`, `wafacash_id`, `nom`, `prenom`, `telephone`, `adresse`, `latitude`, `longitude`, `localisation_link`, `cin_recto_url`, `cin_verso_url`, `photo_local_url`, `status`, `first_recharge`, `created_by_user_id`, `created_by_username`. Accessible to both admin and commercial users.

This feature was originally named "Form cache" (`NewCacheForm`, `createCache` action, `Caches` sheet). It was renamed to Wafacash; the old `Caches` sheet and any data in it were left untouched (not migrated, not deleted) — new submissions only go to the `Wafacash` sheet. `#cache` still routes to the Wafacash form for backward compatibility, and the Apps Script `createCache` action is still accepted as an alias for `createWafacash` (see Backend section above). `api.ts` also still exports `CacheRow`/`createCache` as deprecated aliases of `WafacashRow`/`createWafacash` for the same reason — new code should use the Wafacash names.

`telephone` was added after the initial Wafacash launch. `handleCreateWafacash` normalizes/validates it the same way as client/agent phones (`normalizeMoroccanPhone` + `isValidMoroccanPhone`) and writes it as text (leading-zero-preserving trick, same as `createClient`/`createAgent`). Since pre-existing `Wafacash` sheets were created before this column existed, `ensureWafacashTelephoneColumn(sheet)` inserts a `telephone` header column right after `prenom` the first time it's missing (called from both `handleCreateWafacash` and `handleGetWafacash`); old rows keep their data shifted right with a blank telephone cell. The `createWafacash_success` backup record also includes `telephone`.

`photo_local_url` (required upload "Photo du local / magasin" / Arabic "صورة المحل / المتجر") was added after the initial Wafacash launch, following the same pattern as the agent form's `photoLocal` field. Uploaded into the same person subfolder, labelled `photo_local_nom-prenom` via `buildFileLabel`. Since pre-existing `Wafacash` sheets predate this column, `ensureWafacashPhotoLocalColumn(sheet)` inserts a `photo_local_url` header right after `cin_verso_url` the first time it's missing (called from both `handleCreateWafacash` and `handleGetWafacash`); old rows keep their data shifted right with a blank `photo_local_url` cell. The `createWafacash_success` backup record also includes `photo_local_url`.

Wafacash's `cinRecto`, `cinVerso`, and `photoLocal` are compressed and validated the same way as every other form's uploads — see "Client-side image compression (performance)" above for the shared helper, the 3 MB post-compression cap, the loading-overlay copy, and the `handleCreateWafacash` timing logs.

`status` and `first_recharge` were added after the initial Wafacash launch. `status` is a server-enforced enum (`inactive` | `active`, normalized/validated via `normalizeWafacashStatus`) — every new submission is created with `status = "inactive"` by `handleCreateWafacash`; the create form does not expose it. A third value, `confirmed`, existed briefly and was removed from `WAFACASH_ALLOWED_STATUSES`; `normalizeWafacashStatus` now rejects it on write (e.g. a stale `updateWafacash` call sending `confirmed` gets `"Invalid Wafacash status"`), and `normalizeWafacashStatusForDisplay` maps any pre-existing `confirmed` rows (or any other invalid/legacy value) to `inactive` on read — no sheet data migration was needed. `first_recharge` is a free-text field (amount/note), optional, empty string by default on create, editable later from `MyWafacashTable`. Since pre-existing `Wafacash` sheets predate these columns, `handleCreateWafacash`, `handleGetWafacash`, and `handleUpdateWafacash` all call `ensureColumnExists(sheet, "status", "photo_local_url")` then `ensureColumnExists(sheet, "first_recharge", "status")` (no-op if already present, otherwise inserted right after `photo_local_url`/`status` respectively, matching the `ensureWafacashTelephoneColumn`/`ensureWafacashPhotoLocalColumn` migration pattern). Old rows with a blank/missing `status` display as `inactive` via `normalizeWafacashStatusForDisplay` (never throws, unlike the strict `normalizeWafacashStatus` used for validating write input); old rows show an empty `first_recharge`. The `createWafacash_success` backup record includes `wafacash_status: "inactive"` and `first_recharge: ""` — named `wafacash_status` rather than `status` to avoid clobbering that record's existing `status: "sheet_saved"`/`"sheet_failed"` sheet-write-audit field (see "Sheet write reliability" above).

`updateWafacash` (action + `handleUpdateWafacash`) lets a commercial or admin edit `status` and `first_recharge` on an existing Wafacash row after creation. Requires `userId` and `wafacash_id`; role enforcement mirrors `handleGetWafacash` — admin can update any row, commercial only rows where `created_by_user_id` matches their own `userId` (else `"Accès refusé"`). The sheet write (both `setValue` calls) is wrapped in `LockService.getScriptLock()`, matching the locking convention used by every create handler. On success, appends a `wafacash` backup record (event `updateWafacash_success`, fields `new_status` and `first_recharge` — again avoiding the `status` key collision) and returns `{ success: true, message: "Wafacash mis à jour avec succès" }`.

### Wafacash list

`MyWafacashTable` displays Wafacash entries via `getWafacash()` from `api.ts`, same pattern as `MyAgentsTable`/`getAgents()`. Server-side role enforcement in `handleGetWafacash` via `getUserRole(userId)`: admin sees all rows, commercial sees only rows where `created_by_user_id` matches. Local search covers nom, prénom, téléphone, adresse. Newest-first via `[...wafacash].reverse()`. CIN recto/verso and Photo du local columns open `DocumentPreviewModal`; localisation column is a plain `<a target="_blank">` link to Google Maps (not a Drive file, same reasoning as the agent list). Admin gets the same date-range + commercial filters as the client/agent tables. Rows created before the `telephone` field existed simply show a blank Téléphone cell. Rows created before the `photo_local_url` field existed show `—` instead of a preview button (empty `photo_local_url`, no `DocumentPreviewModal` opened).

Three tabs above the table — **Tous les Wafacash** / **Active** / **Rechargeable** (`activeTab` state) — filter client-side on top of the existing admin date-range/commercial filters and local search (all four compose together as AND conditions). "Active" shows rows where `status === "active"`; "Rechargeable" shows rows where `first_recharge` is non-empty after trimming (`isRechargeable`). Each tab button shows a live count computed from the same base list used by the other filters (i.e. after date/commercial/search, before the tab filter itself), so counts stay accurate as other filters change.

`Status` renders as a colored badge (`statusBadgeCls`/`statusLabel`): Inactive (grey), Active (green). `First recharge` shows the raw value or `—` when empty. An `Actions` column has a `Modifier` button that opens an edit modal (same visual pattern as `UserManagement`'s edit modal) prefilled with the row's current status/first_recharge; on save it calls `updateWafacash` and reloads the list on success, or shows an inline error via `AlertMessage` on failure.

### We Pay Pro workflow

`NewWePayProForm` registers We Pay Pro dossiers. It is intentionally almost identical to `NewClientForm` — same fields (nom, prénom, CIN, ville, téléphone, opérateur, GPS localisation, CIN recto/verso, pièce jointe), same validation, same compression pipeline — plus one extra required field:

- **numéro de dossier** — the input shows a fixed, non-editable `DOS-` prefix box next to a plain text field; the commercial only ever types the value (e.g. `12345`). React state (`form.numeroDossier`) holds only that raw value — the `DOS-` is never stored in state, only rendered. The `onChange` handler also strips a leading `DOS`/`DOS-` (case-insensitive) if one is typed or pasted into the value field, purely for display-consistency; it is not a security boundary. The frontend still just requires a non-empty trimmed value and sends it as `numeroDossier` (unprefixed) — the API request shape is unchanged.

**`DOS-` prefix is backend-only.** `handleCreateWePayPro` calls `normalizeDossierNumber(value)`, which trims the input, strips any existing `DOS`/`DOS-` prefix (case-insensitive) the user may have typed, and re-applies a single `"DOS-"` prefix — so `12345` and `DOS-12345` both normalize to `DOS-12345` and are stored that way in the `dossier_number` column. This holds regardless of what the UI shows or sends — even if a future frontend bug sent `DOS-12345` or `dos-12345`, the backend still normalizes to a single `DOS-12345`. An empty value (after stripping) throws `"numero_dossier is required"`; in practice this is a secondary safety net, since the field is already covered by the same `requiredFields` check used for every other field. There is no uniqueness check on dossier numbers.

Files are uploaded using the same base64 + Google Drive flow as the other forms, but into a dedicated subfolder: `DRIVE_FOLDER_ID/We pay pro Form/Nom-prenom/` (see Drive folder organization above), with filenames built via `buildFileLabel` (see Drive file naming above). Records are saved into the Google Sheet tab `We Pay Pro` (auto-created on first submission via `getOrCreateWePayProSheet`, like the Wafacash/Agents sheets — no manual spreadsheet setup required) with columns: `created_at`, `dossier_number`, `nom`, `prenom`, `cin`, `ville`, `telephone`, `operator`, `cin_recto_url`, `cin_verso_url`, `piece_jointe_url`, `latitude`, `longitude`, `localisation_link`, `created_by_user_id`, `created_by_username`. There is no id column — `generateWePayProId()` exists solely to build unique uploaded-file names (same role `clientId` plays in `handleCreateClient`) and is not persisted anywhere.

Backup kind `"wepaypro"` is written via the existing `appendJsonBackup()` on every successful submission (event `createWePayPro_success`), same JSON-audit-log mechanism as `"clients"`/`"agents"`/`"wafacash"`.

### We Pay Pro list

`MyWePayProTable` displays We Pay Pro dossiers via `getWePayPro()` from `api.ts`, same pattern as `MyWafacashTable`/`getWafacash()`. Server-side role enforcement in `handleGetWePayPro` via `getUserRole(userId)`: admin sees all rows, commercial sees only rows where `created_by_user_id` matches. Local search covers dossier number, nom, prénom, CIN, téléphone, ville. Newest-first via `[...rows].reverse()`. CIN recto/verso and Pièce jointe columns open `DocumentPreviewModal`; localisation column is a plain `<a target="_blank">` link to Google Maps (not a Drive file, same reasoning as the agent/Wafacash lists), showing `—` when empty. Admin gets the same date-range + commercial filters as the other tables.

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
