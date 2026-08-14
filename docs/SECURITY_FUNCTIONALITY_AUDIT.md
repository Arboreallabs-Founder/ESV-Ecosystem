# ESV Ecosystem Security and Functionality Audit

**Audit date:** 13 August 2026  
**Repository revision:** `ca401ad`  
**Application:** Next.js 16.2.6 / React 19.2.4 / Supabase  
**Overall risk:** **Critical — production remediation is required**

## Executive summary

This repository-wide static audit found strong foundations—central authentication guards, extensive row-level security (RLS), a passing production build, a passing TypeScript check, and no committed Supabase service-role key. Those controls are undermined by authorization defects at the database boundary.

The most urgent issues are:

1. A tenant founder/admin can promote a user to `super_admin`, which activates the cross-tenant RLS bypass.
2. Demo login credentials, including a PIN and fallback password, are committed in source and exposed through a public Server Action.
3. Anonymous users can enumerate every `form_links` row, including the bearer tokens intended to protect public forms.
4. Several `SECURITY DEFINER` functions perform privileged, cross-tenant writes without verifying the caller; some also retain PostgreSQL's default `PUBLIC` execute privilege.
5. Row-level `UPDATE` policies are treated as though they restrict columns. They do not. Employees can directly self-approve leave/expense requests and rewrite HR profile fields through the Supabase API.
6. The private HR-document storage policy omits tenant scoping, allowing HR/founder/admin users from one organization to access files belonging to another organization.
7. The committed migrations cannot create a clean database because many foundational tables are absent, an init migration is empty, and the configured seed file does not exist.

The application should not be considered safely multi-tenant until the Critical findings are remediated and verified using role-by-role integration tests against a clean database.

### Finding count

| Severity | Count |
|---|---:|
| Critical | 7 |
| High | 7 |
| Medium | 9 |
| Low | 1 |
| **Total** | **24** |

## Scope and method

The audit covered:

- 396 files under `src/` and all 100 committed Supabase migrations.
- Server Components, Client Components, Server Actions, route handlers, Proxy routing, authentication guards, public bearer-link workflows, file upload/download flows, and the Supabase Edge Function.
- RLS policy composition, tenant boundaries, role transitions, `SECURITY DEFINER` functions, storage policies, and schema reproducibility.
- Dependency vulnerabilities, build, TypeScript, ESLint, test inventory, secret-pattern scanning, and deployment configuration.
- The locally installed Next.js 16 authentication, data-security, CSP, and Proxy documentation, as required by this repository's `AGENTS.md`.

This was a source-code audit, not a penetration test of the deployed application. The live Supabase schema, grants, Auth settings, bucket configuration, production environment variables, Vercel settings, logs, and real tenant data were not available. A Supabase CLI database reset could not be run because the CLI is not installed; the migration-chain defect is nevertheless directly demonstrated by the missing `CREATE TABLE` statements.

## Findings overview

