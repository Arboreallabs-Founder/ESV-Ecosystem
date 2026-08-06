# HR Document Generation — decision record

Generates HR letters on ESV letterhead, each with a document ID and a public verification link.

**Status:** built. Phases 1-5 shipped; see [DOCUMENTS_BUILD_PLAN.md](DOCUMENTS_BUILD_PLAN.md)
for what each phase covered and what remains.
**Source:** issuance policy form completed by the founder, 31 July 2026, plus follow-up answers.
This file is the authority on *what was decided and why*. When something here and the code
disagree, the code is the bug.

## Letterhead

Taken from `ESV Letterhead-Updated.docx`:

- **Earlyseed Ventures Private Limited**
- 3 Enterprise Centre, Near Orchid Hotel, Off. Nehru Road, Navpada, Vile Parle East,
  Mumbai 400 099, India
- info@earlyseedventures.com · www.earlyseedventures.com
- T: +91 22 45133786 · **CIN U74999MH2023PTC397996**

Wordmark: `esv primary identity_black.jpg` (light backgrounds) / `_fair.png` (dark).
The brand palette in `ESV Color Palette.jpeg` is already encoded in `globals.css` — crema, fair,
slate, sand, bronze, golden glow, purple, pastel purple — so documents can be brand-exact without
introducing new colour values.

**Typeface caveat:** the letterhead is set in Book Antiqua, a licensed Monotype face embedded in
the `.docx`. Embedding it in PDFs we distribute to third parties is a licensing question nobody
has answered, so generated documents use react-pdf's built-in **Times-Roman** — a standard PDF
base font that needs no embedding at all, which sidesteps the question rather than answering it.
Revisit if someone confirms the Book Antiqua licence covers redistribution.

## Issuance matrix

Who may generate each document. No employee self-service in any category — decided 31 Jul 2026,
revisit later.

### Leave & attendance — *system-generated*
| Document | HR | Admin | Founder |
|---|:--:|:--:|:--:|
| Leave Sanction Letter | ✅ | ✅ | |
| WFH Approval Letter | ✅ | ✅ | |
| Comp-off Confirmation | ✅ | | ✅ |

### Employment verification — *physical signature*
| Document | HR | Admin | Founder |
|---|:--:|:--:|:--:|
| Employment Verification Letter | ✅ | ✅ | |
| Address Proof (bank / telco) | ✅ | ✅ | |
| Bank Account Opening Letter | ✅ | ✅ | |
| Visa / Travel Support Letter | ✅ | ✅ | |
| NOC — travel | ✅ | ✅ | ✅ |
| NOC — higher study | ✅ | ✅ | ✅ |

### Onboarding — *system-generated*
| Document | HR | Admin | Founder |
|---|:--:|:--:|:--:|
| Offer Letter | ✅ | ✅ | ✅ |
| Appointment Letter | ✅ | ✅ | |
| Internship Offer Letter | ✅ | ✅ | |
| Internship Completion Certificate | ✅ | ✅ | |
| Probation Confirmation Letter | ✅ | ✅ | |
| NDA / Confidentiality Undertaking | ✅ | ✅ | |
| Code of Conduct Acknowledgement | ✅ | ✅ | |

### Compensation — *visual signature*
| Document | HR | Admin | Founder |
|---|:--:|:--:|:--:|
| Salary Certificate | ✅ | ✅ | ✅ |
| Payslip (monthly) | ✅ | | ✅ |
| CTC Breakdown Statement | ✅ | ✅ | ✅ |
| Increment Letter | ✅ | ✅ | ✅ |
| Promotion Letter | ✅ | ✅ | ✅ |
| Bonus / Incentive Letter | ✅ | ✅ | ✅ |

Note Payslip excludes Admin while every other compensation document includes them. That asymmetry
is deliberate, not a transcription slip.

### Exit — *physical signature*
| Document | HR | Admin | Founder |
|---|:--:|:--:|:--:|
| Resignation Acceptance | ✅ | | ✅ |
| Relieving Letter | ✅ | ✅ | |
| Experience / Service Certificate | ✅ | ✅ | |
| No-Dues Certificate | ✅ | ✅ | |
| Full & Final Settlement Statement | ✅ | ✅ | |

