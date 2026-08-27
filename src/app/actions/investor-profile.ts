'use server'

import { UserFacingError } from '@/lib/action-errors'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/guards'
import { isAlreadyCached, mirrorImage, ImageCacheError } from '@/lib/image-cache'
import type { InvestmentStage, PocEmployment, PocRank } from '@/lib/types'

/**
 * Investor profile: portfolio entries and the POC employment audit.
 *
 * The audit is the part that earns its keep. A fund's preferences change slowly; who works there
 * changes constantly, and a contact list nobody has verified is worse than none — it sends people
 * to email addresses that bounce.
 */

async function requireInternal() {
  return requireRole(['founder', 'admin', 'associate', 'hr'])
}

function revalidate(investorId: string) {
  revalidatePath(`/investors/${investorId}`)
  revalidatePath('/investors')
}

// ── Portfolio ────────────────────────────────────────────────────────────────

export async function addPortfolioEntry(investorId: string, input: {
  company_name: string
  sector_tags?: string[]
  business_type_tags?: string[]
  invested_stage?: InvestmentStage | null
  invested_year?: number | null
  notes?: string | null
}): Promise<void> {
  const { supabase, orgId, userId } = await requireInternal()
  const name = input.company_name.trim()
  if (!name) throw new UserFacingError('A company name is required.')

  // Link to a company we already track when the name matches, so the profile can say "we already
  // have a record on 3 of their portfolio companies". Unmatched names are kept as text — most of
  // these companies are not ours and never will be.
  const { data: match } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', name)
    .maybeSingle()

  const { error } = await supabase.from('investor_portfolio').insert({
    org_id: orgId,
    investor_id: investorId,
    company_name: name,
    company_id: match?.id ?? null,
    sector_tags: input.sector_tags ?? [],
    business_type_tags: input.business_type_tags ?? [],
    invested_stage: input.invested_stage ?? null,
    invested_year: input.invested_year ?? null,
    notes: input.notes?.trim() || null,
    created_by: userId,
  })
  if (error) {
    if ((error as any).code === '23505') throw new UserFacingError(`${name} is already on this portfolio.`)
    throw error
  }
  revalidate(investorId)
}

export async function updatePortfolioEntry(entryId: string, input: {
  sector_tags?: string[]
  business_type_tags?: string[]
  invested_stage?: InvestmentStage | null
  invested_year?: number | null
  notes?: string | null
}): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_portfolio')
    .update({
      sector_tags: input.sector_tags,
      business_type_tags: input.business_type_tags,
      invested_stage: input.invested_stage ?? null,
      invested_year: input.invested_year ?? null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', entryId)
    .select('investor_id')
  if (error) throw error
  if (data?.[0]) revalidate(data[0].investor_id as string)
}

export async function deletePortfolioEntry(entryId: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_portfolio').delete().eq('id', entryId).select('investor_id')
  if (error) throw error
  if (data?.[0]) revalidate(data[0].investor_id as string)
}

// ── POC audit ────────────────────────────────────────────────────────────────

/**
 * Record the outcome of checking whether a POC still works there.
 *
 * Stamps last_verified_at, because "active" with no date is a claim with no evidence — and the
 * whole point of the audit is knowing how stale the answer is.
 */
export async function setContactEmployment(contactId: string, input: {
  employment_status: PocEmployment
  new_company?: string | null
  new_designation?: string | null
  audit_note?: string | null
}): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_contacts')
    .update({
      employment_status: input.employment_status,
      // Where they went only makes sense for someone who left; clearing it avoids a stale
      // "now at X" sitting under a contact who never moved.
      new_company: input.employment_status === 'moved_on' ? (input.new_company?.trim() || null) : null,
      new_designation: input.employment_status === 'moved_on' ? (input.new_designation?.trim() || null) : null,
      audit_note: input.audit_note?.trim() || null,
      last_verified_at: input.employment_status === 'unknown' ? null : new Date().toISOString(),
    })
    .eq('id', contactId)
    .select('investor_id')
  if (error) throw error
  if (data?.[0]) revalidate(data[0].investor_id as string)
}

/**
 * Promote a contact to primary or secondary.
 *
 * A partial unique index allows only one primary per investor, so promoting one must demote the
 * incumbent first — otherwise the write fails with a constraint error the user cannot act on.
 */
export async function setContactRank(contactId: string, rank: PocRank): Promise<void> {
  const { supabase } = await requireInternal()

  const { data: contact, error: cErr } = await supabase
    .from('investor_contacts').select('investor_id').eq('id', contactId).single()
  if (cErr) throw cErr

  if (rank === 'primary') {
    await supabase
      .from('investor_contacts')
      .update({ rank: 'other' })
      .eq('investor_id', contact.investor_id)
      .eq('rank', 'primary')
      .neq('id', contactId)
  }

  const { error } = await supabase.from('investor_contacts').update({ rank }).eq('id', contactId)
  if (error) throw error
  revalidate(contact.investor_id as string)
}

/** Who from our team spoke to them, and how. */
export async function setContactOutreach(contactId: string, input: {
  contacted_by_user_id?: string | null
  contacted_by_name?: string | null
  contact_method?: string | null
}): Promise<void> {
  const { supabase } = await requireInternal()
  const { data, error } = await supabase
    .from('investor_contacts')
    .update({
      contacted_by_user_id: input.contacted_by_user_id || null,
      contacted_by_name: input.contacted_by_name?.trim() || null,
      contact_method: input.contact_method?.trim() || null,
    })
    .eq('id', contactId)
    .select('investor_id')
  if (error) throw error
  if (data?.[0]) revalidate(data[0].investor_id as string)
}

