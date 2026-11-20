import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { requireRole } from '@/lib/guards'
import { UserFacingError } from '@/lib/action-errors'
import {
  createStandaloneDeal, setActiveDealRaiseShape, setActiveDealValuation, updateDealState,
  updateActiveDealDetails, linkActiveDealToCompany,
} from '@/app/actions/active-deals'
import { addAssignee } from '@/app/actions/pipelines'
import { updateCompany, addUpdate, type CompanyPatch } from '@/app/actions/companies'
import { DEAL_STATES, type DealState } from '@/lib/types'
import { INTERNAL, ok, refuse, run, uuid, inr, shortText, pageArgs, one, diff } from './shared'
import { readEntryFull, resolveCompany } from './pipelines'

type Supa = Awaited<ReturnType<typeof requireRole>>['supabase']

// Kept lean: every embed is another RLS-checked table, and active_deals' policies are heavy. With an
// exact count and the (unused) category field values this hit the 8s statement timeout on staging.
const DEAL_SELECT = `id, pipeline_entry_id, created_at, deal_state, total_raise, external_raised, min_ticket, valuation, valuation_basis, logo_url, visible_to_partners,
  entry:pipeline_entries!inner(id, title, pipeline_id, company_id, submitter_name, submitter_email, pipeline:pipelines(name), stage:pipeline_stages(name), company:companies(id, name), assignees:pipeline_entry_assignees(user_id, user:users(name))),
  categories:active_deal_categories(category:deal_categories(id, name))`

const DEAL_NUMBERS = ['total_raise', 'external_raised', 'min_ticket', 'valuation', 'valuation_basis', 'deal_state'] as const

type DealRow = Record<string, unknown> & { id: string; pipeline_entry_id: string; entry: unknown }

