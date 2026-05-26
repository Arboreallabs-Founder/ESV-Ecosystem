export const DEAL_STAGES = [
  'New Lead',
  'JotForm Received',
  'First Call Scheduled',
  'First Call Done',
  'Analysis in Progress',
  'Second Call / Mandate Sent',
  'Mandate Accepted',
  'Memo Created',
  'Fund Outreach Active',
  'Closed Success',
  'Closed Dead',
] as const

export type DealStage = (typeof DEAL_STAGES)[number]

export const CLOSED_STAGES: DealStage[] = ['Closed Success', 'Closed Dead']

export type Deal = {
  id: string
  company_name: string
  sector: string
  funding_stage: string
  source: string
  founder_name: string | null
  founder_email: string | null
  referring_partner_id: string | null
  assignee_id: string | null
  current_stage: DealStage
  success_fee_pct: number | null
  split_pct: number | null
  created_at: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  assignee_id: string | null
  deal_id: string | null
  due_date: string | null
  priority: 'Low' | 'Medium' | 'High'
  status: 'To Do' | 'In Progress' | 'Done'
  created_by: string | null
  created_at: string
  assignee?: { name: string } | null
  deal?: { company_name: string } | null
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

export type FundOutreach = {
  id: string
  deal_id: string
  investor_id: string
  status: 'Sent' | 'Responded' | 'Passed' | 'Interested'
  updated_by: string | null
  updated_at: string
  investor?: Investor | null
}

export type FranchisePartner = {
  id: string
  name: string
  contact_name: string
  contact_email: string
  agreement_type: string
  fixed_fee: number
  fee_split_pct: number
}

export type UserRow = {
  id: string
  email: string
  role: 'founder' | 'admin' | 'associate' | 'franchise_partner'
  name: string
  franchise_partner_id: string | null
}

export type DealNote = {
  id: string
  deal_id: string
  content: string
  created_by: string | null
  created_at: string
  author: { name: string } | null
}

export type DealDocument = {
  id: string
  deal_id: string
  file_url: string
  file_type: string
  file_name: string
  uploaded_by: string | null
  uploaded_at: string
}

export type StageHistoryEntry = {
  id: string
  deal_id: string
  from_stage: DealStage | null
  to_stage: DealStage
  changed_by: string | null
  changed_at: string
  changer: { name: string } | null
}

export type DashboardStats = {
  activeDeals: number
  inMandate: number
  closedTotal: number
  recentActivity: Array<{
    id: string
    from_stage: string | null
    to_stage: string
    changed_at: string
    deal: { company_name: string } | null
    changer: { name: string } | null
  }>
}
