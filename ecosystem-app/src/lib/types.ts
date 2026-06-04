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

export type Investor = {
  id: string
  fund_name: string
  contact_name: string
  contact_email: string
  thesis: string | null
  stage_pref: string | null
  cheque_size_min: number | null
  cheque_size_max: number | null
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
  label: string | null
  created_at: string
  creator: { name: string } | null
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
  assigned_to: string | null
  title: string | null
  submitter_name: string | null
  submitter_email: string | null
  submitted_at: string
  form?: { title: string } | null
  link_creator?: { name: string } | null
  assignee?: { name: string } | null
}

export type PipelineEntryAnswer = {
  id: string
  entry_id: string
  node_id: string
  answer_text: string | null
  node?: Pick<FormNode, 'question_text' | 'answer_type'>
}