// ── Finding a new POC ────────────────────────────────────────────────────────

/**
 * Put someone on finding a new contact at this fund.
 *
 * Creates a real Task on the existing board rather than a private to-do: the assignee already
 * lives there, so it drives their alerts and shows up in their week. The alerts bell is fed by
 * tasks assigned to you, which means this is the notification too.
 */
export async function assignPocSearch(
  investorId: string,
  assigneeId: string,
  note?: string | null,
): Promise<void> {
  const { supabase, orgId, userId } = await requireInternal()
  if (!assigneeId) throw new UserFacingError('Choose who is looking.')

  const { data: inv, error: iErr } = await supabase
    .from('investors')
    .select('id, name, website, poc_search_task_id, contacts:investor_contacts(name, new_company, employment_status)')
    .eq('id', investorId)
    .single()
  if (iErr) throw iErr

  // Don't stack a second hunt on the same fund; replace any open one.
  if (inv.poc_search_task_id) {
    await supabase.from('tasks').delete().eq('id', inv.poc_search_task_id).eq('status', 'To Do')
  }

  // Who we used to know, and where they went — the most useful lead the assignee has, and the
  // reason those 62 "moved to" records were worth importing.
  const gone = ((inv.contacts ?? []) as any[])
    .filter((c) => c.employment_status === 'moved_on')
    .map((c) => `${c.name}${c.new_company ? ` (now at ${c.new_company})` : ''}`)

  const description = [
    `Find a current point of contact at ${inv.name}.`,
    inv.website ? `Website: ${inv.website}` : null,
    gone.length > 0
      ? `\nWho we knew there, and where they went:\n${gone.map((g) => `• ${g}`).join('\n')}`
      : '\nWe have no contact on record for this fund at all.',
    note?.trim() ? `\nNote: ${note.trim()}` : null,
    `\nAdd them on the fund's page and mark them Still there — the "needs a POC" flag clears itself.`,
  ].filter(Boolean).join('\n')

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .insert({
      title: `Find a new POC — ${inv.name}`,
      description,
      assignee_id: assigneeId,
      assigned_by_id: userId,
      link_url: `/investors/${investorId}`,
      priority: 'Medium',
      status: 'To Do',
      created_by: userId,
      org_id: orgId,
    })
    .select('id')
    .single()
  if (tErr) throw tErr

  await supabase
    .from('investors')
    .update({ poc_search_task_id: task.id, poc_search_started_at: new Date().toISOString() })
    .eq('id', investorId)

  revalidate(investorId)
  revalidatePath('/tasks')
}

/** Call off the hunt — someone found a contact, or the fund is not worth chasing. */
export async function clearPocSearch(investorId: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { data: inv } = await supabase
    .from('investors').select('poc_search_task_id').eq('id', investorId).single()
  if (inv?.poc_search_task_id) {
    await supabase
      .from('tasks')
      .update({ status: 'Done', completed_at: new Date().toISOString() })
      .eq('id', inv.poc_search_task_id)
      .neq('status', 'Done')
  }
  await supabase
    .from('investors')
    .update({ poc_search_task_id: null, poc_search_started_at: null })
    .eq('id', investorId)
  revalidate(investorId)
  revalidatePath('/tasks')
}

/**
 * The fund's notes — its thesis, cheque structure, and anything else in prose.
 *
 * Worth editing in place rather than only arriving via import: this is where the ticket sizes the
 * source never gave a currency for are parked for review, and where thematic matching reads from.
 */
export async function updateInvestorNotes(investorId: string, notes: string): Promise<void> {
  const { supabase } = await requireInternal()
  const { error } = await supabase
    .from('investors')
    .update({ notes: notes.trim() || null })
    .eq('id', investorId)
  if (error) throw error
  revalidate(investorId)
}

/**
 * Set (or clear) an investor's logo.
 *
 * The pasted URL is mirrored into our own bucket rather than hotlinked, because social CDNs serve
 * signed URLs that expire — a logo that works when you paste it and 404s a month later is worse
 * than none, since nobody notices it went.
 *
 * A mirror failure is not fatal to the save. The source may be behind Cloudflare or simply slow,
 * and refusing the whole edit for that would be the wrong trade — but the error is surfaced rather
 * than swallowed, so nobody thinks a broken logo saved fine.
 */
export async function setInvestorLogo(investorId: string, url: string): Promise<{ error?: string }> {
  const { supabase } = await requireInternal()
  const raw = url.trim()

  if (!raw) {
    const { error } = await supabase.from('investors').update({ logo_url: null }).eq('id', investorId)
    if (error) throw error
    revalidate(investorId)
    return {}
  }

  let stored = raw
  // Already ours: re-mirroring would just copy our own bucket onto itself.
  if (!isAlreadyCached(raw)) {
    try {
      stored = (await mirrorImage(supabase, raw, 'cached-images', `investors/${investorId}/logo`)).publicUrl
    } catch (err) {
      // Returned, not thrown. Next.js redacts the message of an error thrown out of a Server
      // Action in a production build -- the caller receives "An error occurred in the Server
      // Components render", which is exactly what somebody pasting a logo URL saw instead of
      // "unsupported image type". A returned value is data and survives the boundary intact.
      if (err instanceof ImageCacheError) {
        return { error: `That image could not be used — ${err.message}` }
      }
      throw err
    }
  }

  const { error } = await supabase.from('investors').update({ logo_url: stored }).eq('id', investorId)
  if (error) throw error
  revalidate(investorId)
  return {}
}
