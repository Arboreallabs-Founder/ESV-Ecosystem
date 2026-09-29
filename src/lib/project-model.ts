/* Projects — the shape of a prefunding engagement (20261014000000). Client-safe: no server imports,
   so the list, the project page and the public /pr/ page all read the same definitions. */

export const PROJECT_STAGES = ['lead', 'first_call', 'proposal', 'data', 'advance', 'work', 'handover', 'completed'] as const
export type ProjectStageOnPath = typeof PROJECT_STAGES[number]
export type ProjectStage = ProjectStageOnPath | 'dormant'

export const STAGE_META: Record<ProjectStage, { label: string; short: string; hint: string }> = {
  lead:       { label: 'Lead',        short: 'Lead',     hint: 'Set up the first level call.' },
  first_call: { label: 'First call',  short: 'Call',     hint: 'Hold the call and note which services they want.' },
  proposal:   { label: 'Proposal',    short: 'Proposal', hint: 'Build the services cart, send the proposal, record the answer.' },
  data:       { label: 'Data',        short: 'Data',     hint: 'Gather everything on the checklist and set up the Drive folder.' },
  advance:    { label: 'Advance',     short: 'Advance',  hint: 'Work starts once the 50% advance is received.' },
  work:       { label: 'In progress', short: 'Work',     hint: 'Each service moves through its drafts.' },
  handover:   { label: 'Handover',    short: 'Handover', hint: 'Walk them through it. Up to two changes after handover.' },
  completed:  { label: 'Completed',   short: 'Done',     hint: 'Closed out.' },
  dormant:    { label: 'Dormant',     short: 'Dormant',  hint: 'The proposal was declined. Revive it if they come back.' },
}

export const SERVICES = ['pitch_deck', 'projections', 'valuation', 'market_research', 'dataroom', 'custom'] as const
export type ProjectService = typeof SERVICES[number]

export const SERVICE_META: Record<ProjectService, { label: string; team: 'design' | 'finance' | 'lead' }> = {
  pitch_deck:      { label: 'Pitch deck',            team: 'design' },
  projections:     { label: 'Financial projections', team: 'finance' },
  valuation:       { label: 'Valuation report',      team: 'finance' },
  market_research: { label: 'Market research',       team: 'lead' },
  dataroom:        { label: 'Dataroom',              team: 'lead' },
  custom:          { label: 'Custom engagement',     team: 'lead' },
}

export type TrackStep =
  | 'not_started' | 'draft_1' | 'draft_2'
  | 'model_built' | 'with_valuer' | 'valuer_approved' | 'draft_report' | 'client_approved'
  | 'final'

/** Two drafts before the final for everything except valuation, which goes through the registered
    valuer and the client's sign-off on a draft report before the signed version. */
const DRAFT_TRACK: Array<{ step: TrackStep; label: string }> = [
  { step: 'not_started', label: 'Not started' },
  { step: 'draft_1', label: 'Draft 1 shared' },
  { step: 'draft_2', label: 'Draft 2 shared' },
  { step: 'final', label: 'Final handed over' },
]
const VALUATION_TRACK: Array<{ step: TrackStep; label: string }> = [
  { step: 'not_started', label: 'Not started' },
  { step: 'model_built', label: 'Model built' },
  { step: 'with_valuer', label: 'With the valuer' },
  { step: 'valuer_approved', label: 'Valuer approved' },
  { step: 'draft_report', label: 'Draft report shared' },
  { step: 'client_approved', label: 'Client approved' },
  { step: 'final', label: 'Signed report + deck sent' },
]

export function trackFor(service: ProjectService) {
  return service === 'valuation' ? VALUATION_TRACK : DRAFT_TRACK
}

/** What the "move on" button says for the step a track is at. */
export function nextStepAction(service: ProjectService, step: TrackStep): string | null {
  if (service === 'valuation') {
    return ({
      not_started: 'Model built',
      model_built: 'Sent to valuer',
      with_valuer: 'Valuer approved',
      valuer_approved: 'Draft report shared',
      draft_report: 'Client approved',
      client_approved: 'Signed report sent',
    } as Partial<Record<TrackStep, string>>)[step] ?? null
  }
  return ({ not_started: 'Draft 1 shared', draft_1: 'Draft 2 shared', draft_2: 'Final handed over' } as Partial<Record<TrackStep, string>>)[step] ?? null
}

export const MEMBER_ROLES = ['connect', 'lead', 'design', 'finance'] as const
export type ProjectMemberRole = typeof MEMBER_ROLES[number]
export const ROLE_META: Record<ProjectMemberRole, { label: string; hint: string }> = {
  connect: { label: 'Connect', hint: 'Whoever brought the lead in' },
  lead:    { label: 'Project lead', hint: 'Owns the engagement end to end' },
  design:  { label: 'Design team', hint: 'Decks and visual work' },
  finance: { label: 'Finance team', hint: 'Models and valuation' },
}

export const GST_RATE = 0.18

export function serviceLabel(service: ProjectService, label?: string | null): string {
  return label?.trim() || SERVICE_META[service].label
}

/**
 * The data checklist each service starts with, from the Aaiba Design and Grounded Cafe proposals.
 * Wording shared between services is identical on purpose: seeding dedupes by label, so a
 * projections-plus-valuation project asks for the financial statements once.
 */
