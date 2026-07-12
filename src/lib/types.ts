export type EscalationStatus = 'Open' | 'Acknowledged' | 'Resolved'

export type EscalationLinkedType = 'active_deal' | 'pipeline_entry' | 'task' | 'investor'

export type Escalation = {
  id: string
  org_id: string
  raised_by: string
  recipient_user_id: string
  subject: string
  body: string | null
  status: EscalationStatus
  linked_type: EscalationLinkedType | null
  linked_id: string | null
  linked_title: string | null
  created_at: string
  resolved_at: string | null
  raised_by_user?: { name: string } | null
  recipient_user?: { name: string; role: string } | null
}

export type TaskStatus = 'To Do' | 'Done'

export type Task = {
  id: string
  title: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  priority: 'Low' | 'Medium' | 'High'
  status: TaskStatus
  created_by: string | null
  created_at: string
  completed_at: string | null
  pushed_date: string | null
  pushed_at: string | null
  push_count: number
  assignee?: { name: string } | null
  created_by_user?: { name: string } | null
}

export type ServiceType = 'vc_fund' | 'angel_fund' | 'family_office' | 'angel_investor'

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  vc_fund: 'VC Fund',
  angel_fund: 'Angel Fund',
  family_office: 'Family Office',
  angel_investor: 'Angel Investor',
}

export const LINKEDIN_STATUS_OPTIONS = [
  'Connected', '1st', '2nd', '3rd', 'Pending', 'Not Connected',
] as const
export type LinkedInStatus = typeof LINKEDIN_STATUS_OPTIONS[number]

export type InvestorContact = {
  id: string
  investor_id: string
  name: string
  role: string | null
  linkedin_url: string | null
  linkedin_status: LinkedInStatus | null
  phone: string | null
  email: string | null
  sort_order: number
  created_at: string
}

export type Investor = {
  id: string
  name: string
  country: string | null
  website: string | null
  sectors: string[]
  service_type: ServiceType
  esv_poc_id: string | null
  ticket_size_min: number | null
  ticket_size_max: number | null
  stage: string | null
  referred_by_partner_id: string | null
  created_by: string | null
  created_at: string
  esv_poc?: { name: string } | null
  esv_pocs?: Array<{ id: string; name: string }>
  referred_by_partner?: { name: string } | null
  contacts?: InvestorContact[]
}

export type FranchisePartner = {
  id: string
  name: string
  contact_name: string
  contact_email: string
  agreement_type: string
  transaction_fee_split_pct: number
  success_fee_split_pct: number
  contract_link: string | null
}

export type PartnerShareBase = 'total' | 'referred'

// One row per deal a partner is tied to (returned by get_partner_earnings).
export type PartnerDealEarning = {
  active_deal_id: string
  deal_title: string | null
  accepted_at: string
  org_total_earning: number
  referred_earning: number
  base_type: PartnerShareBase
  split_pct: number
  share_amount: number
  is_sourced: boolean
}

// Privacy-scoped subset shown to a partner on their own earnings page.
export type MyDealEarning = {
  active_deal_id: string
  deal_title: string | null
  accepted_at: string
  split_pct: number
  share_amount: number
}

export type UserRole = 'founder' | 'admin' | 'associate' | 'franchise_partner' | 'super_admin'

export type UserRow = {
  id: string
  email: string
  role: UserRole
  name: string
  franchise_partner_id: string | null
  org_id: string | null  // null only for super_admin
}

export type ApprovedUser = {
  email: string
  name: string
  role: UserRole
  added_at: string
  org_id: string | null
  userId: string | null
  hasLoggedIn: boolean
}

export type Organization = {
  id: string
  name: string
  slug: string
  created_at: string
}

export type PartnerUser = {
  id: string
  email: string
  name: string
  role: 'franchise_partner'
  franchise_partner_id: string | null
  franchise_partners: FranchisePartner | null
}

// ── Forms & Pipelines ─────────────────────────────────────────────────────────

export type Pipeline = {
  id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  stages: PipelineStage[]
  entry_count: number
}