function shapeDeal(d: DealRow) {
  const e = (one(d.entry as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
  return {
    deal_id: d.id,
    name: e.title ?? null,
    state: d.deal_state,
    total_raise: d.total_raise,
    external_raised: d.external_raised,
    min_ticket: d.min_ticket,
    valuation: d.valuation,
    valuation_basis: d.valuation_basis,
    visible_to_partners: d.visible_to_partners,
    created_at: d.created_at,
    company: one(e.company as { id: string; name: string } | null),
    pipeline: { id: e.pipeline_id ?? null, name: one(e.pipeline as { name: string } | null)?.name ?? null },
    stage: one(e.stage as { name: string } | null)?.name ?? null,
    entry_id: d.pipeline_entry_id,
    submitter: { name: e.submitter_name ?? null, email: e.submitter_email ?? null },
    owners: ((e.assignees as Array<{ user_id: string; user: unknown }> | null) ?? []).map((a) => ({ user_id: a.user_id, name: one(a.user as { name: string | null } | null)?.name ?? null })),
    categories: ((d.categories as Array<{ category: unknown }> | null) ?? []).map((c) => one(c.category as { id: string; name: string } | null)).filter(Boolean),
  }
}

async function readDeal(supabase: Supa, dealId: string) {
  const { data, error } = await supabase.from('active_deals').select(DEAL_SELECT).eq('id', dealId).maybeSingle()
  if (error) throw error
  return data ? shapeDeal(data as unknown as DealRow) : null
}

/** "Add them also on companies": the round and valuation are mirrored onto the linked company profile. */
async function mirrorToCompany(companyId: string | null, v: { total_raise?: number | null; min_ticket?: number | null; valuation?: number | null; valuation_basis?: 'pre' | 'post' | null }) {
  if (!companyId) return null
  const patch: CompanyPatch = {}
  if (v.total_raise !== undefined) patch.ask_inr = v.total_raise
  if (v.min_ticket !== undefined) patch.min_ticket_inr = v.min_ticket
  if (v.valuation !== undefined && v.valuation !== null) {
    if (v.valuation_basis === 'post') patch.post_money_inr = v.valuation
    else if (v.valuation_basis === 'pre') patch.pre_money_inr = v.valuation
  }
  if (Object.keys(patch).length === 0) return null
  await updateCompany(companyId, patch)
  return Object.keys(patch)
}

export function registerDealTools(server: McpServer) {
  server.registerTool('list_deals', {
    title: 'List deals',
    description: "Active Deals (accepted startups), newest first. Filter by pipeline, state (active/dormant/closed/archived), owner ('me' allowed) or company. Paginated with limit/offset.",
    inputSchema: {
      pipeline_id: uuid.optional(),
      state: z.enum(DEAL_STATES).optional(),
      owner_id: z.union([uuid, z.literal('me')]).optional(),
      company_id: uuid.optional(),
      ...pageArgs,
    },
    annotations: { readOnlyHint: true },
  }, run('list_deals', async (args: { pipeline_id?: string; state?: DealState; owner_id?: string; company_id?: string; limit: number; offset: number }) => {
    const { supabase, userId } = await requireRole(INTERNAL)
    let q = supabase.from('active_deals').select(DEAL_SELECT).order('created_at', { ascending: false })
    if (args.state) q = q.eq('deal_state', args.state)
    if (args.pipeline_id) q = q.eq('entry.pipeline_id', args.pipeline_id)
    if (args.company_id) q = q.eq('entry.company_id', args.company_id)
    if (args.owner_id) {
      const who = args.owner_id === 'me' ? userId : args.owner_id
      const { data: rows } = await supabase.from('pipeline_entry_assignees').select('entry_id').eq('user_id', who)
      const ids = (rows ?? []).map((r: { entry_id: string }) => r.entry_id)
      if (ids.length === 0) return ok({ offset: args.offset, has_more: false, deals: [] })
      q = q.in('pipeline_entry_id', ids.slice(0, 1000))
    }
    // One extra row says whether there's a next page, without the cost of an exact count.
    const { data, error } = await q.range(args.offset, args.offset + args.limit)
    if (error) throw error
    const rows = (data ?? []) as unknown as DealRow[]
    return ok({ offset: args.offset, has_more: rows.length > args.limit, deals: rows.slice(0, args.limit).map(shapeDeal) })
  }))

  server.registerTool('get_deal', {
    title: 'Get a deal',
    description: 'One Active Deal: round, valuation, state, company, owners and categories, plus its pipeline entry’s stage history and linked tasks.',
    inputSchema: { deal_id: uuid },
    annotations: { readOnlyHint: true },
  }, run('get_deal', async ({ deal_id }: { deal_id: string }) => {
    const { supabase } = await requireRole(INTERNAL)
    const deal = await readDeal(supabase, deal_id)
    if (!deal) return refuse('No deal with that id that you can see.')
    const entry = await readEntryFull(supabase, deal.entry_id)
    return ok({ ...deal, stage_history: entry?.stage_history ?? [], tasks: entry?.tasks ?? [], form_answers: entry?.form_answers ?? [] })
  }))

  server.registerTool('create_deal', {
    title: 'Create a deal',
    description: 'Creates an Active Deal directly (portfolio or off-pipeline), like "New deal" in Active Deals. Link company_id, or give company_name to create one after a duplicate check. Round and valuation are also written to the company. Amounts in ₹. To put a startup through a pipeline instead, use create_pipeline_entry.',
    inputSchema: {
      deal_name: shortText(200).min(1),
      company_id: uuid.optional(),
      company_name: shortText(200).min(1).optional().describe('Create a company with this name (after the duplicate check). Default: deal_name'),
      force: z.boolean().default(false).describe('Create the company even if similar ones exist'),
      submitter_name: shortText(120).optional().describe('Founder or referrer name'),
      submitter_email: z.string().email().max(254).optional(),
      owner_ids: z.array(uuid).max(10).optional().describe('Default: me'),
      state: z.enum(DEAL_STATES).default('active'),
      total_raise: inr.optional().describe('Round size'),
      external_raised: inr.optional().describe('Of the round, already committed by others'),
      min_ticket: inr.optional(),
      valuation: inr.optional(),
      valuation_basis: z.enum(['pre', 'post']).optional(),
      notes: shortText(5000).optional().describe('Saved to the company’s updates feed'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('create_deal', async (args: {
    deal_name: string; company_id?: string; company_name?: string; force: boolean; submitter_name?: string; submitter_email?: string
    owner_ids?: string[]; state: DealState; total_raise?: number; external_raised?: number; min_ticket?: number
    valuation?: number; valuation_basis?: 'pre' | 'post'; notes?: string
  }) => {
    const { supabase, userId, role } = await requireRole(['founder', 'admin', 'associate'])
    const owners = Array.from(new Set(args.owner_ids?.length ? args.owner_ids : [userId]))
    if (role === 'associate' && owners.some((o) => o !== userId)) return refuse('Associates can assign only themselves.')
    if (args.total_raise != null && args.external_raised != null && args.external_raised > args.total_raise) {
      return refuse('external_raised is larger than total_raise.')
    }

    const company = await resolveCompany({ company_id: args.company_id, company_name: args.company_name ?? (args.company_id ? undefined : args.deal_name), force: args.force })
    if ('result' in company) return company.result

    const dealId = await createStandaloneDeal({
      deal_name: args.deal_name, company_id: company.companyId,
      submitter_name: args.submitter_name ?? null, submitter_email: args.submitter_email ?? null,
    })
    const deal = await readDeal(supabase, dealId)
    if (!deal) throw new UserFacingError('The deal was created but could not be read back.')
    for (const o of owners) await addAssignee(deal.entry_id, o)
    if (args.total_raise !== undefined || args.external_raised !== undefined || args.min_ticket !== undefined) {
      await setActiveDealRaiseShape(dealId, { total_raise: args.total_raise ?? null, external_raised: args.external_raised ?? null, min_ticket: args.min_ticket ?? null })
    }
    if (args.valuation !== undefined) await setActiveDealValuation(dealId, { valuation: args.valuation, valuation_basis: args.valuation_basis ?? null })
    if (args.state !== 'active') await updateDealState(dealId, args.state)
    const mirrored = await mirrorToCompany(company.companyId, args)
    if (args.notes && company.companyId) await addUpdate(company.companyId, args.notes)

    return ok({ created: true, deal: await readDeal(supabase, dealId), also_set_on_company: mirrored ?? [] })
  }))

  server.registerTool('update_deal', {
    title: 'Update a deal',
    description: 'Changes only the fields passed: name, state, round (total_raise, external_raised, min_ticket), valuation and basis, company link, submitter. null clears. Round and valuation are also written to the company. Returns before and after.',
    inputSchema: {
      deal_id: uuid,
      deal_name: shortText(200).min(1).optional(),
      state: z.enum(DEAL_STATES).optional(),
      total_raise: inr.nullable().optional(),
      external_raised: inr.nullable().optional(),
      min_ticket: inr.nullable().optional(),
      valuation: inr.nullable().optional(),
      valuation_basis: z.enum(['pre', 'post']).nullable().optional(),
      company_id: uuid.nullable().optional(),
      submitter_name: shortText(120).nullable().optional(),
      submitter_email: z.string().email().max(254).nullable().optional(),
      notes: shortText(5000).optional().describe('Saved to the company’s updates feed'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, run('update_deal', async (args: {
    deal_id: string; deal_name?: string; state?: DealState; total_raise?: number | null; external_raised?: number | null; min_ticket?: number | null
    valuation?: number | null; valuation_basis?: 'pre' | 'post' | null; company_id?: string | null
    submitter_name?: string | null; submitter_email?: string | null; notes?: string
  }) => {
    const { supabase } = await requireRole(['founder', 'admin', 'associate'])
    const before = await readDeal(supabase, args.deal_id)
    if (!before) return refuse('No deal with that id that you can see.')
    const touched = Object.keys(args).filter((k) => k !== 'deal_id' && (args as Record<string, unknown>)[k] !== undefined)
    if (touched.length === 0) return refuse('Pass at least one field to change.')

    if (args.deal_name !== undefined || args.submitter_name !== undefined || args.submitter_email !== undefined) {
      // updateActiveDealDetails rewrites name and submitter together; keep what wasn't passed.
      await updateActiveDealDetails(args.deal_id, {
        deal_name: args.deal_name ?? (before.name as string) ?? '',
        submitter_name: args.submitter_name !== undefined ? args.submitter_name : before.submitter.name as string | null,
        submitter_email: args.submitter_email !== undefined ? args.submitter_email : before.submitter.email as string | null,
      })
    }
    if (args.total_raise !== undefined || args.external_raised !== undefined || args.min_ticket !== undefined) {
      // The action takes all three (so a clear is distinguishable from "not passed"); merge.
      await setActiveDealRaiseShape(args.deal_id, {
        total_raise: args.total_raise !== undefined ? args.total_raise : before.total_raise as number | null,
        external_raised: args.external_raised !== undefined ? args.external_raised : before.external_raised as number | null,
        min_ticket: args.min_ticket !== undefined ? args.min_ticket : before.min_ticket as number | null,
      })
    }
    if (args.valuation !== undefined || args.valuation_basis !== undefined) {
      await setActiveDealValuation(args.deal_id, {
        valuation: args.valuation !== undefined ? args.valuation : before.valuation as number | null,
        valuation_basis: args.valuation_basis !== undefined ? args.valuation_basis : before.valuation_basis as 'pre' | 'post' | null,
      })
    }
    if (args.state !== undefined && args.state !== before.state) await updateDealState(args.deal_id, args.state)
    if (args.company_id !== undefined) await linkActiveDealToCompany(args.deal_id, args.company_id)

    const after = await readDeal(supabase, args.deal_id)
    const companyId = after?.company?.id ?? null
    const mirrored = await mirrorToCompany(companyId, {
      total_raise: args.total_raise, min_ticket: args.min_ticket,
      valuation: args.valuation !== undefined ? args.valuation : undefined,
      valuation_basis: (after?.valuation_basis as 'pre' | 'post' | null) ?? null,
    })
    if (args.notes) {
      if (companyId) await addUpdate(companyId, args.notes)
      else return ok({ changed: diff(flat(before), flat(after), [...DEAL_NUMBERS, 'name', 'company']), deal: after, note_saved: 'not saved: the deal has no linked company' })
    }
    return ok({ changed: diff(flat(before), flat(after), [...DEAL_NUMBERS, 'name', 'company', 'submitter']), deal: after, also_set_on_company: mirrored ?? [] })
  }))
}

function flat(d: ReturnType<typeof shapeDeal> | null): Record<string, unknown> {
  if (!d) return {}
  return { ...d, deal_state: d.state }
}
