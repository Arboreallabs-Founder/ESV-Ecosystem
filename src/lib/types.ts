export type Task = {
  id: string
  title: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  priority: 'Low' | 'Medium' | 'High'
  status: 'To Do' | 'In Progress' | 'Done'
  created_by: string | null
  created_at: string
  assignee?: { name: string } | null
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

export type UserRow = {
  id: string
  email: string
  role: 'founder' | 'admin' | 'associate' | 'franchise_partner'
  name: string
  franchise_partner_id: string | null
}

export type ApprovedUser = {
  email: string
  name: string
  role: 'founder' | 'admin' | 'associate' | 'franchise_partner'
  added_at: string
  userId: string | null
  hasLoggedIn: boolean
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

export type PipelineStage = {
  id: string
  pipeline_id: string
  name: string
  color: string
  position: number
  stage_type: 'lead' | 'accepted' | 'rejected' | 'custom'
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

export type FormLink = {
  id: string
  form_id: string
  created_by: string
  token: string
  label: string | null
  created_at: string
  creator?: { name: string } | null
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
}

export type PipelineEntryAnswer = {
  id: string
  entry_id: string
  node_id: string
  answer_text: string | null
  node?: Pick<FormNode, 'question_text' | 'answer_type'>
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
  }
  categories: ActiveDealCategoryData[]
}