| ID | Severity | Finding | Primary impact |
|---|---|---|---|
| SEC-01 | Critical | Tenant administrators can create or promote `super_admin` users | Cross-tenant privilege escalation |
| SEC-02 | Critical | Demo PIN and fallback credentials are committed | Authentication bypass |
| SEC-03 | Critical | Anonymous users can enumerate public-form bearer tokens | Unauthorized disclosure and submissions |
| SEC-04 | Critical | Privileged database functions lack caller authorization | Cross-tenant data mutation |
| SEC-05 | Critical | RLS update policies permit sensitive column tampering | Self-approval and HR/document fraud |
| SEC-06 | Critical | HR-document storage is not tenant-scoped | Cross-tenant HR document exposure |
| OPS-01 | Critical | Migration history cannot reproduce the database | Recovery/deployment failure |
| SEC-07 | High | Storage policies ignore parent-record authorization | Confidential file disclosure/tampering |
| SEC-08 | High | Public form RPC trusts caller-supplied graph identifiers and is unthrottled | Workflow corruption and spam |
| SEC-09 | High | Public bearer workflows do not expire or prevent replay | Persistent unauthorized mutation |
| SEC-10 | High | Production and tooling dependencies have known vulnerabilities | Proxy bypass, DoS, disclosure, toolchain risk |
| FUN-01 | High | Intended public `/fr` and `/il` routes are redirected to login | Core sharing workflows are broken |
| FUN-02 | High | Multi-step writes are non-transactional | Partial state and destructive data loss |
| FUN-03 | High | No tests exist and lint fails with 172 errors | Regression and authorization risk |
| SEC-11 | Medium | Security headers and CSP are absent | Larger XSS/clickjacking blast radius |
| SEC-12 | Medium | Image mirroring remains vulnerable to redirect/DNS SSRF and memory pressure | Internal request and availability risk |
| SEC-13 | Medium | ID photos share a public, broadly writable avatar bucket | Employee privacy and upload abuse |
| SEC-14 | Medium | Repository auth defaults and setup accounts are weak | Accidental weak-account provisioning |
| SEC-15 | Medium | Hidden partner-sourced deals remain visible to the sourcing partner | Incomplete access revocation |
| SEC-16 | Medium | Stored external URLs are rendered without a central scheme policy | Unsafe navigation/content handling |
| FUN-04 | Medium | Self-service profile updates lack an RLS policy | Settings fail for non-admin users |
| FUN-05 | Medium | Linked Privacy/Terms routes do not exist | Broken legal/compliance UX |
| FUN-06 | Low | Partner landing routes are inconsistent | Unpredictable navigation |
| FUN-07 | Medium | Audit logging fails open | Incomplete audit history |

## Detailed security findings

### SEC-01 — Tenant administrators can promote users to `super_admin` (Critical)

**Evidence**

- `src/app/actions/admin.ts:12-23` and `:48-71` accept an untrusted `role: string` and write it without an allowlist.
- `supabase/functions/create-user/index.ts:27-38,64-68` authorizes a tenant founder/admin, then uses the service role to assign the caller-provided role.
- `supabase/migrations/20260700300000_rls_org_scoped.sql:119-128` lets a founder/admin update any user in their organization but does not restrict the target role.
- `supabase/migrations/20260700200000_org_helper_functions.sql:13-18` defines `is_super_admin()` using only `users.role = 'super_admin'`.
- `supabase/migrations/20260700100000_add_org_id_columns.sql:28-31` permits a `super_admin` row to retain an organization ID.

**Impact**

A tenant founder/admin can tamper with a Server Action argument or call Supabase directly to assign `super_admin` to an existing or new user. That user then satisfies the global `is_super_admin()` bypass used across RLS policies and can access other tenants.

**Remediation**

- Immediately audit all `users.role = 'super_admin'` rows and role-change history.
- Allow tenant administrators to assign only an explicit tenant-role enum that excludes `super_admin`.
- Put super-admin assignment behind a separate platform-admin-only transaction.
- Add a database trigger or restrictive policy preventing any non-super-admin caller from setting `role = 'super_admin'` or changing `org_id`.
- Validate role values independently in the Server Action, Edge Function, and database.

### SEC-02 — Demo PIN and fallback credentials are committed (Critical)

**Evidence**

`src/app/actions/demo.ts:6-14` contains a static PIN (`1551`), a fixed demo email, and a committed fallback password. The public `verifyPinAndLogin` Server Action checks only that PIN and has no throttling or environment gate.

**Impact**

Anyone with source access—and potentially anyone who discovers the PIN—can obtain an authenticated demo session. If the demo account is connected to real or writable tenant data, this is a direct authentication bypass. Even an isolated demo tenant is exposed to automated abuse.

**Remediation**

- Rotate the demo password immediately and remove the committed PIN/password fallback.
- Disable demo login in production unless explicitly enabled by a server-only environment flag.
- Use expiring, high-entropy, single-use access grants with rate limiting.
- Host demo data in an isolated project or strictly read-only tenant and prohibit privileged roles.

### SEC-03 — Anonymous users can enumerate form bearer tokens (Critical)

**Evidence**

`supabase/migrations/20260700300000_rls_org_scoped.sql:520-523` creates an anonymous `SELECT` policy on `form_links` with `USING (true)`. Public rendering later moved to narrow `SECURITY DEFINER` RPCs, so direct table access is no longer necessary.

