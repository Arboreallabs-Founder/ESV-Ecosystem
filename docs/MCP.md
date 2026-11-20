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

## Tools (pilot)

| Tool | Kind | Goes through |
|---|---|---|
| `whoami` | read | `getUser()` |
| `list_my_tasks`, `get_task` | read | RLS-bound reads, `getTaskComments` |
| `create_task` (self-assigned) | write | `createTask` |
| `update_task_status` | write | `updateTaskStatus` (+ read-back, since it doesn't report RLS no-ops) |
| `add_task_comment` | write | `addTaskComment` |
| `search_companies`, `get_company` | read | RLS-bound reads |

Not exposed yet, on purpose: deletes, admin, HR/compensation, investors.

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
