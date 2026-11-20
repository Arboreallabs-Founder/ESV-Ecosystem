import { beforeAll, describe, expect, it } from 'vitest'
import { IDS } from './env'
import { tokenFor, callTool, rpc, dbAs } from './mcp-client'

/**
 * Test data accumulates on staging across runs, so creates that aren't testing the duplicate check pass
 * force: true (otherwise last run's 'Brightwater … Analytics' is, correctly, flagged as a duplicate).
 *
 * End to end against STAGING: real sign-in tokens, the real /api/mcp route, real RLS and triggers.
 * Each run uses a unique suffix so runs don't collide with each other's companies.
 */
const RUN = Date.now().toString(36)
let founder: string
let associate: string
let general: string

beforeAll(async () => {
  ;[founder, associate, general] = await Promise.all([tokenFor('founder'), tokenFor('associate'), tokenFor('general')])
})

describe('server', () => {
  it('lists every tool, and no delete tools', async () => {
    const { tools } = await rpc(associate, 'tools/list')
    const names = (tools as Array<{ name: string }>).map((t) => t.name).sort()
    expect(names).toEqual([
      'add_founder', 'add_task_comment', 'create_company', 'create_company_field', 'create_deal', 'create_pipeline_entry',
      'create_task', 'get_company', 'get_deal', 'get_pipeline_entry', 'get_task', 'list_company_fields', 'list_deals',
      'list_my_tasks', 'list_people', 'list_pipeline_entries', 'list_pipelines', 'move_pipeline_entry', 'search_companies',
      'set_company_field', 'team_activity', 'update_company', 'update_deal', 'update_founder', 'update_task',
      'update_task_status', 'whoami',
    ].sort())
    expect(names.some((n) => n.startsWith('delete'))).toBe(false)
  })
})

describe('permissions: a general user is read-only on companies, pipelines and deals', () => {
  it('cannot create or update a company', async () => {
    const r = await callTool(general, 'create_company', { name: `General Co ${RUN}`, force: true })
    expect(r.isError).toBe(true)
    expect(r.text).toMatch(/Forbidden/)
  })
  it('cannot create or move a pipeline entry, or create a deal', async () => {
    expect((await callTool(general, 'create_pipeline_entry', { pipeline_id: IDS.referrals, title: `x ${RUN}` })).isError).toBe(true)
    expect((await callTool(general, 'create_deal', { deal_name: `x ${RUN}`, force: true })).isError).toBe(true)
  })
  it('cannot add company custom fields (associates cannot either)', async () => {
    const r = await callTool(associate, 'create_company_field', { label: `Field ${RUN}`, field_type: 'text' })
    expect(r.isError).toBe(true)
  })
  it('can still read pipelines', async () => {
    const r = await callTool(general, 'list_pipelines')
    expect(r.isError).toBe(false)
    expect(r.json.map((p: { id: string }) => p.id)).toContain(IDS.referrals)
  })
})

