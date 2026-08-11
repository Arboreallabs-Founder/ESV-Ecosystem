/**
 * The client-safe half of Automatic Tasks.
 *
 * Separate from automatic-tasks.ts because that one imports the server Supabase client, and a
 * client component importing *anything by value* from it drags next/headers into the browser
 * bundle. A type import would be erased; a const is not. The typechecker cannot see this — only a
 * production build can — which is why the split is worth keeping obvious.
 */

export type AutomaticTask = {
  id: string
  title: string
  description: string | null
  status: 'To Do' | 'Done'
  priority: 'Low' | 'Medium' | 'High'
  due_date: string | null
  auto_rule: string | null
  fundraise_entry_id: string | null
  assignee_id: string | null
  escalated_at: string | null
  created_at: string
  completed_at: string | null
  assignee?: { name: string | null; photo_url: string | null } | null
  entry?: {
    id: string
    status: string
    investor: { id: string; name: string } | null
    list: { active_deal_id: string } | null
  } | null
  comment_count?: number
}

export const AUTO_RULE_LABELS: Record<string, string> = {
  data_requested: 'Data requested',
  call_request: 'Call requested',
  due_diligence_stalled: 'Diligence stalled',
  deal_sent_no_reply: 'No reply',
}
