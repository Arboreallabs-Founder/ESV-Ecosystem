# HR Document Generation — build plan

Implementation plan for the module specified in [DOCUMENTS.md](DOCUMENTS.md). That file records
*what was decided*; this one records *how it gets built and in what order*.

## Shape of the thing

Three layers, built bottom-up, because each is useless without the one beneath it:

```
Phase 4/5   Templates + verification page   ← what people see
Phase 3     Document engine                 ← IDs, storage, hashing, permissions
Phase 1/2   Employee + compensation data    ← what letters are made of
```

Every document is a template over data we hold. **A salary certificate with no salary in the
system is a text box someone types into** — at which point it's a Google Doc with extra steps. So
the data model comes first even though the visible payoff comes last.

---

## Phase 1 — Employee profiles  ✅ built

A `employee_profiles` table keyed to `users`, **not** more columns on `users`.

The reason is blast radius. `users` is `select('*')`-ed in a dozen places; every field added there
starts flowing to anywhere a user row is read. Employment data is not secret, but date of birth
and residential address don't belong in a task-board payload. A separate table means one policy
governs one table.

| Field | Notes |
|---|---|
| `user_id` | PK and FK to `users`, one profile per person |
| `employee_code` | e.g. `ESV-014`; unique per org |
| `date_of_joining` | Needed by almost every letter |
| `employment_type` | full_time · intern · contract · consultant |
| `probation_end_date`, `confirmation_date` | Drive the probation confirmation letter |
| `reporting_manager_id` | FK to `users` |
| `work_location` | |
| `notice_period_days` | Relieving letters |
| `date_of_exit`, `exit_reason` | Null until someone leaves |
| `legal_name` | As on PAN — routinely differs from display name, and the letter must match ID |
| `date_of_birth` | |
| `residential_address` | Address proof letters |
| `personal_email` | Reachable after their work account is closed |
| `emergency_contact_name`, `emergency_contact_phone` | |

**Access:** founder/admin/HR read and write anyone's; everyone reads their own. Nobody else.

**UI:** a *People* tab in HR Zone — roster on the left, profile form on the right.

## Phase 2 — Compensation  ✅ built

`employee_compensation`, separate again and for a stronger reason: putting CTC on `users` or even
on `employee_profiles` means anything reading those rows can read salary. One table, one policy,
no accidental leaks through a join someone wrote six months ago.

**Effective-dated, never overwritten.** Each row is a compensation record valid from a date. An
increment inserts a new row; the old one stays. Two consequences that matter:

- A payslip for March must reflect what was true in March, not what's true today.
- "What was their CTC when they joined" stays answerable.

| Field | Notes |
|---|---|
| `user_id`, `effective_from` | Together identify a record |
| `annual_ctc` | The headline figure |
| `basic`, `hra`, `special_allowance` | Breakdown |
| `employer_pf`, `gratuity`, `variable_pay` | |
| `other_allowances`, `notes` | |
| `currency` | Defaults INR; here so a future overseas hire isn't a migration |

**Access:** founder/admin/HR only. No self-read — deliberately: an employee seeing their own CTC
row is a feature to design (which fields, what history), not a default to fall into. Revisit with
the privacy matrix.

## Phase 3 — Document engine  ✅ built

Three tables and the machinery around them.

**`document_types`** — the catalogue from DOCUMENTS.md as data: code, name, category,
`signature_mode`, whether active. Seeded by migration.

**`document_permissions`** — one row per type × role. Seeded from the approved matrix. This is
the table that exists because of the founder's "keep the structure open to change" instruction:
granting middle management increment letters later is an UPDATE, not a deploy.

**`issued_documents`** — the record of every letter ever produced:

| Field | Why |
|---|---|
| `human_id` | `ESV/2026/EVL/0042` — printed, sequential, guessable |
| `verify_token` | High-entropy, in the QR. Separate *because* `human_id` is guessable |
| `storage_path`, `sha256` | The stored artifact and its fingerprint |
| `payload` (JSONB) | Snapshot of every value merged into the letter |
| `signature_mode` | Copied from the type at issue time, not read live |
| `revoked_at`, `revoked_by`, `revoked_reason` | Withdrawal without deletion |

**The payload snapshot is the subtle one.** A letter asserts facts as at its issue date. If
someone's designation changes next year, the letter already sent must not silently change with
it. Storing the merged values — rather than re-deriving them — is what makes an issued document
immutable in substance as well as in bytes.

**Generate once, never regenerate.** Font subsetting and embedded timestamps make PDF output
non-byte-stable, so a regenerated file has a different hash and every verification against it
fails. Generate → store → hash the stored bytes → serve that artifact forever.

**Renderer:** `@react-pdf/renderer`. Server-side, deterministic, no headless Chromium. Puppeteer
needs a bundled binary that is painful and slow on Vercel.

---

## Phase 4 — Templates  ✅ built

Cheapest first, so the engine is proven before the fiddly ones:

1. **Leave & attendance** — reads straight off `leave_requests`, needs nothing from Phases 1–2
2. **Employment verification** — needs only `date_of_joining`
3. **Onboarding**
4. **Compensation** — needs Phase 2
5. **Exit**

## Phase 5 — Verification page and HR Zone tab  ✅ built

Public `/verify/[token]`, no auth, showing what the letter claims so a bank can check it against
the paper in front of them. Plus the *Documents* tab in HR Zone for issuing and browsing.

Both open questions were resolved as recommended: the page **shows the employee's name** (a
verifier needs to check the letter in front of them matches the record), and a revoked document
**says "withdrawn"** rather than 404ing (a dead link is indistinguishable from a forgery).

`/verify/` is in `PUBLIC_ROUTES` in `src/proxy.ts` — gating it behind login would make every
issued document unverifiable by the people it is issued for.

## Phase 6 — Remaining templates

25 of the 29 catalogued types have templates. Not yet written:

- **Offer Letter** — needs offered CTC and terms that aren't in the system until someone joins
- **NDA**, **Code of Conduct** — multi-page legal text; better as managed uploads than merges
- **Payslip** — needs a monthly payroll run, not just an annual package
- **Testimonial** and **Best Performer** are built, but the testimonial has no approval step on its
  free-text wording and the certificate doesn't yet pull kudos counts from Engage/Analytics

Types without a template are hidden from the issue picker rather than offered and failing.

---

## Risk notes

**Phase 3 is where the irreversibility is.** The ID scheme, the token, and the hashing model are
hard to change once letters are in circulation, because fixing them means reissuing documents
that third parties already hold — and a reissued PDF fails verification against the ID printed on
the copy in someone's file. Phases 1, 2 and 4 are ordinary schema and templating work that can be
revised freely.

**Typeface.** Documents render in react-pdf's built-in Times-Roman, not the letterhead's Book
Antiqua, until someone
confirms the Monotype licence permits embedding in redistributed PDFs. Visually close; legally
uncomplicated.

**None of the signature modes is a digital signature.** See DOCUMENTS.md — a rendered signature
image is a picture of a name. If a document is ever contested, that conversation starts with a
licensed CA or an Aadhaar eSign provider, and it is not a small integration.