export const CHECKLIST_TEMPLATES: Record<ProjectService, Array<{ label: string; optional?: boolean }>> = {
  projections: [
    { label: 'Audited or provisional financial statements for the last three years (P&L, Balance Sheet, Cash Flow)' },
    { label: 'Management accounts or trial balance for the current year to date' },
    { label: 'Revenue break-up for the last 24 months (by client, product or channel)' },
    { label: 'Current client or customer list with contract values and renewal dates' },
    { label: 'Manpower roster and hiring plan for the next 24 months' },
    { label: 'Schedule of recurring operating expenses, including software and subscriptions', optional: true },
    { label: 'Fixed asset register with cost and depreciation to date', optional: true },
    { label: 'Outstanding loans, credit facilities and lease obligations', optional: true },
    { label: 'Rent or lease agreements, with escalation terms', optional: true },
    { label: 'Planned capital expenditure and expansion roadmap' },
    { label: 'Current shareholding pattern and cap table' },
    { label: 'Prior fundraise documents, term sheets or valuation reports, if any' },
  ],
  pitch_deck: [
    { label: 'Company profile, product or service catalogue and positioning statement' },
    { label: 'Founder and leadership team profiles' },
    { label: 'Portfolio, case studies or product photography' },
    { label: 'Client logos, with consent to use them' },
    { label: 'Testimonials, awards and press coverage' },
    { label: 'Brand guidelines: logo files, fonts and colours' },
    { label: 'Existing deck, market research or competitor assessments' },
    { label: 'Target raise amount, instrument and use of funds' },
    { label: 'Investors already identified or approached, if any' },
    { label: 'Organisation structure and current team' },
  ],
  valuation: [
    { label: 'Audited or provisional financial statements for the last three years (P&L, Balance Sheet, Cash Flow)' },
    { label: 'Management accounts or trial balance for the current year to date' },
    { label: 'Current shareholding pattern and cap table' },
    { label: 'Certificate of incorporation, MOA and AOA' },
    { label: 'Purpose of the valuation and the valuation date' },
    { label: 'Details of the proposed transaction (instrument, amount, investors)' },
    { label: 'Prior fundraise documents, term sheets or valuation reports, if any' },
  ],
  market_research: [
    { label: 'Target market, geographies and segments to cover' },
    { label: 'The questions the research needs to answer' },
    { label: 'Known competitors and benchmarks' },
    { label: 'Any internal research or industry reports already held' },
  ],
  dataroom: [
    { label: 'Incorporation documents (COI, MOA, AOA, PAN, GST)' },
    { label: 'Audited or provisional financial statements for the last three years (P&L, Balance Sheet, Cash Flow)' },
    { label: 'Tax filings and statutory registers' },
    { label: 'Current shareholding pattern and cap table' },
    { label: 'Material contracts (customers, vendors, leases)' },
    { label: 'IP registrations and employment agreements' },
    { label: 'Board and shareholder resolutions' },
  ],
  custom: [],
}

export type ProjectMember = {
  id: string
  user_id: string
  role: ProjectMemberRole
  name: string | null
  email: string | null
  photo_url: string | null
}

export type ProjectServiceRow = {
  id: string
  service: ProjectService
  label: string | null
  price_inr: number | null
  position: number
  step: TrackStep
  step_changed_at: string
}

export type ProjectChecklistItem = {
  id: string
  service: ProjectService | null
  label: string
  optional: boolean
  status: 'pending' | 'received' | 'na'
  position: number
}

export type ProjectEvent = {
  id: string
  kind: 'stage' | 'step' | 'payment' | 'change' | 'note'
  body: string
  created_at: string
  author: { name: string | null; photo_url: string | null } | null
}

export type ProjectTask = {
  id: string
  title: string
  status: string
  due_date: string | null
  assignee: { name: string | null; photo_url: string | null } | null
}

export type ProjectSummary = {
  id: string
  name: string
  stage: ProjectStage
  stage_changed_at: string
  created_at: string
  company: { id: string; name: string; logo_url: string | null } | null
  partner: { id: string; name: string } | null
  members: ProjectMember[]
  services: ProjectServiceRow[]
  checklist_total: number
  checklist_done: number
}

export type ProjectDetail = ProjectSummary & {
  first_call_at: string | null
  proposal_url: string | null
  proposal_sent_at: string | null
  proposal_decided_at: string | null
  rejection_reason: string | null
  drive_url: string | null
  work_started_at: string | null
  advance_received_at: string | null
  advance_amount_inr: number | null
  balance_received_at: string | null
  balance_amount_inr: number | null
  changes_used: number
  share_token: string
  notes: string | null
  checklist: ProjectChecklistItem[]
  events: ProjectEvent[]
  tasks: ProjectTask[]
}

/** Totals for the cart: ex-GST, GST, and the 50% advance (with GST). */
export function cartTotals(services: Array<{ price_inr: number | null }>) {
  const net = services.reduce((sum, s) => sum + (s.price_inr ?? 0), 0)
  const gst = Math.round(net * GST_RATE)
  return { net, gst, gross: net + gst, advanceNet: Math.round(net / 2), advanceGross: Math.round((net + gst) / 2), unpriced: services.filter((s) => s.price_inr == null).length }
}

export function formatInr(n: number | null | undefined): string {
  if (n == null) return '—'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

/** Where on the main path a project is — dormant sits where it stopped (proposal). */
export function stageIndex(stage: ProjectStage): number {
  if (stage === 'dormant') return PROJECT_STAGES.indexOf('proposal')
  return PROJECT_STAGES.indexOf(stage)
}