### Also approved
- **Testimonial to third party** — a template with a free-text body rather than a pure data merge,
  so it needs an approval step on the wording. Approver not yet decided.
- **Best performer certificate** — pulls the period and kudos counts from the existing Engage and
  Analytics modules rather than being typed in.

## Signature modes

Three modes, one per category, chosen by the founder.

| Mode | Categories | What the PDF does |
|---|---|---|
| `system` | Leave & attendance, Onboarding | No signature. Footer reads "System-generated document. Verify at …". |
| `visual` | Compensation | An uploaded signature image of the authorised signatory rendered into the PDF. |
| `physical` | Employment verification, Exit | Printed with a signature line, wet-signed by hand. |

**Physical does not mean scan-and-re-upload** — explicitly decided. The generated PDF *is* the
record; it carries its document ID and verification link from the moment it's created, and is
simply marked as requiring a physical signature. No upload step, no "awaiting signature" state to
chase. The verification page says the document was issued and requires a wet signature to be
valid, which is enough for a third party to sanity-check it.

**None of these is a digital signature.** A rendered signature image is a picture of a name; it
carries no cryptographic weight. Legally binding e-signatures in India (IT Act 2000, ss. 3 and 3A)
require a DSC from a licensed CA or Aadhaar eSign through a licensed ESP — neither can be
self-hosted. Not in scope; revisit if a document is ever contested.

## Document ID and verification

Two separate identifiers, on purpose:

- **Human-readable ID** printed on the letter — `ESV/2026/EVL/0042`. For filing and phone calls.
  Sequential, therefore guessable.
- **Verification token** — high-entropy, in the QR code and short link. Because the printed ID is
  guessable, it must not be what grants access, or someone increments it and reads a colleague's
  letter. Same split as the existing `form_links` → `/f/[token]` public route.

**The verification URL is baked into the PDF permanently.** The custom domain
`ecosystem.earlyseedventures.com` was set after the first documents were issued, so the three
letters issued on 31 Jul 2026 carry `ecosystem-liart.vercel.app` in their footers and always will.
That host must stay enabled on Vercel or those letters become unverifiable. The site URL now has a
single definition in `src/lib/site-url.ts` so a future host change cannot land on some artefacts
and not others.

The PDF is generated once, stored, and hashed. It is **never regenerated** — font subsetting and
embedded timestamps make regeneration non-byte-stable, so the hash would stop matching and every
verification would fail.

**Resolved:** the verification page shows the employee's name, document type and issue date, so a
bank can confirm the letter in front of them matches. A revoked document says so rather than
404ing — a dead link reads as a forgery.

## Out of scope — decided, not overlooked

| Document | Why |
|---|---|
| Form 16 / TDS certificate | Comes from the income-tax portal via payroll. A lookalike is a compliance problem. |
| Termination Letter | Templating it means employment can be ended from a dropdown. |
| Warning Letter / PIP | Needs human drafting and usually legal review. |
| PF / ESIC statements | Come from the EPFO and ESIC portals. |
| Employee self-service | No category, for now. Revisit — employment verification is the obvious first candidate. |

## Permissions are data, not code

Everywhere else in Ecosystem, roles are arrays in TypeScript and RLS policies, so changing one
means a migration and a deploy. This module is different, because of an explicit instruction:

> *"As we grow and middle level management steps on, would later on like to deploy some points in
> clause 4 to them. We need to keep the structure open to change."* — founder, 31 Jul 2026

Clause 4 is compensation. So issuance rights live in a **`document_permissions` table**, one row
per document type × role, seeded with the matrix above. The admin UI for editing it comes later,
but the table lands now: retrofitting it after the guards are written means touching every one of
them.

## Open items

- **Employee privacy matrix** — who can view what, to be decided internally by the founder and HR.
  Separate from issuance rights, which is why it isn't in the table above.
- **Permission-editing UI** — agreed to follow this build.
- **Testimonial approver** — who signs off free-text wording.
- **Signatory** is currently a constant in `src/app/actions/documents.tsx`. When it becomes
  per-document it belongs on `document_types`, not there.
