'use server'

import { UserFacingError, dbFailure } from '@/lib/action-errors'
import { requireRole } from '@/lib/guards'
import { SHARE_INTRO_MAX } from '@/lib/deal-pitch'
import { DEAL_DOCUMENT_KINDS, type DealDocumentKind } from '@/lib/types'

/* The IM / financials / deck / MIS / dataroom links on a deal.
 *
 * Links rather than uploads: the files already live in Drive where they are edited, and copying
 * them here would give us two versions with no way to tell which is current.
 *
 * RLS enforces all of this independently; the guards exist so a refusal arrives as a readable
 * sentence rather than a silent zero-row write. */

async function requireDealEditor() {
  // Associates work the deals. Making them ask someone else to paste a link is how the links stay
  // in WhatsApp, which is the thing this replaces.
  return requireRole(['founder', 'admin', 'associate'])
}

function cleanUrl(raw: string): string {
  const url = raw.trim()
  if (!url) throw new UserFacingError('Paste a link.')
  // Matches the CHECK on the column, so the failure is a sentence here rather than a constraint
  // violation from Postgres.
  if (!/^https?:\/\//i.test(url)) {
    throw new UserFacingError('That does not look like a link — it needs to start with http:// or https://')
  }
  return url
}

export async function addDealDocument(input: {
  activeDealId: string
  kind: DealDocumentKind
  url: string
  label?: string | null
  visibleToPartners?: boolean
}) {
  const ctx = await requireDealEditor()
  if (!DEAL_DOCUMENT_KINDS.includes(input.kind)) throw new UserFacingError('Unknown document type.')

  const { data: me } = await ctx.supabase
    .from('users').select('org_id').eq('id', ctx.userId).maybeSingle()

  const { error } = await ctx.supabase.from('active_deal_documents').insert({
    org_id: (me as { org_id?: string | null } | null)?.org_id,
    active_deal_id: input.activeDealId,
    kind: input.kind,
    url: cleanUrl(input.url),
    label: input.label?.trim() || null,
    visible_to_partners: input.visibleToPartners ?? true,
    created_by: ctx.userId,
  })
  if (error) throw dbFailure('save that', error)
}

/** Share a document with partners, or take it back. */
export async function setDealDocumentPartnerVisibility(documentId: string, visible: boolean) {
  const ctx = await requireDealEditor()
  const { data, error } = await ctx.supabase
    .from('active_deal_documents')
    .update({ visible_to_partners: visible })
    .eq('id', documentId)
    .select('id')
  if (error) throw dbFailure('save that', error)
  // An RLS-filtered update reports success having changed nothing, so the row count is the only
  // honest signal that it landed.
  if (!data || data.length === 0) throw new UserFacingError('That document could not be updated.')
}

export async function deleteDealDocument(documentId: string) {
  const ctx = await requireDealEditor()
  const { data, error } = await ctx.supabase
    .from('active_deal_documents')
    .delete()
    .eq('id', documentId)
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data || data.length === 0) throw new UserFacingError('That document could not be removed.')
}

/**
 * The introduction that goes out with the deal.
 *
 * Lives on the company rather than the deal: the same company can be on two deals, and its pitch
 * does not change between them. Editable from the share dialog because that is where anyone
 * notices it is wrong — a field only reachable from an edit form three clicks away is a field that
 * stays as the one-liner forever.
 */
export async function updateCompanyShareIntro(companyId: string, intro: string) {
  const ctx = await requireDealEditor()
  const text = intro.trim()
  // Checked here as well as by the column, so an over-long paste is a sentence rather than a
  // constraint violation surfacing as a stack trace.
  if (text.length > SHARE_INTRO_MAX) {
    throw new UserFacingError(`That is ${text.length} characters — keep it to ${SHARE_INTRO_MAX} or fewer.`)
  }
  const { data, error } = await ctx.supabase
    .from('companies')
    .update({ share_intro: text || null })
    .eq('id', companyId)
    .select('id')
  if (error) throw dbFailure('save that', error)
  if (!data || data.length === 0) throw new UserFacingError('That company could not be updated.')
}