describe('companies', () => {
  let companyId: string

  it('creates a company, then flags a near-duplicate instead of creating it', async () => {
    const created = await callTool(associate, 'create_company', { name: `Brightwater ${RUN} Analytics`, stage: 'Seed', ask_inr: 50000000, force: true })
    expect(created.isError).toBe(false)
    expect(created.json.created).toBe(true)
    companyId = created.json.company.id

    const dup = await callTool(associate, 'create_company', { name: `Brightwater ${RUN} Analytics Pvt Ltd` })
    expect(dup.json.created).toBe(false)
    expect(dup.json.possible_duplicates[0].id).toBe(companyId)
  })

  it('updates only the fields passed and reports before/after', async () => {
    await callTool(associate, 'add_founder', { company_id: companyId, name: 'Asha Rao', role: 'CEO' })
    const r = await callTool(associate, 'update_company', { company_id: companyId, ask_inr: 75000000, one_liner: 'Water analytics' })
    expect(r.isError).toBe(false)
    expect(r.json.changed.ask_inr).toEqual({ before: 50000000, after: 75000000 })
    expect(Object.keys(r.json.changed).sort()).toEqual(['ask_inr', 'one_liner'])
    expect(r.json.company.stage).toBe('Seed')
    expect(r.json.company.founders).toHaveLength(1) // untouched by update_company
  })

  it('validates input server-side', async () => {
    const bad = await callTool(associate, 'update_company', { company_id: companyId, ask_inr: -5 })
    expect(bad.isError).toBe(true)
  })

  it('adds and updates founders without losing the others', async () => {
    await callTool(associate, 'add_founder', { company_id: companyId, name: 'Vikram Shah', role: 'CTO' })
    const wrong = await callTool(associate, 'update_founder', { company_id: companyId, founder_index: 0, current_name: 'Vikram Shah', role: 'x' })
    expect(wrong.isError).toBe(true)
    const right = await callTool(associate, 'update_founder', { company_id: companyId, founder_index: 1, current_name: 'Vikram Shah', equity_pct: 22.5 })
    expect(right.isError).toBe(false)
    const company = await callTool(associate, 'get_company', { company_id: companyId })
    expect(company.json.founders.map((f: { name: string }) => f.name)).toEqual(['Asha Rao', 'Vikram Shah'])
    expect(company.json.founders[1].equity_pct).toBe(22.5)
  })

  it('creates a formatted custom field (founder) and sets it with validation', async () => {
    const field = await callTool(founder, 'create_company_field', { label: `Round size ${RUN}`, field_type: 'currency', config: { unit: 'lakh', decimals: 2 } })
    expect(field.isError).toBe(false)
    const set = await callTool(associate, 'set_company_field', { company_id: companyId, field_id: field.json.field_id, value: '₹25,00,000' })
    expect(set.isError).toBe(false)
    expect(set.json.after).toMatchObject({ value: 2500000, display: '₹25.00 L' })
    const bad = await callTool(associate, 'set_company_field', { company_id: companyId, field_id: field.json.field_id, value: 'lots' })
    expect(bad.isError).toBe(true)
  })

  it('logs connector edits in activity_events, tagged as connector', async () => {
    const db = await dbAs('founder')
    const { data } = await db.from('activity_events').select('source, client, action, entity_type').eq('entity_id', companyId)
    expect(data?.length).toBeGreaterThan(0)
    expect(data?.every((e) => e.source === 'connector')).toBe(true)
    expect(data?.some((e) => e.action === 'created' && e.entity_type === 'company')).toBe(true)
    expect(data?.some((e) => e.client === 'Claude')).toBe(true)
  })
})

describe('pipelines: stage automations fire as on the board', () => {
  let entryId: string

  it('creates an entry in Lead, assigned to me', async () => {
    const r = await callTool(associate, 'create_pipeline_entry', { pipeline_id: IDS.referrals, title: `Startup ${RUN}`, company_name: `Startup ${RUN} Labs`, force: true })
    expect(r.isError).toBe(false)
    entryId = r.json.entry.id
    expect(r.json.entry.stage.name).toBe('Lead')
    expect(r.json.entry.assignees.map((a: { user_id: string }) => a.user_id)).toEqual([IDS.associate])
  })

  it('refuses a stage from another pipeline, Rejected without a reason, and Accepted', async () => {
    const other = await callTool(associate, 'move_pipeline_entry', { entry_id: entryId, stage_id: IDS.stOtherLead })
    expect(other.text).toMatch(/does not belong to this pipeline/)
    const noReason = await callTool(associate, 'move_pipeline_entry', { entry_id: entryId, stage_id: IDS.stRejected })
    expect(noReason.text).toMatch(/needs a reason/)
    const accept = await callTool(associate, 'move_pipeline_entry', { entry_id: entryId, stage_id: IDS.stAccepted })
    expect(accept.text).toMatch(/board/)
  })

  it('moving to Introductory call raises "Schedule Call with Startup" for the assignee', async () => {
    const r = await callTool(associate, 'move_pipeline_entry', { entry_id: entryId, stage_id: IDS.stIntro })
    expect(r.isError).toBe(false)
    expect(r.json.moved.to.name).toBe('Introductory call')
    const raised = r.json.tasks_raised as Array<{ title: string; assignee: string | null }>
    expect(raised.some((t) => /Schedule Call with Startup/.test(t.title))).toBe(true)
    const mine = await callTool(associate, 'list_my_tasks', { status: 'To Do' })
    expect(mine.json.some((t: { title: string }) => t.title.includes(`Startup ${RUN}`) && t.title.includes('Schedule Call'))).toBe(true)
  })

  it('creating an entry straight into Introductory call raises the task too', async () => {
    const r = await callTool(associate, 'create_pipeline_entry', { pipeline_id: IDS.referrals, stage_id: IDS.stIntro, title: `Direct ${RUN}`, company_name: `Direct ${RUN} Robotics`, force: true })
    expect(r.isError).toBe(false)
    expect(r.json.entry.tasks.some((t: { title: string }) => /Schedule Call with Startup/.test(t.title))).toBe(true)
  })

  it('rejects with a reason', async () => {
    const r = await callTool(associate, 'move_pipeline_entry', { entry_id: entryId, stage_id: IDS.stRejected, reason: 'Too early' })
    expect(r.isError).toBe(false)
    expect(r.json.entry.rejection_reason).toBe('Too early')
  })
})

