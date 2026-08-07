/**
 * The one ticket-size formatter.
 *
 * There were three, two of which hardcoded rupees and ignored the currency entirely — so a fund
 * with a $200K–$600K cheque displayed as "₹2L – ₹6L" on the card and in the overlay, and correctly
 * as "$200K – $600K" only on the profile page. An 80x error, shown confidently, in the field
 * someone uses to decide whether a fund is worth approaching at all.
 *
 * Currency is NOT guessed. 22 funds have a range whose currency the source never stated; those are
 * stored with a null currency and the original text in their notes. Rendering them as rupees would
 * be inventing the very number the import refused to invent.
 */

/** Indian numbering for INR (lakh/crore), Western for USD — each in the units its readers use. */
function short(n: number, currency: 'INR' | 'USD'): string {
  if (currency === 'INR') {
    if (n >= 10_000_000) return `₹${trim(n / 10_000_000)}Cr`
    if (n >= 100_000) return `₹${trim(n / 100_000)}L`
    return `₹${n.toLocaleString('en-IN')}`
  }
  if (n >= 1_000_000) return `$${trim(n / 1_000_000)}M`
  if (n >= 1_000) return `$${trim(n / 1_000)}K`
  return `$${n.toLocaleString('en-US')}`
}

/** 1.5 stays 1.5, 2.0 becomes 2 — a trailing zero reads as false precision. */
const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/**
 * A ticket range, or null when there is nothing meaningful to show.
 *
 * A null currency renders the bare numbers with a note rather than a symbol: the amount is real,
 * the unit is genuinely unknown, and picking one silently is how the wrong number gets believed.
 */
export function formatTicketRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: 'INR' | 'USD' | null | undefined,
): string | null {
  if (min == null && max == null) return null

  if (!currency) {
    const raw = (n: number) => n.toLocaleString('en-IN')
    const body = min != null && max != null && max !== min
      ? `${raw(min)} – ${raw(max)}`
      : raw((min ?? max) as number)
    return `${body} (currency not recorded)`
  }

  if (min != null && max != null && max !== min) return `${short(min, currency)} – ${short(max, currency)}`
  return short((min ?? max) as number, currency)
}