export type StageQuestionFieldType = 'text' | 'numeric' | 'percentage' | 'url'

export type PipelineStageQuestion = {
  id: string
  stage_id: string
  label: string
  field_type: StageQuestionFieldType
  required: boolean
  position: number
}

export type PipelineStage = {
  id: string
  pipeline_id: string
  name: string
  color: string
  position: number
  stage_type: 'lead' | 'accepted' | 'rejected' | 'custom'
  questions?: PipelineStageQuestion[]
}

// Flattened stage-question answer for display in entry & active-deal detail.
export type StageAnswerView = {
  question_id: string
  label: string
  field_type: StageQuestionFieldType
  value: string | null
  stage_id: string
  stage_name: string
}

export type FormNodeOption = {
  id: string
  node_id: string
  label: string
  position: number
}

export type FormNode = {
  id: string
  form_id: string
  type: 'start' | 'end' | 'question'
  subtype: 'success' | 'rejected' | null
  position_x: number
  position_y: number
  question_text: string | null
  answer_type: 'short_text' | 'long_text' | 'mcq' | null
  options?: FormNodeOption[]
}

export type FormEdge = {
  id: string
  form_id: string
  source_node_id: string
  target_node_id: string
  condition_value: string | null
  condition_label: string | null
}

export type FormLinkSummary = {
  id: string
  token: string
  label: string | null
  created_at: string
  creator: { name: string } | null
}

export type PartnerFormLink = {
  id: string
  token: string
  label: string | null
  created_at: string
  form: { id: string; title: string } | null
  pipeline: { name: string } | null
}

export type PipelineEntryStageHistory = {
  id: string
  entry_id: string
  from_stage: { name: string } | null
  to_stage: { name: string } | null
  moved_by: string | null
  moved_at: string
}

export type Form = {
  id: string
  title: string
  description: string | null
  pipeline_id: string | null
  created_by: string | null
  published: boolean
  created_at: string
  pipeline?: { name: string } | null
  links?: FormLinkSummary[]
}

export type PipelineEntry = {
  id: string
  pipeline_id: string
  form_id: string | null
  form_link_id: string | null
  stage_id: string | null
  rejection_reason: string | null
  title: string | null
  submitter_name: string | null
  submitter_email: string | null
  submitted_at: string
  form?: { title: string } | null
  link_creator?: { name: string } | null
  form_link_label?: string | null
  assignees?: Array<{ user_id: string; name: string }>
  has_active_deal?: boolean
}

// ── Active Deals ──────────────────────────────────────────────────────────────

export type DealCategoryField = {
  id: string
  category_id: string
  label: string
  field_type: 'text' | 'numeric' | 'percentage' | 'url'
  required: boolean
  position: number
}

export type DealCategory = {
  id: string
  name: string
  description: string | null
  color: string
  created_at: string
  fields: DealCategoryField[]
}

export type ActiveDealCategoryData = {
  category: DealCategory
  field_values: Array<{ field_id: string; value: string | null }>
}

export type ActiveDeal = {
  id: string
  pipeline_entry_id: string
  created_at: string
  entry: {
    title: string | null
    submitter_name: string | null
    submitter_email: string | null
    submitted_at: string
    pipeline_id: string
    assignees?: Array<{ user_id: string; name: string }>
    sourced_via_partner?: { id: string; name: string } | null
  }
  categories: ActiveDealCategoryData[]
  field_values?: Array<{ field_id: string; value: string | null }>
}

export type ActiveDealInvestorFee = {
  id: string
  label: string
  rate: number | null
  source_field_id: string | null
  is_enabled: boolean
}

export type ActiveDealInvestor = {
  id: string
  active_deal_id: string
  investor: {
    id: string
    name: string
    service_type: ServiceType
    referred_by_partner_id: string | null
  }
  is_investing: boolean
  investment_amount: number | null
  is_referral: boolean
  fees: ActiveDealInvestorFee[]
  created_at: string
}

// ── Deal Desk ─────────────────────────────────────────────────────────────────