describe('deals', () => {
  let dealId: string

  it('creates a deal, mirrors round and valuation onto the company', async () => {
    const r = await callTool(associate, 'create_deal', {
      deal_name: `DealCo ${RUN}`, company_name: `DealCo ${RUN} Fintech`, force: true, total_raise: 100000000, min_ticket: 2500000,
      valuation: 800000000, valuation_basis: 'pre', notes: 'Strong founders',
    })
    expect(r.isError).toBe(false)
    dealId = r.json.deal.deal_id
    expect(r.json.deal).toMatchObject({ total_raise: 100000000, valuation: 800000000, state: 'active' })
    const company = await callTool(associate, 'get_company', { company_id: r.json.deal.company.id })
    expect(company.json).toMatchObject({ ask_inr: 100000000, min_ticket_inr: 2500000, pre_money_inr: 800000000 })
  })

  it('updates only what was passed', async () => {
    const r = await callTool(associate, 'update_deal', { deal_id: dealId, state: 'dormant', external_raised: 30000000 })
    expect(r.isError).toBe(false)
    expect(r.json.deal).toMatchObject({ state: 'dormant', external_raised: 30000000, total_raise: 100000000 })
    expect(Object.keys(r.json.changed).sort()).toEqual(['deal_state', 'external_raised'])
    expect(r.json.changed.external_raised).toEqual({ before: null, after: 30000000 })
  })

  it('lists and gets the deal', async () => {
    const list = await callTool(associate, 'list_deals', { owner_id: 'me', state: 'dormant' })
    expect(list.json.deals.map((d: { deal_id: string }) => d.deal_id)).toContain(dealId)
    const one = await callTool(associate, 'get_deal', { deal_id: dealId })
    expect(one.json.deal_id).toBe(dealId)
    expect(Array.isArray(one.json.stage_history)).toBe(true)
  })
})

describe('tasks: log finished work in one call', () => {
  it('creates a Done task with completed_at set', async () => {
    const r = await callTool(associate, 'create_task', { title: `Sent deck ${RUN}`, status: 'Done' })
    expect(r.json.created).toMatchObject({ status: 'Done' })
    expect(r.json.created.completed_at).toBeTruthy()
  })
  it('backdates, and refuses future dates', async () => {
    const r = await callTool(associate, 'create_task', { title: `Call notes ${RUN}`, completed_at: '2026-11-02' })
    expect(r.json.created.status).toBe('Done')
    expect(r.json.created.completed_at.slice(0, 10)).toBe('2026-11-02')
    const future = await callTool(associate, 'create_task', { title: `Future ${RUN}`, completed_at: '2999-01-01' })
    expect(future.isError).toBe(true)
    expect(future.text).toMatch(/future/)
  })
  it('update_task changes only the fields passed', async () => {
    const t = await callTool(associate, 'create_task', { title: `Edit me ${RUN}`, priority: 'Low', description: 'keep this' })
    const r = await callTool(associate, 'update_task', { task_id: t.json.created.id, priority: 'High' })
    expect(r.json.changed).toEqual({ priority: { before: 'Low', after: 'High' } })
    expect(r.json.task.description).toBe('keep this')
  })
})

