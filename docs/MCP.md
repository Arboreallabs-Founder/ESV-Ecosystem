# Claude connector (MCP)

Employees connect their own Claude to Ecosystem and ask it to do routine updates ("mark the Acme
follow-up done and comment that the deck was sent"). Claude acts **as that employee**: same role,
same RLS, same server actions as the web app. It cannot do anything the person couldn't do in the
browser.

## How it works

```
Claude ──► /api/mcp  (401 + WWW-Authenticate → /.well-known/oauth-protected-resource/api/mcp)
   │                          └─ points at Supabase Auth as the authorization server
   ├──► Supabase Auth OAuth 2.1 server (dynamic client registration, code + PKCE)
   │        └─ sends the person to /oauth/consent in Ecosystem → Allow
   └──► /api/mcp with Bearer <Supabase access token for that user>
            └─ request runs inside mcpAuth (lib/mcp/context.ts), so createClient() builds a client
               for that token — every guard, action and RLS policy applies unchanged
```

| Piece | File |
|---|---|
| MCP endpoint (stateless Streamable HTTP) | `src/app/api/mcp/route.ts` |
| Tools | `src/lib/mcp/tools.ts` |
| Token-bound Supabase client | `src/lib/supabase/server.ts` (`createTokenClient`) |
| Protected-resource metadata (RFC 9728) | `src/app/.well-known/oauth-protected-resource/[[...path]]/route.ts` |
| Consent screen | `src/app/oauth/consent/page.tsx`, `src/app/actions/oauth-consent.ts` |
| Return to consent after sign-in | `src/proxy.ts` (`?next=`), `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/lib/safe-next.ts` |

## One-time Supabase setup

Dashboard → **Authentication → OAuth Server**:
1. **Enable** the OAuth server.
2. **Authorization path:** `/oauth/consent` (relative to the Site URL, which must be
   `https://ecosystem.earlyseedventures.com`).
3. **Allow dynamic client registration:** on. Claude registers itself; there is no client id to
   hand out.

Check: `https://hsabrzwsetjeaqutjrjb.supabase.co/.well-known/oauth-authorization-server/auth/v1`
returns JSON instead of `feature_disabled`.

## Connecting (per employee)

The **Connect your AI assistant** button (spark icon next to the bell, internal roles only;
`src/app/_components/ConnectAssistant.tsx`) shows these steps with the URL to copy, on a Claude
tab and a ChatGPT tab. The server is client-agnostic: both apps use the same URL, the same OAuth
flow (dynamic registration) and the same consent screen.

- **ChatGPT:** Settings → Apps & Connectors → Advanced settings → turn on **Developer mode**
  (needed for write tools) → **Create** → URL `https://ecosystem.earlyseedventures.com/api/mcp`,
  authentication **OAuth** → Connect → sign in → Allow. Enable it per chat from the **+** menu.
  Needs a paid plan; on Business/Enterprise an admin may need to allow custom connectors.

- **Claude (web/desktop):** Settings → Connectors → Add custom connector →
  `https://ecosystem.earlyseedventures.com/api/mcp` → Authentication **Sign in now**, OAuth client
  **Register automatically** (DCR; Supabase doesn't advertise CIMD support, so "Use Claude's
  published identity" fails) → Connect → sign in → Allow.
  On a Team/Enterprise plan an owner can add it once for the organization; each person still signs
  in as themselves.
- **Claude Code:** `claude mcp add --transport http ecosystem https://ecosystem.earlyseedventures.com/api/mcp`,
  then `/mcp` to sign in.

Only internal roles can approve (partners and super admin are refused on the consent screen), and
every tool also runs the app's own role guard.

## Tools

Code: `src/lib/mcp/tools/{tasks,companies,pipelines,deals}.ts`, rules in `tools/shared.ts`.
"Who" is the role needed — the app's own guards and RLS decide; the tool adds nothing.

| Tool | Kind | Who | Goes through |
|---|---|---|---|
| `whoami` | read | internal | `getUser()` |
| `list_my_tasks`, `get_task` | read | internal | RLS reads, `getTaskComments` |
| `create_task` | write | internal | `createTask` (status + completed_at in one insert; `assignee_id` assigns, per the app's rules) |
| `update_task` | write | internal | `updateTask` (merged: only passed fields change; `assignee_id` reassigns) |
| `list_people` | read | internal | RLS read of `users` |
| `team_activity` | read | founder/admin: anyone · General Lead: general users · others: self | tasks + `activity_events` (founder/admin) |
| `update_task_status`, `add_task_comment` | write | internal | `updateTaskStatus`, `addTaskComment` |
| `search_companies`, `get_company`, `list_company_fields` | read | internal | RLS reads |
| `create_company` | write | founder/admin/associate | `findSimilarCompanies` → `createCompany` |
| `update_company` | write | founder/admin/associate | `updateCompany` (never founders/team) |
| `add_founder`, `update_founder` | write | founder/admin/associate | `updateCompany` with an unchanged-since-read guard |
| `set_company_field` | write | founder/admin/associate | `setFieldValue` (type-validated) |
| `create_company_field` | write | founder/admin | `saveFieldDef` |
| `list_pipelines`, `list_pipeline_entries`, `get_pipeline_entry` | read | internal (general: read) | RLS reads + entry actions |
| `create_pipeline_entry` | write | founder/admin/associate | `createEntry` (new) |
| `move_pipeline_entry` | write | founder/admin/associate | `moveEntryChecked` (new: board rules server-side) |
| `list_deals`, `get_deal` | read | internal (general: read) | RLS reads |
| `create_deal` | write | founder/admin/associate | `createStandaloneDeal` + raise/valuation/state actions |
| `update_deal` | write | founder/admin/associate | the same actions, merged |

Not exposed, on purpose: deletes, admin, HR/compensation, investors, accepting an entry (it needs
deal categories — done on the board).

### Changelog

**0.3.0 (2026-11-20)**
- `team_activity` — `person` ('me' | 'team' | user id | name), `from` / `to` (YYYY-MM-DD,
  default this week so far, India time). Per person: tasks completed in the range, open tasks with
  overdue flags, tasks they assigned to others, and — founders/admins only, from the activity
  log — pipeline stage moves and what they created or edited. Visibility as in the table above;
  a name matching several people is refused with the candidates.
- `list_people` — find someone's id by name or email.
- `create_task` gains `assignee_id` (assign to someone; they're notified); `update_task` gains
  `assignee_id` (reassign). The app's assignment rules apply (no partners; associates, general and
  hr only to each other).
- `list_deals` / `list_pipeline_entries` return `has_more` instead of an exact `total` — the exact
  count, plus embedded custom-field values, timed out (8s) on Active Deals' RLS.

**0.2.0 (2026-11-20)**
- Companies: `create_company` (name + any profile field; returns `possible_duplicates` unless
  `force=true`), `update_company` (partial; returns `changed: {field: {before, after}}`),
  `add_founder` / `update_founder` (`founder_index` + `current_name` guard), custom fields:
  `list_company_fields`, `set_company_field`, `create_company_field`.
- Pipelines: `list_pipelines` (stages in order, type, stage questions), `list_pipeline_entries`
  (pipeline / stage / assignee incl. `me` / company; `limit`, `offset`), `get_pipeline_entry`
  (answers, stage answers, history, tasks, deal), `create_pipeline_entry` (`company_id` or
  `company_name` + duplicate check; default first stage; assignees default me),
  `move_pipeline_entry` (`reason` for Rejected, `answers` for question stages, `note` → company
  updates; returns `tasks_raised`).
- Deals (Active Deals): `list_deals` (pipeline / state / owner incl. `me` / company; paginated),
  `get_deal` (+ stage history, tasks), `create_deal` (`total_raise`, `external_raised`,
  `min_ticket`, `valuation` + `valuation_basis`, `state`, `notes`, owners; round and valuation
  mirrored onto the company), `update_deal` (partial, same fields + `company_id`, submitter).
- Tasks: `create_task` gains `status` and `completed_at` (date or ISO; no future dates; Done is
  set in the same insert); new `update_task` (partial).
- Every write tool returns the record after the change. Every write is in Admin → Activity Log,
  marked "via AI connector: Claude/ChatGPT".

**0.1.0 (2026-11-20)** — pilot: `whoami`, `list_my_tasks`, `get_task`, `create_task`,
`update_task_status`, `add_task_comment`, `search_companies`, `get_company`.

## Activity log

`activity_events` (20261121000200) is written by triggers on companies, custom fields and values,
company updates, tasks, task comments, pipeline entries and their assignees, and deals — every
create/update/delete, whatever made it. `source` is `connector` when the request came through
`/api/mcp` (the token-bound client sends `x-ecosystem-source`), `web` otherwise, `system` with no
signed-in user. Readable by founders/admins; shown in Admin → Activity Log.

## Staging

Integration tests and manual MCP-inspector checks run against **Ecosystem Secondary**
(`txjpduzasshgbeunjgyi`), never production. Details in `tests/integration/README.md`.

The migrations folder can't build the database from scratch — the pipelines/forms tables,
`approved_emails` and more were created outside it — so staging is a schema-only copy of
production plus newer migrations:

```powershell
# 1. Production schema (read-only). Use the Session pooler string from the dashboard (Connect);
#    the direct host is IPv6-only. Needs PostgreSQL 17 client tools (pg_dump).
pg_dump "<prod session pooler url>" --schema-only --schema=public --no-owner -f $env:TEMP\ecosystem-prod-schema.sql
# 2. Load it into staging, then the migrations production doesn't have yet.
powershell -File scripts/staging/rebuild.ps1 -Dump $env:TEMP\ecosystem-prod-schema.sql -After 20261120000000
```

### Adding a tool
1. Prefer calling an existing server action — that keeps validation and notifications in one place.
2. Reads may query directly, but only via the client from a guard (`requireRole`/`requireAuth`).
3. Set `annotations.readOnlyHint` honestly; Claude uses it to decide when to ask before calling.
4. Throw `UserFacingError` for refusals; anything else reaches Claude as a generic message (raw
   Postgres text never does).

## Revoking access
Removing someone from `approved_emails` / `users` makes every tool refuse them (the guards find no
row). Their token itself lives until it expires (Supabase access-token lifetime) and can't refresh
once their auth user is disabled or deleted.