export const DESK_STAGES = ['MVP', 'Pre-Seed', 'Seed', 'Pre-Series A', 'Series A', 'Series A+'] as const
export type DeskStage = typeof DESK_STAGES[number]

export const DESK_VALUATION_TYPES = ['Fixed', 'TBD'] as const
export type DeskValuationType = typeof DESK_VALUATION_TYPES[number]

export const DESK_REVENUE_STATUSES = ['Yes', 'Negligible', 'No'] as const
export type DeskRevenueStatus = typeof DESK_REVENUE_STATUSES[number]

export const DESK_REVENUE_PERIODS = ['Monthly', 'Annual'] as const
export type DeskRevenuePeriod = typeof DESK_REVENUE_PERIODS[number]

export type DeskDealStatus = 'open' | 'rejected' | 'discuss' | 'more_info'

export const DESK_DEAL_STATUS_LABELS: Record<DeskDealStatus, string> = {
  open: 'Open',
  rejected: 'Rejected',
  discuss: 'Discuss in person',
  more_info: 'More info requested',
}

export const DESK_INSTRUMENTS = ['Equity', 'SAFE', 'Convertible', 'Other'] as const
export type DeskInstrument = typeof DESK_INSTRUMENTS[number]

export const DESK_ROUND_STATUSES = ['Open', 'Closing', 'Committed'] as const
export type DeskRoundStatus = typeof DESK_ROUND_STATUSES[number]

export type DeskActionType = 'reject' | 'discuss_in_person' | 'need_more_info'

export const DESK_ACTION_LABELS: Record<DeskActionType, string> = {
  reject: 'Reject',
  discuss_in_person: 'Discuss in person',
  need_more_info: 'Need more info',
}

// Which deal_status an action moves the card into.
export const DESK_ACTION_TO_STATUS: Record<DeskActionType, DeskDealStatus> = {
  reject: 'rejected',
  discuss_in_person: 'discuss',
  need_more_info: 'more_info',
}

export type DeskFounder = {
  name: string
  affiliation: string | null
  bio: string | null
  linkedin_url: string | null
}

export type DeskRevenuePoint = {
  period: string   // e.g. "2026-01"
  amount: number
}

export type DeskDealMedia = {
  id: string
  deal_id: string
  url: string          // storage object path
  signed_url?: string  // resolved for display by the read helper
  sort_order: number
  created_at: string
}

export type DeskDealAction = {
  id: string
  deal_id: string
  action_type: DeskActionType
  comment_text: string | null
  voice_note_url: string | null       // storage object path
  voice_note_signed_url?: string      // resolved for display
  created_by: string
  created_by_user?: { name: string } | null
  created_at: string
}

export type DeskDeal = {
  id: string
  org_id: string
  associate_id: string
  associate?: { name: string } | null
  company_name: string
  sector: string | null
  about: string | null
  location: string | null
  stage: DeskStage | null
  ask_inr: number | null
  valuation_type: DeskValuationType | null
  valuation_inr: number | null
  dilution_percent: number | null
  cap_table_notable_names: string[]
  cap_table_structure_notes: string | null
  revenue_status: DeskRevenueStatus | null
  revenue_period: DeskRevenuePeriod | null
  revenue_data: DeskRevenuePoint[]
  usp: string | null
  founders: DeskFounder[]
  pitch_deck_url: string | null
  notes: string | null
  call_date: string | null
  // Tier-2 enrichment (all optional)
  business_model: string | null
  instrument: DeskInstrument | null
  round_status: DeskRoundStatus | null
  committed_inr: number | null
  total_raised_inr: number | null
  gross_margin_pct: number | null
  monthly_burn_inr: number | null
  runway_months: number | null
  customers_count: number | null
  seen_status: boolean
  starred: boolean
  deal_status: DeskDealStatus
  created_at: string
  updated_at: string
  media: DeskDealMedia[]
  actions: DeskDealAction[]
}

export type DeskAssociateSummary = {
  id: string
  name: string
  unseen_count: number
  seen_count: number
  starred_count: number
}