**Impact**

Assuming the normal Supabase `anon` table grant remains, an unauthenticated caller can list every form-link row and bearer token. Token secrecy is then defeated, exposing form metadata and enabling unauthorized submissions and spam across tenants.

**Remediation**

- Drop the anonymous table policy and revoke direct `anon` access to `form_links`.
- Return only the minimum public fields through `get_public_form(token)`.
- Rotate existing tokens because they may already have been exposed.
- Add an automated assertion that `anon` cannot select from any bearer-token table.

### SEC-04 — Privileged database functions lack caller authorization (Critical)

**Evidence**

The following `SECURITY DEFINER` functions perform privileged reads or writes without checking the caller's role and organization:

- `withdraw_partner_attribution` in `20260919000000_partner_attribution_approval.sql:139-172` lets any authenticated caller with a claim UUID remove partner credit and reject the claim.
- `apply_partner_attribution` in the same file at `:92-133` checks claim state but not whether the caller is permitted to apply it.
- `sync_fundraise_from_investor_list` in `20260914000000_fundraise_status.sql:154-190` can create/update another tenant's fundraise workflow from a supplied list UUID.
- `seed_angel_reachout` and `generate_fundraise_tasks` in `20260917000000_pre_workflow_and_angels.sql:152-175,206-315` mutate privileged data without caller checks; the latter processes every organization.
- `next_document_human_id` in `20260823200000_document_engine.sql:237-263` accepts an arbitrary organization ID without authorization.

Several functions use `GRANT EXECUTE ... TO authenticated` without first executing `REVOKE ... FROM PUBLIC`. PostgreSQL functions are executable by `PUBLIC` by default, so such a grant does not itself restrict anonymous/public invocation. Only the attribution functions explicitly revoke `PUBLIC`, but they still grant every authenticated user access.

**Impact**

Direct RPC calls can bypass Server Action guards and RLS, causing cross-tenant workflow changes, partner-credit removal, global task mutation, and metadata disclosure.

**Remediation**

- Revoke `PUBLIC`, `anon`, and broad `authenticated` execute privileges from all internal functions.
- Inside each privileged function, verify `auth.uid()`, caller role, caller organization, target-row organization, and allowed state transition.
- Prefer narrow RPCs for a single operation/tenant; run global automation only as a scheduler-owned/service-role job.
- Add a migration test that inventories every `SECURITY DEFINER` function, owner, `search_path`, grants, and authorization predicate.

### SEC-05 — RLS update policies permit sensitive column tampering (Critical)

RLS policies decide which rows may be updated; they do not limit which columns a direct API caller can submit. Several policies incorrectly rely on the Server Action being the only caller.

**Evidence and abuse cases**

- `20260814500000_expense_requests_and_bucket.sql:53-75`: a requester can update a pending expense row, while `WITH CHECK` requires only ownership. The requester can directly set `status = 'approved'`, change the amount, or populate decision fields.
- `20260814400000_leave_requests.sql:56-78`: the same pattern allows a requester to self-approve or otherwise rewrite a pending leave request.
- `20260824000000_id_card_and_blood_group.sql:31-39`: the comment says the Server Action limits updates to `id_photo_url`, but the policy permits the employee to update every column of their `employee_profiles` row, including fields used in official HR documents.
- `20260823200000_document_engine.sql:223-231`: founder/admin/HR may update all columns of an issued-document row, despite the stated immutability of the payload, identifiers, verification token, and hash.

**Impact**

Authenticated users can bypass workflow approval, falsify HR data, and undermine document integrity using direct Supabase requests.

**Remediation**

- Revoke broad table `UPDATE` grants and expose narrow, validated RPCs for transitions such as withdraw, approve, set-ID-photo, attach-file, and revoke-document.
- Add triggers that enforce valid state transitions, immutable columns, actor separation, and decision metadata.
- Where appropriate, use column-level grants or split sensitive and self-service fields into separate tables.
- Test each role by calling PostgREST directly, not only through the UI.

### SEC-06 — HR-document storage is not tenant-scoped (Critical)

