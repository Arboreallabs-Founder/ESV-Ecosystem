import { redirect } from 'next/navigation'
import { getUser } from '@/lib/user'
import { createClient } from '@/lib/supabase/server'
import SubmissionsList from './_components/SubmissionsList'

export type SubmissionEntry = {
  id: string
  title: string | null
  submitted_at: string | null
  stage: { name: string; color: string } | null
  pipeline: { name: string } | null
}

export default async function SubmissionsPage() {
  const user = await getUser()
  if (!user || user.role !== 'franchise_partner') redirect('/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('pipeline_entries')
    .select('id, title, submitted_at, stage:pipeline_stages(name, color), pipeline:pipelines(name)')
    .order('submitted_at', { ascending: false })

  const entries: SubmissionEntry[] = (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    submitted_at: row.submitted_at,
    stage: Array.isArray(row.stage) ? row.stage[0] ?? null : row.stage ?? null,
    pipeline: Array.isArray(row.pipeline) ? row.pipeline[0] ?? null : row.pipeline ?? null,
  }))

  return <SubmissionsList entries={entries} />
}
