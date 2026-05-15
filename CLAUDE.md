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

Single-page app (`src/App.tsx`) that toggles between `LoginPage` and `DashboardLayout` based on a `LoggedUser` persisted in `localStorage` under `wpp_user` (`STORAGE_KEY` in `api.ts`). All app UI lives in `src/components/webpaypro/`. UI text is French/Arabic for an internal Moroccan workflow (client KYC: nom, prénom, CIN, ville, recto/verso/pièce jointe uploads).

Notable in-app components:
- `LoginPage` / `DashboardLayout` — auth gate + shell, navigation between `NewClientForm` and `MyClientsTable`.
- `NewClientForm` — uses `FileInput` + `fileValidation` for the three required uploads, opens `SuccessModal` on success.
- `MyClientsTable` — local search (CIN/nom/prénom, case-insensitive, trimmed), newest-first via `[...clients].reverse()`, opens `DocumentPreviewModal` for each Drive link.
- `DocumentPreviewModal` — extracts the Drive `FILE_ID`, renders `https://drive.google.com/thumbnail?id=<id>&sz=w1600` in an `<img>` with CSS-transform zoom (steps 0.25, range [0.5, 4]); on `onError` falls back to an `<iframe>` at `https://drive.google.com/file/d/<id>/preview` (handles PDFs and images Drive blocks from hotlinking). Always shows the original Drive link via "Ouvrir dans Google Drive".

### Backend = Google Apps Script Web App

There is no first-party backend. `src/components/webpaypro/api.ts` posts JSON to a single Google Apps Script Web App URL (`GOOGLE_SCRIPT_URL`, currently a placeholder — must be set before the app works). All actions (`login`, `createClient`, `getClients`) are dispatched by an `action` field in the body. Two constraints to respect:

- **No custom headers.** Apps Script Web Apps would trigger a CORS preflight and reject it. `callScript` deliberately sends a plain-text body and lets the script JSON-parse it server-side. Don't add `Content-Type: application/json` or auth headers.
- **File uploads are base64.** `fileToBase64` strips the data-URL prefix; uploads (`cinRecto`, `cinVerso`, `pieceJointe`) are sent as `{ name, type, base64 }` objects inline in the JSON payload. Client-side size cap is 10 MB per file (`fileValidation.ts`) — enforced both at selection time in `FileInput` and as a defense check inside `NewClientForm.submit`.

### UI primitives

`src/components/ui/` is a full shadcn/ui (new-york style) tree backed by Radix primitives, Tailwind v4, and Lucide icons. The Web Pay Pro screens in `src/components/webpaypro/` mostly do *not* use these primitives — they use raw Tailwind with the brand palette (`#003C18`, `#00562B`, `#2F9E32`, `#B7F000`, `#C8D0C4`). Match the existing style of the file you're editing rather than mixing the two.