**Evidence**

`20260823200000_document_engine.sql:305-319` allows any authenticated founder/admin/HR to select or insert any object in the `hr-documents` bucket. It never checks the organization prefix in the object path. `src/lib/documents/engine.ts:110-121` stores documents beneath an organization-derived path, but the storage policy does not enforce it.

**Impact**

A founder/admin/HR user in one tenant can list, read, or write another tenant's employment and compensation documents if they can enumerate object names; the broad select policy may itself permit enumeration.

**Remediation**

Require `(storage.foldername(name))[1] = get_user_org_id()::text`, validate the linked `issued_documents` row and role, and deny overwrite/delete for immutable artifacts. Review storage access logs and rotate/reissue signed links if cross-tenant access may have occurred.

### SEC-07 — Storage policies ignore parent-record authorization (High)

**Evidence**

- `20260814500000_expense_requests_and_bucket.sql:96-116` lets every member of an organization read, insert, update, and delete every expense object under that organization's prefix, even though expense rows are limited to the requester and approvers.
- `20260712000000_deal_desk.sql:210-231` similarly lets every tenant member manipulate every Deal Desk object, while Deal Desk records have author/reviewer controls.

**Impact**

Users can access or tamper with invoices, pitch materials, voice notes, and other confidential attachments they cannot access through the parent table.

**Remediation**

Make storage authorization derive from the referenced request/deal and its RLS-equivalent role rules. Restrict write/delete to the owner or authorized reviewer and use immutable object names where possible.

### SEC-08 — Public form RPC trusts caller-supplied graph identifiers and is unthrottled (High)

**Evidence**

`20260726000000_form_submission_creates_company.sql:5-63` validates that the link, form, and pipeline match, but it does not validate that:

- `p_first_stage_id` belongs to that pipeline or represents its permitted entry stage;
- each answer's `node_id` belongs to that form;
- answer, submitter, and array sizes are within reasonable limits;
- a request is unique, human, or within a rate limit.

The function also creates or links a company from public input.

**Impact**

A token holder can place entries in unintended stages, attach answers to unrelated form nodes when IDs are known, create unwanted company records, and flood storage/database resources.

**Remediation**

Derive form, pipeline, and initial stage solely from the token inside the RPC. Join every node to the resolved form, validate JSON shape and length, cap request sizes, add per-token/IP throttling and CAPTCHA or another abuse control, and add idempotency/replay handling.

### SEC-09 — Public bearer workflows do not expire or prevent replay (High)

**Evidence**

- `20260901000000_investor_lists.sql:191-235` permits anonymous responses while a list is shared and allows later calls to overwrite item decisions.
- `20260914000000_fundraise_status.sql:193-282` exposes founder views/comments by persistent token.
- Form, investor-list, and fundraise actions do not implement token expiry, rotation-on-use, rate limiting, or strong replay protection.

**Impact**

A leaked URL remains useful until manually unshared. Any holder can repeatedly alter investor decisions or post comments, with no authenticated identity binding.

**Remediation**

Store token hashes, issue expirations, rotate/revoke tokens, make finalized responses immutable unless explicitly reopened, throttle public RPCs, and log token lifecycle/use without logging the raw token.

### SEC-10 — Dependencies contain known vulnerabilities (High)

`npm audit --package-lock-only` reported **23 vulnerable dependency nodes: 22 high and 1 moderate** on the audit date. The production dependency `next@16.2.6` is affected by nine advisories fixed in `16.2.11`, including App Router Proxy bypass, Server Action denial of service, response cache confusion, endpoint disclosure, and issues affecting custom servers, rewrites, Edge actions, or image optimization depending on deployment usage.

The lint/toolchain graph also carries high-severity findings through `eslint`, `eslint-config-next`, `minimatch`, `brace-expansion`, and `js-yaml`; `postcss`, `nanoid`, and `sharp` are also present in affected paths.

**Remediation**

Upgrade `next` and `eslint-config-next` together to at least `16.2.11` (prefer the current supported patch after compatibility testing), refresh the lockfile, update the lint stack, and require dependency scanning in CI. Re-run the build and behavior tests after upgrades.

