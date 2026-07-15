# UI Agent Development

This is a handoff note for the UI-agent work currently sitting in the working tree. If another agent makes the commit, include the files listed here so this work ships with it.

## Built in this pass

### Active Deals list and detail route

The Active Deals module now opens a dedicated record page when a deal card is clicked.

- List route: `src/app/(app)/active-deals/page.tsx`
- Detail route: `src/app/(app)/active-deals/[id]/page.tsx`
- List UI: `src/app/(app)/active-deals/_components/ActiveDealsList.tsx`
- Detail UI: `src/app/(app)/active-deals/_components/ActiveDealPageClient.tsx`
- Shared styles: `src/app/(app)/active-deals/active-deals.module.css`
- Data helper: `src/lib/active-deals.ts`

Notable behavior changes:

- Deal cards navigate to `/active-deals/[id]` instead of opening the old overlay modal.
- Deal cards are keyboard-openable with Enter or Space.
- Links inside deal field values stop propagation, so opening a URL does not also navigate the card.
- State changes on the list are optimistic, but now roll back correctly if `updateDealState` fails.
- The detail page fetches stage history, stage answers, and form answers client-side and now shows an error state if that load fails instead of staying on the loading state forever.

### Active Deals visual redesign

The Active Deals list/detail UI was restyled to feel more like a calm internal deal record and less like a generic card grid.

List changes:

- Header is now a contained module header.
- Deal cards use a quieter raised surface, cleaner title hierarchy, metadata pills, hover/focus affordance, and an "Open record" hint.
- Card spacing and grid sizing were tuned for scanability.

Detail page changes:

- Detail page width increased slightly for a better two-column record layout.
- Added a quick summary rail for Submitter, Assigned, Categories, and Accepted date.
- Main record sections are framed in a calmer left column.
- Investors panel is a sticky right-side workspace on desktop.
- Investor table spacing and totals wrapping were tightened.

### Active Deals data helper cleanup

`src/lib/active-deals.ts` now has a shared `ACTIVE_DEAL_SELECT`, typed row shaping, and a `fetchActiveDeal(id)` helper for the detail route. This removed the previous explicit `any` lint errors in that helper.

### Favicon asset

The favicon source asset was created/updated according to `image-assets.md`.

- Source path: `public/ecosystem-favicon-sapling.png`
- Format: 512x512 RGBA PNG
- Treatment: Sand `#D3C1A9` rounded-square background with Purple `#745FFD` outlined sapling
- No app code was wired for the favicon; the work order said the implementation copy into `src/app/icon.png` would be handled separately.

### Dashboard redesign

The main dashboard was reorganized to make the first screen more action-oriented and less like a wall of equal-weight cards.

- Dashboard page: `src/app/(app)/dashboard/page.tsx`
- Dashboard styles: `src/app/(app)/dashboard/dashboard.module.css`

Layout changes:

- Greeting now sits alone as a compact hero.
- Bulletin Board and Recent Activity are directly under the greeting so the user sees live updates first.
- Quick links moved below the two live panels and now render as a horizontal carousel.
- Overview metrics moved below quick links as a compact "Ecosystem health" section.
- Dashboard CSS was rebuilt around the new hierarchy with calmer 8px cards, fixed carousel item sizing, responsive breakpoints, and denser metrics.

## Files to include in commit

Active Deals files:

- `src/app/(app)/active-deals/[id]/page.tsx`
- `src/app/(app)/active-deals/_components/ActiveDealPageClient.tsx`
- `src/app/(app)/active-deals/_components/ActiveDealsList.tsx`
- `src/app/(app)/active-deals/active-deals.module.css`
- `src/lib/active-deals.ts`

Removed old modal component:

- `src/app/(app)/active-deals/_components/ActiveDealDetail.tsx`

Asset:

- `public/ecosystem-favicon-sapling.png`

Dashboard:

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/dashboard/dashboard.module.css`

Documentation:

- `UI-agent-Development.md`

## Validation already run

These passed after the Active Deals changes:

```bash
npx tsc --noEmit --pretty false
npm run lint -- "src/app/(app)/active-deals/page.tsx" "src/app/(app)/active-deals/[id]/page.tsx" "src/app/(app)/active-deals/_components/ActiveDealsList.tsx" "src/app/(app)/active-deals/_components/ActiveDealPageClient.tsx" "src/lib/active-deals.ts"
npm run build
```

These also passed after the dashboard redesign:

```bash
npx tsc --noEmit --pretty false
npm run lint -- "src/app/(app)/dashboard/page.tsx"
npm run build
```

Local server note:

- `http://localhost:3000/active-deals` responded, but redirected to `/login` in the headless browser check because there was no authenticated session.
- Demo mode did not establish an authenticated session in that headless check.
- So compile/build validation passed, but authenticated visual QA of the private Active Deals screen was not completed from the browser.

## Working tree caution

Earlier dashboard edits were already present in the working tree before the dashboard redesign request. The current dashboard files now include intentional UI-agent changes and should be included if committing the dashboard redesign.
