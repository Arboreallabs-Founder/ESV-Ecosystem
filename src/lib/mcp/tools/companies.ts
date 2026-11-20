import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { requireRole } from '@/lib/guards'
import { UserFacingError } from '@/lib/action-errors'
import {
  createCompany, updateCompany, findSimilarCompanies, setFieldValue, saveFieldDef, type CompanyPatch,
} from '@/app/actions/companies'
import { fieldValueToJson, formatFieldValue, type CompanyFieldConfig } from '@/lib/company-fields'
import { COMPANY_FIELD_TYPES } from '@/lib/types'
import type { CompanyFieldType, CompanyFounder } from '@/lib/types'
import { INTERNAL, ok, refuse, run, uuid, isoDate, inr, shortText, diff } from './shared'

const STATUSES = ['prospect', 'screening', 'active', 'portfolio', 'passed', 'dead'] as const

/**
 * The editable company fields, with their real column names. Founders and team are deliberately
 * absent from update_company — they're JSON lists, and a partial update must never be able to wipe
 * them; add_founder / update_founder handle founders one at a time.
 */
export const COMPANY_FIELD_SCHEMA = {
  name: shortText(200).min(1),
  legal_name: shortText(200).nullable(),
  website: z.string().url().max(500).nullable(),
  logo_url: z.string().url().max(2000).nullable(),
  one_liner: shortText(300).nullable(),
  share_intro: shortText(200).nullable().describe('Up to 200 characters, used as the introduction when the deal is shared'),
  description: shortText(5000).nullable(),
  hq_city: shortText(100).nullable(),
  hq_country: shortText(100).nullable(),
  founded_date: isoDate.nullable(),
  incorporation_type: shortText(100).nullable(),
  incorporation_no: shortText(100).nullable(),
  sectors: z.array(shortText(60).min(1)).max(20),
  stage: shortText(60).nullable().describe('e.g. Pre-seed, Seed, Series A'),
  business_model: shortText(200).nullable(),
  status: z.enum(STATUSES),
  tags: z.array(shortText(60).min(1)).max(30),
  esv_poc_id: uuid.nullable().describe('ESV point of contact (a user id)'),
  product_description: shortText(5000).nullable(),
  usp: shortText(2000).nullable(),
  tech_stack: shortText(2000).nullable(),
  product_links: z.array(z.string().url().max(500)).max(20),
  arr_inr: inr.nullable(),
  mrr_inr: inr.nullable(),
  customers_count: z.number().int().min(0).max(1e9).nullable(),
  team_size: z.number().int().min(0).max(1e6).nullable(),
  gross_margin_pct: z.number().min(-1000).max(100).nullable(),
  monthly_burn_inr: inr.nullable(),
  runway_months: z.number().min(0).max(600).nullable(),
  ask_inr: inr.nullable().describe('Current raise: round size in ₹'),
  instrument: shortText(60).nullable().describe('e.g. Equity, CCPS, SAFE, Convertible note'),
  pre_money_inr: inr.nullable(),
  post_money_inr: inr.nullable(),
  round_status: shortText(60).nullable(),
  min_ticket_inr: inr.nullable(),
  total_raised_inr: inr.nullable(),
  use_of_funds: shortText(5000).nullable(),
}
export const COMPANY_KEYS = Object.keys(COMPANY_FIELD_SCHEMA) as Array<keyof typeof COMPANY_FIELD_SCHEMA>

const COMPANY_SELECT = `id, ${COMPANY_KEYS.join(', ')}, founders, team, esv_poc:users!esv_poc_id(name), updated_at`

const founderSchema = {
  name: shortText(120).min(1),
  role: shortText(120).nullable().optional(),
  bio: shortText(3000).nullable().optional(),
  ex_affiliations: shortText(500).nullable().optional().describe('e.g. ex-Google, IIT Bombay'),
  linkedin_url: z.string().url().max(500).nullable().optional(),
  photo_url: z.string().url().max(2000).nullable().optional(),
  equity_pct: z.number().min(0).max(100).nullable().optional(),
}
type FounderInput = { [K in keyof typeof founderSchema]?: unknown }