### SEC-11 — Security headers and CSP are absent (Medium)

`next.config.ts` configures only cache stale times and `vercel.json` configures only the region. No Content Security Policy, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or anti-framing directive was found.

Add a nonce-based CSP compatible with the App Router's inline bootstrap requirements, `frame-ancestors`, and the remaining response headers. Roll out CSP in report-only mode first and verify Supabase, OAuth, storage, and PDF/image requirements.

### SEC-12 — Image mirroring has residual SSRF and memory-pressure paths (Medium)

`src/lib/image-cache.ts:47-70` checks only the original hostname text. `fetch` then follows redirects automatically (`:91-96`) without validating each destination or the resolved IP. DNS rebinding, IPv4-mapped/alternate IP representations, and redirects to private or link-local services remain possible. The function calls `arrayBuffer()` before enforcing the 5 MB cap (`:114-117`), so a large/chunked body can consume memory first.

Resolve and validate IPs, disable automatic redirects and validate each hop, block all private/link-local IPv4 and IPv6 ranges, stream with a hard byte limit, reject oversized `Content-Length` early, and consider an outbound allowlist/proxy.

### SEC-13 — ID photos use a public, broadly writable avatar bucket (Medium)

`20260803000000_user_profile_and_investor_username.sql:10-22` makes `profile-photos` public and lets a user manage any object under their user-ID prefix. `20260824000000_id_card_and_blood_group.sql:13-15` stores ID-card photos in that same public bucket. The bucket migration does not set a narrow MIME allowlist and the repository-wide local limit is 50 MiB.

Move ID photos to a private bucket, authorize them through the employee/document record, return short-lived signed URLs, validate image signatures/MIME/dimensions server-side, and apply a small bucket-level limit.

### SEC-14 — Weak repository auth defaults and predictable setup accounts (Medium)

`setupUsers.js:12-15` contains four predictable `password123` accounts. The repository's local Supabase config permits signup, has a six-character minimum, no password complexity, and no secure password-change requirement. Local config does not prove production has these settings, but it is an unsafe baseline and can be copied accidentally.

Remove or clearly quarantine the setup script, use generated one-time credentials, disable public signup for an allowlist-only product, require stronger passwords, and verify the deployed Auth configuration separately.

### SEC-15 — Hidden partner-sourced deals remain visible to the sourcing partner (Medium)

`docs/ROLES.md:237-242` records a known gap: the visibility toggle gates the “active deal” partner policy, but `20260906000000_partner_pipeline.sql:101-109` separately permits partners to read their own sourced entries. Permissive RLS policies are ORed, so `visible_to_partners = false` does not fully hide that deal from its sourcing partner.

Define the desired rule explicitly and replace the overlapping policy with a consolidated predicate that enforces the visibility flag for every access path.

### SEC-16 — Stored external URLs lack a central scheme policy (Medium)

Many database-backed values are rendered directly into anchors, including event media, task links, company product/document links, investor/partner URLs, and Deal Desk links. Some display helpers call `new URL()`, but there is no repository-wide requirement that saved/rendered URLs use only `https:` or an explicitly allowed scheme.

Validate and normalize URLs on write and again at the rendering boundary. Permit `https:` by default, narrowly allow `mailto:`/`tel:` where intended, and reject script, data, file, credential-bearing, or local-network URLs.

## Detailed functionality and operational findings

### OPS-01 — Migration history cannot reproduce the database (Critical)

The migration chain alters and applies policies to core tables for which no committed `CREATE TABLE` exists, including `approved_emails`, `pipelines`, `pipeline_stages`, `pipeline_entries`, `forms`, form graph/link tables, `deal_categories`, `active_deals`, and `active_deal_investors`.

Additionally:

- `supabase/migrations/20260526031202_init_schema.sql` is zero bytes.
- `supabase/config.toml:60-65` enables seeding from `./seed.sql`, but `supabase/seed.sql` is absent.
- Later migrations assume the missing live-project baseline already exists.

**Impact**

A clean environment, disaster-recovery database, CI RLS test database, or new developer stack cannot be reliably created from source control. This also prevents repeatable verification of security fixes.

