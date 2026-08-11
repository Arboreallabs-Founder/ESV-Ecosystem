import {
  FUNDRAISE_STATUS_LABELS, isFundraiseGhosted,
  type FundraiseStatus, type FundraiseDisplayStatus,
} from '@/lib/types'

/**
 * Mandate health.
 *
 * Weighted funnel depth, decayed by how long each fund has sat still. Confirmed shape:
 *
 *     per fund   depth score x recency multiplier
 *     health     sum / (funds x 10)  ->  0-100
 *
 * Two things it is deliberately not. It is not a count of funds contacted — twenty untouched funds
 * is a worse mandate than five in diligence, and a raw count says the opposite. And it is not
 * outcome-blind: a rejection is not a failure of the mandate, but it is no longer contributing
 * anything, so it scores zero rather than negative. Punishing rejections would make the honest act
 * of recording one look bad, and that is how a status list stops being true.
 *
 * Pure, and in its own module, so it can be read by a server page and a client component alike
 * without either importing the other's world.
 */

/** How far a fund has got. Ordered, because the funnel is. */
export const HEALTH_DEPTH: Record<FundraiseStatus, number> = {
  not_sent: 0,        // approved and sitting there — contributes nothing
  deal_sent: 1,
  data_requested: 3,  // they asked us for something: the first real signal
  call_request: 4,
  due_diligence: 6,
  accepted: 10,
  rejected: 0,        // an answer, and an honest one. Zero, never negative.
  closed: 0,
}

/** The best a single fund can score, so the total has a denominator. */
const MAX_DEPTH = 10

/**
 * How much a fund still counts, given how long it has been silent.
 *
 * A fund that reached diligence three months ago and has not moved since is not worth as much as
 * one that got there last week, and a health score that cannot tell them apart is the kind that
 * stays green while a raise dies.
 */
export function recencyMultiplier(daysSinceChange: number): number {
  if (daysSinceChange < 14) return 1
  if (daysSinceChange <= 30) return 0.5
  return 0
}

export type HealthInput = {
  status: FundraiseStatus
  status_changed_at: string
}

export type MandateHealth = {
  /** 0-100. Null when there is nothing to score yet. */
  score: number | null
  band: 'landed' | 'strong' | 'steady' | 'early' | 'thin' | 'stalled' | 'empty'
  label: string
  funds: number
  /** Funds still in play — sent, and neither answered nor gone quiet. */
  live: number
  accepted: number
  ghosted: number
  rejected: number
  /** The one sentence worth putting in a weekly update. */
  summary: string
}

const BANDS: Array<{ min: number; band: MandateHealth['band']; label: string }> = [
  { min: 55, band: 'strong', label: 'Strong' },
  { min: 30, band: 'steady', label: 'Steady' },
  { min: 12, band: 'thin', label: 'Thin' },
  { min: 0, band: 'stalled', label: 'Stalled' },
]

export function mandateHealth(entries: HealthInput[]): MandateHealth {
  if (entries.length === 0) {
    return {
      score: null, band: 'empty', label: 'Not started', funds: 0,
      live: 0, accepted: 0, ghosted: 0, rejected: 0,
      summary: 'No funds on the list yet.',
    }
  }

  const now = Date.now()
  let total = 0
  let live = 0
  let accepted = 0
  let ghosted = 0
  let rejected = 0

  for (const e of entries) {
    const days = (now - new Date(e.status_changed_at).getTime()) / 86_400_000
    const isGhost = isFundraiseGhosted(e.status, e.status_changed_at)

    // A ghosted fund scores nothing regardless of how deep it got: the recency multiplier is
    // already zero past 30 days, so this is the same answer said out loud.
    total += HEALTH_DEPTH[e.status] * recencyMultiplier(days)

    if (e.status === 'accepted') accepted++
    else if (e.status === 'rejected') rejected++
    else if (isGhost) ghosted++
    else if (e.status !== 'not_sent' && e.status !== 'closed') live++
  }

  const score = Math.round((total / (entries.length * MAX_DEPTH)) * 100)

  // The raw score alone gives bad advice in two shapes, both of which showed up the moment I put
  // realistic mandates through it.
  //
  //   A raise that has landed reads as "Thin", because accepted funds stop contributing once the
  //   conversation ends — but a mandate with two acceptances and nothing outstanding is finished,
  //   not failing.
  //
  //   Ten funds sent last week reads as "Stalled", because nothing has had time to move yet.
  //   Calling that stalled would have someone chasing on day three.
  const everythingIsRecent = entries.every((e) =>
    (Date.now() - new Date(e.status_changed_at).getTime()) / 86_400_000 < 14)

  let band: { band: MandateHealth['band']; label: string }
  if (accepted > 0 && live === 0) {
    band = { band: 'landed', label: 'Landed' }
  } else if (live > 0 && ghosted === 0 && everythingIsRecent && score < 30) {
    band = { band: 'early', label: 'Early' }
  } else {
    band = BANDS.find((b) => score >= b.min)!
  }

  return {
    score,
    band: band.band,
    label: band.label,
    funds: entries.length,
    live,
    accepted,
    ghosted,
    rejected,
    summary: buildSummary({ score, live, accepted, ghosted, rejected, funds: entries.length }),
  }
}

/**
 * The sentence, not the number.
 *
 * A score on its own invites arguing with the formula. Saying what is actually true of the mandate
 * — how many are live, how many have gone quiet — is what someone can act on.
 */
function buildSummary(s: {
  score: number; live: number; accepted: number; ghosted: number; rejected: number; funds: number
}): string {
  const parts: string[] = []
  if (s.accepted > 0) parts.push(`${s.accepted} accepted`)
  if (s.live > 0) parts.push(`${s.live} in conversation`)
  if (s.ghosted > 0) parts.push(`${s.ghosted} gone quiet`)
  if (s.rejected > 0) parts.push(`${s.rejected} passed`)

  if (parts.length === 0) return `${s.funds} fund${s.funds === 1 ? '' : 's'} approved, none sent yet.`
  return `${parts.join(', ')} of ${s.funds}.`
}

export const HEALTH_COLORS: Record<MandateHealth['band'], string> = {
  landed: '#2E7D32',
  strong: '#2E7D32',
  steady: '#745FFD',
  early: '#8371FD',
  thin: '#D5AE8F',
  stalled: '#C0392B',
  empty: '#A39B95',
}

/** For the tooltip: what each status is worth, so the number can be interrogated. */
export function explainHealth(): string {
  const rows = (Object.keys(HEALTH_DEPTH) as FundraiseStatus[])
    .filter((s) => HEALTH_DEPTH[s] > 0)
    .map((s) => `${FUNDRAISE_STATUS_LABELS[s as FundraiseDisplayStatus]} ${HEALTH_DEPTH[s]}`)
  return `${rows.join(' · ')}. Full weight under 14 days, half to 30, nothing after.`
}
