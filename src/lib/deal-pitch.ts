import { DEAL_DOCUMENT_KINDS, DEAL_DOCUMENT_LABELS, type ActiveDealDocument } from '@/lib/types'

/**
 * How long the introduction may be.
 *
 * 200 characters because it is read in a chat window, under a heading and above a list of links.
 * Long enough for two real sentences; short enough that nobody scrolls past it, which is the same
 * thing as nobody reading it. Matches the CHECK on companies.share_intro.
 */
export const SHARE_INTRO_MAX = 200

/**
 * The message that goes out on WhatsApp about a deal.
 *
 * One builder, used by the deal card and the deal page, because a pitch that reads differently
 * depending on which screen it was copied from is a pitch nobody trusts. Pure, so it is the thing
 * that gets tested rather than the button.
 */

export type DealPitchInput = {
  companyName: string
  /** What they do, in one line. companies.one_liner. */
  intro?: string | null
  documents: ActiveDealDocument[]
}

/** WhatsApp reads *asterisks* as bold. Nothing else here relies on its formatting. */
const bold = (s: string) => `*${s}*`

export function buildDealPitch({ companyName, intro, documents }: DealPitchInput): string {
  // Only what has actually been shared. This message leaves the app — an "Internal" document is
  // withheld from partners, and a WhatsApp forward is at least as exposed as a partner is.
  const shared = documents.filter((d) => d.visible_to_partners)

  // Grouped in the fixed order rather than by date, so the IM is always first and the reader learns
  // the shape of the message rather than reading it fresh each time.
  const ordered = DEAL_DOCUMENT_KINDS.flatMap((kind) => shared.filter((d) => d.kind === kind))

  const lines: string[] = [
    'Earlyseed Ventures presents this exciting investment opportunity.',
    '',
    intro?.trim() ? `${bold(companyName)} — ${intro.trim()}` : bold(companyName),
  ]

  if (ordered.length > 0) {
    lines.push('', 'To know more, refer to the material below:')
    ordered.forEach((doc, i) => {
      // The label only when it adds something — "1. MIS — MIS" reads like a mistake.
      const kindLabel = DEAL_DOCUMENT_LABELS[doc.kind]
      const name = doc.label?.trim() && doc.label.trim().toLowerCase() !== kindLabel.toLowerCase()
        ? `${kindLabel} (${doc.label.trim()})`
        : kindLabel
      lines.push(`${i + 1}. ${name} — ${doc.url}`)
    })
  }

  lines.push('', 'Terms & conditions apply. Private equity is a high-risk investment.')

  return lines.join('\n')
}

/** Opens WhatsApp with the message already in the box, on desktop and on a phone. */
export function whatsappLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

/** Whether there is anything worth sending yet. */
export function hasShareableDocuments(documents: ActiveDealDocument[]): boolean {
  return documents.some((d) => d.visible_to_partners)
}