**Remediation**

Export a sanitized canonical baseline from the live project, reconcile it with migration history, add the missing seed or disable it, and prove `supabase db reset` succeeds from an empty database. Do not copy production data or secrets into the baseline.

### FUN-01 — Intended public routes are redirected to login (High)

`src/proxy.ts:7` allows `/f/` and `/verify/` but omits `/fr/` and `/il/`. Both omitted routes are explicitly implemented as account-free founder experiences, and the application generates their share links. An unauthenticated visitor is redirected by `src/proxy.ts:33-35` before the page can call its public RPC.

Add `/fr/` and `/il/` to the public route policy, preferably as an explicit matcher/route classification with tests. Fixing this will expose the bearer endpoints as intended, so remediate SEC-09 at the same time.

### FUN-02 — Multi-step writes are non-transactional (High)

Examples:

- `src/app/actions/forms.ts:70-123` deletes the existing form graph before recreating it. A node/edge failure destroys the prior graph; option insert errors are ignored.
- `src/app/actions/forms.ts:19-45` creates the form and then performs three unchecked node inserts, allowing a partially initialized form.
- `src/app/actions/fundraise.ts:78-99` changes status and then inserts the timeline event without checking the event result.
- Deal, partner-referral, company-sync, and other workflows contain similar multi-call sequences.

Move business invariants into transactional database functions. For graph saves, validate a complete proposed graph first and replace it atomically. Treat required audit/timeline writes as part of the same transaction.

### FUN-03 — No tests exist and lint fails (High)

- No `*.test.*`, `*.spec.*`, `tests/`, or `__tests__/` files were found.
- `package.json` has no test script or test framework.
- `npm run lint` fails with **228 problems: 172 errors and 56 warnings**. Findings include render-time mutation/impurity, state updates in effects, extensive `any` usage, and dead/unsafe patterns.
- There are no automated RLS, tenant-isolation, role-transition, public-token, migration-reset, or Server Action authorization tests.

Add CI gates for lint, typecheck, production build, unit/component tests, and a clean Supabase reset followed by role-matrix integration tests. Fix behavior-related React lint errors before suppressing style-only debt.

### FUN-04 — Self-service profile updates lack an RLS policy (Medium)

`src/app/actions/profile.ts:6-29` offers every authenticated user name/contact/photo updates on `public.users`, but the latest migrations define only self-select and founder/admin update policies (`20260700300000_rls_org_scoped.sql:108-128`). Non-admin users therefore receive an RLS failure in Settings.

Do not add a broad self-update policy, because that would also expose `role` and `org_id`. Use a narrow RPC or column privileges for the allowed profile fields.

### FUN-05 — Linked Privacy/Terms routes do not exist (Medium)

The Proxy treats `/privacy` and `/terms` as public, and `src/app/login/page.tsx:215` links to `/privacy`, but neither route exists under `src/app`. Users receive a 404 from a legal/compliance link. Implement both pages and add a route smoke test.

### FUN-06 — Partner landing routes are inconsistent (Low)

Partner login redirects differ by entry path:

- `src/proxy.ts:49-53` and credential login use `/portal`.
- `src/app/page.tsx:7-10` and OAuth callback use `/my-companies`.

Choose one canonical landing route and use a shared role-to-home mapping.

### FUN-07 — Audit logging fails open (Medium)

Security-relevant edit logs are explicitly best-effort. Examples include `src/app/actions/events.ts:96-102,144-153` and `src/app/actions/investors.ts:260-274`, where errors are swallowed and the underlying write succeeds.

For changes that require accountability, write the change and audit event in one database transaction. At minimum, capture audit failures in central monitoring and alert on them.

## Verification results