describe('founder: assign tasks and see what people have done and have open', () => {
  let assignedId: string

  it('finds people by name', async () => {
    const r = await callTool(founder, 'list_people', { query: 'associate' })
    expect(r.json.map((p: { id: string }) => p.id)).toContain(IDS.associate)
  })

  it('a founder assigns a task to an associate, who then sees it', async () => {
    const r = await callTool(founder, 'create_task', { assignee_id: IDS.associate, title: `Prepare IC memo ${RUN}`, due_date: '2026-12-01', priority: 'High' })
    expect(r.isError).toBe(false)
    assignedId = r.json.created.id
    const mine = await callTool(associate, 'list_my_tasks', { status: 'To Do' })
    expect(mine.json.map((t: { id: string }) => t.id)).toContain(assignedId)
  })

  it('a founder reassigns it', async () => {
    const r = await callTool(founder, 'update_task', { task_id: assignedId, assignee_id: IDS.general })
    expect(r.isError).toBe(false)
    expect(r.json.changed.assignee_id).toEqual({ before: IDS.associate, after: IDS.general })
    // and back, for the activity checks below
    await callTool(founder, 'update_task', { task_id: assignedId, assignee_id: IDS.associate })
  })

  it('an associate cannot assign to a founder', async () => {
    const r = await callTool(associate, 'create_task', { assignee_id: IDS.founder, title: `Nope ${RUN}` })
    expect(r.isError).toBe(true)
    expect(r.text).toMatch(/assign/i)
  })

  it("a founder sees an associate's week: completed, open, and pipeline moves", async () => {
    const r = await callTool(founder, 'team_activity', { person: 'Test Associate' })
    expect(r.isError).toBe(false)
    expect(r.json.activity_log_included).toBe(true)
    const p = r.json.people[0]
    expect(p.person.id).toBe(IDS.associate)
    expect(p.completed.items.some((t: { title: string }) => t.title === `Sent deck ${RUN}`)).toBe(true)
    // the backdated one (2 Nov) is outside this week
    expect(p.completed.items.some((t: { title: string }) => t.title === `Call notes ${RUN}`)).toBe(false)
    expect(p.open.items.some((t: { id: string }) => t.id === assignedId)).toBe(true)
    expect(p.pipeline_moves.some((m: { entry: string; to: string }) => m.entry === `Startup ${RUN}` && m.to === 'Introductory call')).toBe(true)
    expect(p.created.companies).toBeGreaterThan(0)
  })

  it('a custom range works, and the backdated task appears in it', async () => {
    const r = await callTool(founder, 'team_activity', { person: IDS.associate, from: '2026-11-01', to: '2026-11-07' })
    expect(r.json.people[0].completed.items.some((t: { title: string }) => t.title === `Call notes ${RUN}`)).toBe(true)
  })

  it("a founder can ask about the whole team", async () => {
    const r = await callTool(founder, 'team_activity', { person: 'team' })
    expect(r.json.people.map((p: { person: { id: string } }) => p.person.id)).toEqual(expect.arrayContaining([IDS.founder, IDS.associate, IDS.general]))
  })

  it('an associate sees only themselves, without the activity log', async () => {
    const other = await callTool(associate, 'team_activity', { person: IDS.founder })
    expect(other.isError).toBe(true)
    expect(other.text).toMatch(/only yourself/)
    const team = await callTool(associate, 'team_activity', { person: 'team' })
    expect(team.json.people.map((p: { person: { id: string } }) => p.person.id)).toEqual([IDS.associate])
    expect(team.json.activity_log_included).toBe(false)
    expect(team.json.people[0].pipeline_moves).toEqual([])
  })

  it('a general user cannot look at an associate', async () => {
    const r = await callTool(general, 'team_activity', { person: IDS.associate })
    expect(r.isError).toBe(true)
  })
})