function toFounder(f: FounderInput, base?: CompanyFounder): CompanyFounder {
  const pick = <K extends keyof CompanyFounder>(k: K) => (f[k] !== undefined ? f[k] : base?.[k] ?? null) as CompanyFounder[K]
  return {
    name: pick('name'), role: pick('role'), bio: pick('bio'), ex_affiliations: pick('ex_affiliations'),
    linkedin_url: pick('linkedin_url'), photo_url: pick('photo_url'), equity_pct: pick('equity_pct'),
  }
}

type Supa = Awaited<ReturnType<typeof requireRole>>['supabase']

/** The company as get_company returns it, custom fields included (typed, plus a formatted display). */
export async function readCompany(supabase: Supa, companyId: string) {
  const { data, error } = await supabase.from('companies').select(COMPANY_SELECT).eq('id', companyId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [{ data: defs }, { data: values }] = await Promise.all([
    supabase.from('company_field_defs').select('*').order('position'),
    supabase.from('company_field_values').select('field_def_id, value').eq('company_id', companyId),
  ])
  const custom_fields = ((defs ?? []) as Array<{ id: string; label: string; field_type: CompanyFieldType; config?: CompanyFieldConfig }>).map((d) => {
    const stored = ((values ?? []) as Array<{ field_def_id: string; value: string | null }>).find((v) => v.field_def_id === d.id)?.value ?? null
    return { field_id: d.id, label: d.label, type: d.field_type, value: fieldValueToJson(d.field_type, stored), display: formatFieldValue(d.field_type, d.config, stored) }
  })
  return { ...(data as unknown as Record<string, unknown>), custom_fields }
}

export function registerCompanyTools(server: McpServer) {
  server.registerTool('search_companies', {
    title: 'Search companies',
    description: 'Finds companies in the Ecosystem database by name. Returns ids for get_company.',
    inputSchema: {
      query: z.string().trim().min(1).max(200),
      limit: z.number().int().min(1).max(50).default(20),
    },
    annotations: { readOnlyHint: true },
  }, run('search_companies', async ({ query, limit }: { query: string; limit: number }) => {
    const { supabase } = await requireRole(INTERNAL)
    // Escape the LIKE wildcards so a search for "100%" means the text, not "100 then anything".
    const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, one_liner, status, stage, sectors, hq_city')
      .or(`name.ilike.${JSON.stringify(pattern)},legal_name.ilike.${JSON.stringify(pattern)}`)
      .order('name')
      .limit(limit)
    if (error) throw error
    return ok(data ?? [])
  }))

  server.registerTool('get_company', {
    title: 'Get a company profile',
    description: 'The full profile of one company: overview, product, traction, current raise, founders, team and custom fields.',
    inputSchema: { company_id: uuid },
    annotations: { readOnlyHint: true },
  }, run('get_company', async ({ company_id }: { company_id: string }) => {
    const { supabase } = await requireRole(INTERNAL)
    const company = await readCompany(supabase, company_id)
    return company ? ok(company) : refuse('No company with that id that you can see.')
  }))

  server.registerTool('create_company', {
    title: 'Create a company',
    description: 'Creates a company profile. First checks for similar names and returns them instead of creating, unless force=true. Amounts in ₹.',
    inputSchema: {
      ...Object.fromEntries(COMPANY_KEYS.filter((k) => k !== 'name').map((k) => [k, COMPANY_FIELD_SCHEMA[k].optional()])),
      name: COMPANY_FIELD_SCHEMA.name,
      founders: z.array(z.object(founderSchema)).max(20).optional(),
      force: z.boolean().default(false).describe('Create even if similar companies exist'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('create_company', async (args: Record<string, unknown> & { name: string; force: boolean; founders?: FounderInput[] }) => {
    const { supabase } = await requireRole(['founder', 'admin', 'associate'])
    if (!args.force) {
      const similar = await findSimilarCompanies(args.name)
      if (similar.length) {
        return ok({
          created: false,
          message: 'Possible duplicates found. Use one of these company_ids, or call again with force=true if this really is a different company.',
          possible_duplicates: similar,
        })
      }
    }
    const patch: Record<string, unknown> = {}
    for (const k of COMPANY_KEYS) if (args[k] !== undefined) patch[k] = args[k]
    if (args.founders) patch.founders = args.founders.map((f) => toFounder(f))
    const id = await createCompany(patch as CompanyPatch)
    return ok({ created: true, company: await readCompany(supabase, id) })
  }))

  server.registerTool('update_company', {
    title: 'Update a company',
    description: 'Changes only the fields passed (null clears one). Founders are not touched; use add_founder / update_founder. Returns before and after for each change. Amounts in ₹.',
    inputSchema: {
      company_id: uuid,
      ...Object.fromEntries(COMPANY_KEYS.map((k) => [k, COMPANY_FIELD_SCHEMA[k].optional()])),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, run('update_company', async (args: Record<string, unknown> & { company_id: string }) => {
    const { supabase } = await requireRole(['founder', 'admin', 'associate'])
    const passed = COMPANY_KEYS.filter((k) => args[k] !== undefined)
    if (passed.length === 0) return refuse('Pass at least one field to change.')
    const before = await readCompany(supabase, args.company_id)
    if (!before) return refuse('No company with that id that you can see.')
    const patch: Record<string, unknown> = {}
    for (const k of passed) patch[k] = args[k]
    await updateCompany(args.company_id, patch as CompanyPatch)
    const after = await readCompany(supabase, args.company_id)
    return ok({ changed: diff(before, after ?? {}, passed), company: after })
  }))

  server.registerTool('add_founder', {
    title: 'Add a founder',
    description: 'Adds one founder to a company. Existing founders are kept.',
    inputSchema: { company_id: uuid, ...founderSchema },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('add_founder', async (args: FounderInput & { company_id: string }) => {
    const { supabase } = await requireRole(['founder', 'admin', 'associate'])
    const { data } = await supabase.from('companies').select('founders, updated_at').eq('id', args.company_id).maybeSingle()
    if (!data) return refuse('No company with that id that you can see.')
    const current = ((data as { founders: CompanyFounder[] | null }).founders ?? [])
    const name = String(args.name).trim()
    if (current.some((f) => f.name?.trim().toLowerCase() === name.toLowerCase())) {
      return refuse(`${name} is already a founder of this company. Use update_founder to change their details.`)
    }
    await guardedFounderWrite(supabase, args.company_id, (data as { updated_at: string }).updated_at, [...current, toFounder(args)])
    const after = await readCompany(supabase, args.company_id)
    return ok({ founders: (after as { founders?: unknown } | null)?.founders ?? [], company_id: args.company_id })
  }))

  server.registerTool('update_founder', {
    title: 'Update a founder',
    description: 'Changes the fields passed for one founder, picked by founder_index (0-based, from get_company) and confirmed by current_name. Other founders are untouched.',
    inputSchema: {
      company_id: uuid,
      founder_index: z.number().int().min(0).max(50),
      current_name: shortText(120).min(1).describe('The founder’s name as it is now — guards against editing the wrong person'),
      ...Object.fromEntries(Object.entries(founderSchema).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, run('update_founder', async (args: FounderInput & { company_id: string; founder_index: number; current_name: string }) => {
    const { supabase } = await requireRole(['founder', 'admin', 'associate'])
    const { data } = await supabase.from('companies').select('founders, updated_at').eq('id', args.company_id).maybeSingle()
    if (!data) return refuse('No company with that id that you can see.')
    const current = ((data as { founders: CompanyFounder[] | null }).founders ?? [])
    const target = current[args.founder_index]
    if (!target) return refuse(`There is no founder at index ${args.founder_index}; this company has ${current.length}.`)
    if (target.name?.trim().toLowerCase() !== args.current_name.trim().toLowerCase()) {
      return refuse(`Founder ${args.founder_index} is "${target.name}", not "${args.current_name}". Re-read the company and try again.`)
    }
    const updated = toFounder(args, target)
    const next = current.map((f, i) => (i === args.founder_index ? updated : f))
    await guardedFounderWrite(supabase, args.company_id, (data as { updated_at: string }).updated_at, next)
    return ok({ changed: diff(target as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, Object.keys(founderSchema)), founder: updated, founder_index: args.founder_index })
  }))

  // ─── Custom fields ─────────────────────────────────────────────────────────
  server.registerTool('list_company_fields', {
    title: 'List company custom fields',
    description: 'The custom fields defined for company profiles: id, label, type and format (options for dropdowns).',
    annotations: { readOnlyHint: true },
  }, run('list_company_fields', async () => {
    const { supabase } = await requireRole(INTERNAL)
    const { data, error } = await supabase.from('company_field_defs').select('*').order('position')
    if (error) throw error
    return ok(((data ?? []) as Array<Record<string, unknown>>).map((d) => ({ field_id: d.id, label: d.label, type: d.field_type, config: d.config ?? {} })))
  }))

  server.registerTool('set_company_field', {
    title: 'Set a company custom field',
    description: 'Sets one custom field on a company. Value must suit the type: number, ₹ amount, true/false, YYYY-MM-DD, an option (or list of options for multi-select), or null to clear.',
    inputSchema: {
      company_id: uuid,
      field_id: uuid,
      value: z.union([z.string().max(20000), z.number(), z.boolean(), z.array(z.string().max(100)).max(100), z.null()]),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, run('set_company_field', async ({ company_id, field_id, value }: { company_id: string; field_id: string; value: unknown }) => {
    const { supabase } = await requireRole(['founder', 'admin', 'associate'])
    const before = await readCompany(supabase, company_id)
    if (!before) return refuse('No company with that id that you can see.')
    await setFieldValue(company_id, field_id, value)
    const after = await readCompany(supabase, company_id)
    const find = (c: typeof before | null) => (c?.custom_fields ?? []).find((f) => f.field_id === field_id) ?? null
    return ok({ before: find(before), after: find(after) })
  }))

  server.registerTool('create_company_field', {
    title: 'Create a company custom field',
    description: 'Adds a custom field to every company profile (founders/admins only). Types: ' + COMPANY_FIELD_TYPES.join(', ') + '. config: decimals, thousands, unit (rupees|lakh|crore), options (for dropdowns).',
    inputSchema: {
      label: shortText(100).min(1),
      field_type: z.enum(COMPANY_FIELD_TYPES),
      config: z.object({
        decimals: z.number().int().min(0).max(6).optional(),
        thousands: z.boolean().optional(),
        unit: z.enum(['rupees', 'lakh', 'crore']).optional(),
        options: z.array(z.string().max(100)).max(100).optional(),
      }).default({}),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, run('create_company_field', async ({ label, field_type, config }: { label: string; field_type: CompanyFieldType; config: CompanyFieldConfig }) => {
    const { supabase } = await requireRole(['founder', 'admin'])
    const { count } = await supabase.from('company_field_defs').select('id', { count: 'exact', head: true })
    const def = await saveFieldDef({ label, field_type, config, position: count ?? 0 })
    return ok({ field_id: def.id, label: def.label, type: def.field_type, config: def.config ?? {} })
  }))
}

/**
 * Write the founders list only if the company hasn't changed since we read it. Founders are one JSON
 * array with no ids, so a concurrent edit in the UI would otherwise be silently overwritten.
 */
async function guardedFounderWrite(supabase: Supa, companyId: string, readAt: string, founders: CompanyFounder[]) {
  const { data } = await supabase.from('companies').select('updated_at').eq('id', companyId).maybeSingle()
  if ((data as { updated_at?: string } | null)?.updated_at !== readAt) {
    throw new UserFacingError('The company changed while this was being saved. Read it again and retry.')
  }
  await updateCompany(companyId, { founders })
}
