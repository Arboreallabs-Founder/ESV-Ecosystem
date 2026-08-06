# Earlyseed Ventures (ESV) Ecosystem App Context

## Project Overview
Ecosystem is the unified deal pipeline and CRM platform for Earlyseed Ventures, covering the full IB workflow. It replaces Google Sheets, WhatsApp, and Docs.

## Documentation
This file is deliberately a short orientation doc, not the full picture — it has drifted stale
before (the "What's Built" list below undersells the app significantly). For anything beyond a
quick orientation, read:
- **[docs/FUNCTIONALITY.md](docs/FUNCTIONALITY.md)** — accurate, current, module-by-module rundown
- **[docs/ROLES.md](docs/ROLES.md)** — the authoritative role/permission reference, including the
  `general` role (not covered below)
- **[docs/MIGRATIONS.md](docs/MIGRATIONS.md)** — schema history and phase labeling
- **[docs/DOCUMENTS.md](docs/DOCUMENTS.md)** — HR document generation: issuance matrix, signature
  modes, letterhead and verification model (approved, not yet built)
- **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)** — local env setup
- **[docs/](docs/)** — everything else (brand guidelines, original PRD)

## Current Status (June 2026)
- **Live:** `https://ecosystem.earlyseedventures.com` (deployed on Vercel; the
  `ecosystem-liart.vercel.app` host still resolves and must stay enabled — see docs/DOCUMENTS.md)
- **Repo:** `https://github.com/Arboreallabs-Founder/ESV-Ecosystem` (main branch)
- **Database:** Supabase Cloud Project (`hsabrzwsetjeaqutjrjb`, ap-south-1)
- **Auth:** Google OAuth (primary) + email/password (secondary). Pre-approved emails only via `approved_emails` table.
- **Phases complete:** 1–11, 13–14, 16, 22 + follow-on safety features

## What's Built
The app is a fully functional internal tool covering:
- **Auth** — Google OAuth + email/password; role-gated routes; `/auth/callback` + `/auth/denied`
- **Pipeline (legacy)** — 11-stage Kanban + table view for the old deal flow (`/pipeline`)
- **Intake Pipeline (Phase 22)** — Visual form builder (`/forms/[id]/builder`) → shareable links → public form renderer (`/f/[token]`) → Kanban pipeline board (`/pipelines/[id]`)
- **Investors** — Fund database with outreach tracking per deal
- **Tasks** — Kanban task board linked to deals and assignees
- **Admin** — User management, role assignment, account creation/revocation
- **Partner Portal** — Franchise partner deal submission and tracking
- **Wiki** — In-app reference documentation

## Tech Stack
- **Frontend:** Next.js 16 App Router (React 19), TypeScript
- **Styling:** Vanilla CSS with CSS variables (no Tailwind — removed). All styles in `*.module.css` files.
- **Backend & Auth:** Supabase Cloud (Postgres + Auth + Edge Functions)
- **Deployment:** Vercel (root of repo, Next.js preset)
- **Components:** Custom built; no external dense UI libraries. `@xyflow/react` for form builder canvas only.

## Project Structure
```
/src
  /app
    /actions          — Server actions (pipelines.ts, forms.ts, admin.ts, etc.)
    /admin            — User management + partners pages
    /auth             — /callback and /denied routes
    /dashboard        — Dashboard page
    /forms            — Forms list + [id]/builder
    /f                — Public form renderer (/f/[token])
    /investors        — Investor database
    /login            — Login page
    /pipelines        — Pipeline list + [id] board
    /portal           — Franchise partner portal
    /tasks            — Task board
    /wiki             — Full wiki page
    layout.tsx        — Root layout with app shell
  /lib
    /supabase         — server.ts + client.ts Supabase client helpers
    types.ts          — Shared TypeScript types
    wiki.ts           — Wiki content (WIKI record)
```

## Database (Supabase `hsabrzwsetjeaqutjrjb`)
Key tables: `users`, `approved_emails`, `pipelines`, `pipeline_stages`, `pipeline_entries`, `pipeline_entry_answers`, `pipeline_entry_assignees`, `forms`, `form_nodes`, `form_node_options`, `form_edges`, `form_links`, `deals`, `investors`, `fund_outreach`, `tasks`, `franchise_partners`, `deal_notes`, `deal_documents`, `deal_stage_history`

RLS is enforced via `get_user_role()` SECURITY DEFINER function. All writes go through server actions that call `requireAdmin()` or `requireInternal()`.

## Design & Brand Guidelines
The app must feel premium, using rich aesthetics and smooth interactions.

### Default Theme: ESV Brand
- **Primary Action:** Purple `#745FFD` (CTAs, active states)
- **Primary Light:** Pastel Purple `#CEAAFD` (Hover, tags)
- **Page Background:** Crema `#F7ECE2` (Light) / Deep Navy `#1A1A2E` (Dark)
- **Card Surface:** Fair `#F4F4F4` (Light) / Dark Raised `#22223A` (Dark)
- **Body Text:** Dark `#2C2C3A` (Light) / Off-White `#F0EDE8` (Dark)
- **Muted Text:** Slate `#A39B95`
- **Border / Divider:** Sand `#D3C1A9` (Light) / Dark Border `#3A3A5C` (Dark)
- **Warm Accent:** Bronze `#D5AE8F` (Franchise tags)

### Key UX Principles
- Clean and minimal — data surfaces first.
- Spacious card-based layout (no dense tables as the default).
- ESV brand palette strictly followed.
- Both light and dark mode supported (implemented via CSS variables).
- Role-aware UI (Founder, Admin, Associate, Franchise Partner).
- All modals use `onMouseDown` (not `onClick`) to prevent accidental close on drag.

## Key Conventions
- Server actions live in `/src/app/actions/` and are the only place DB writes happen.
- `requireAdmin()` / `requireInternal()` guards are at the top of every mutating action.
- No `revalidatePath` in actions — components call `router.refresh()` after mutations.
- CSS variables are defined in `src/app/globals.css`. Always use them, never hardcode colours.
- **Pages fill the screen.** Never put `max-width` on a page container or `.page > *`. Content
  adapts to the viewport; where a grid would otherwise stretch, add columns
  (`repeat(auto-fill, minmax(Npx, 1fr))`) rather than capping the container. The only things that
  cap are genuinely fixed artifacts and overlays — modals, the printable ID card, the public
  `/verify` card — and prose line-length on a *paragraph* (`max-width: 60ch` on a subtitle is fine;
  on the container holding it is not). This has been raised twice; check it before shipping a page.
- `@xyflow/react` is used only in the form builder — do not introduce it elsewhere.