| Check | Result | Notes |
|---|---|---|
| `npm ci` | Pass | Clean dependency installation completed; lifecycle-script warnings were emitted for native packages. |
| `npx tsc --noEmit` | Pass | No TypeScript errors. |
| `npm run build` | Pass | Next.js 16.2.6 production build completed and generated 44 static pages. |
| `npm run lint` | **Fail** | 228 problems: 172 errors, 56 warnings. |
| Test discovery | **Fail / absent** | No tests or test script found. |
| `npm ls --all --omit=optional` | Pass | Installed dependency graph resolves. |
| `npm audit --json --package-lock-only` | **Fail** | 22 high, 1 moderate vulnerable dependency nodes. |
| Secret-pattern scan | Partial pass | No committed service-role/private key found; demo credentials and predictable setup passwords were found. |
| Production build route review | **Fail** | `/fr/[token]` and `/il/[token]` build but are not classified as public by Proxy. |
| Clean database reset | Not run | Supabase CLI unavailable; static inspection proves foundational schema and seed inputs are missing. |

## Positive controls observed

- Server Actions commonly centralize authentication through `requireAuth` and `requireRole`.
- Page code generally treats Proxy session checks as navigation optimization rather than the sole security boundary.
- RLS is enabled broadly and most tenant policies compare against `get_user_org_id()`.
- Many `SECURITY DEFINER` functions pin `search_path`, reducing object-shadowing risk.
- Public document verification returns a constrained payload instead of exposing the private PDF.
- External image mirroring restricts protocols, common private IPv4 literals, response MIME, timeout, and nominal file size, even though redirect/DNS gaps remain.
- React output is used instead of raw HTML injection; no `dangerouslySetInnerHTML` use was found.
- No Supabase service-role value, private key, or `.env.local` file is tracked by Git.
- Type checking and production compilation both succeed.

## Prioritized remediation plan

### Immediate: 0–24 hours

1. Disable production demo login, rotate its password, and review demo-account access/activity.
2. Block tenant users from assigning `super_admin`; audit current roles and role changes.
3. Revoke/disable unsafe RPC execution, especially attribution withdrawal/application, fundraise sync, angel seeding, global task generation, and document ID allocation.
4. Drop anonymous direct `form_links` access and rotate public form tokens.
5. Restrict HR-document storage by organization and review storage access logs.
6. Temporarily remove direct requester update privileges on leave/expense and the self-update policy on `employee_profiles` until safe RPCs are deployed.
7. Upgrade Next.js to a patched release and redeploy after smoke testing.

### Short term: 2–7 days

1. Replace sensitive direct updates with transactional RPCs and database-enforced state machines/immutability.
2. Correct all storage policies to enforce both tenant and parent-record authorization.
3. Harden and throttle public bearer workflows; add expiry, replay rules, and token rotation.
4. Fix `/fr` and `/il` routing together with the bearer security changes.
5. Reconstruct a complete database baseline and prove a clean reset.
6. Add high-priority integration tests covering every role and cross-tenant negative cases.

### Medium term: 2–4 weeks

1. Clear the lint backlog and enforce lint/typecheck/build/test/audit in CI.
2. Make business workflows transactional and audit logs durable.
3. Deploy CSP and other response headers.
4. Separate public avatars from private ID photos and enforce server-side upload validation.
5. Harden outbound fetches and centralize external URL validation.
6. Resolve legal routes, partner routing consistency, and the known partner-visibility gap.

## Required retest matrix

Before declaring remediation complete, test direct PostgREST/RPC/storage calls—not only UI behavior—for:

- `anon`, ordinary authenticated user, associate, general, HR, franchise partner, admin, founder, and super-admin.
- Same-tenant and cross-tenant target IDs.
- Role escalation, self-approval, immutable-column modification, object listing/read/write/delete, and every `SECURITY DEFINER` function.
- Valid, expired, revoked, replayed, malformed, and cross-form bearer tokens.
- A clean migration/reset and seed run from an empty database.
- Production Proxy behavior for every public and private route.

## Residual limitations

- Live database grants or later dashboard-only changes may differ from migrations. That uncertainty increases, rather than removes, the need for live verification.
- No production runtime, WAF/rate-limit configuration, Vercel headers, Supabase logs, bucket settings, backup/restore evidence, or monitoring configuration was inspected.
- OAuth provider configuration, email security, MFA enforcement, incident response, data retention, and third-party compliance require environment and organizational evidence beyond this repository.
- Findings describe reachable code and policy defects; they do not assert that exploitation has occurred.

