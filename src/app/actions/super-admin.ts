'use server'

import { dbFailure } from '@/lib/action-errors'
import { requireSuperAdmin } from '@/lib/guards'
import type { Organization, UserRole } from '@/lib/types'

export type OrgSummary = Organization & { userCount: number; pipelineCount: number }

export type OrgUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

export type OrgApprovedEmail = {
  email: string
  name: string
  role: UserRole
  added_at: string
}

export async function listOrganizations(): Promise<OrgSummary[]> {
  const { supabase } = await requireSuperAdmin()

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: true })
  if (error) throw dbFailure('save that', error)

  if (!orgs || orgs.length === 0) return []

  const orgIds = orgs.map((o: Organization) => o.id)

  const [{ data: userCounts }, { data: pipelineCounts }] = await Promise.all([
    supabase.from('users').select('org_id').in('org_id', orgIds),
    supabase.from('pipelines').select('org_id').in('org_id', orgIds),
  ])

  const userMap: Record<string, number> = {}
  const pipelineMap: Record<string, number> = {}
  for (const u of userCounts ?? []) userMap[u.org_id] = (userMap[u.org_id] ?? 0) + 1
  for (const p of pipelineCounts ?? []) pipelineMap[p.org_id] = (pipelineMap[p.org_id] ?? 0) + 1

  return orgs.map((o: Organization) => ({
    ...o,
    userCount: userMap[o.id] ?? 0,
    pipelineCount: pipelineMap[o.id] ?? 0,
  }))
}

export async function createOrganization(name: string, slug: string): Promise<string> {
  const { supabase, userId } = await requireSuperAdmin()
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name: name.trim(), slug: slug.trim().toLowerCase(), created_by: userId })
    .select('id')
    .single()
  if (error) throw dbFailure('save that', error)
  return data.id as string
}

export async function listOrgUsers(orgId: string): Promise<OrgUser[]> {
  const { supabase } = await requireSuperAdmin()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('org_id', orgId)
    .order('name', { ascending: true })
  if (error) throw dbFailure('save that', error)
  return (data ?? []) as OrgUser[]
}

export async function listOrgApprovedEmails(orgId: string): Promise<OrgApprovedEmail[]> {
  const { supabase } = await requireSuperAdmin()
  const { data, error } = await supabase
    .from('approved_emails')
    .select('email, name, role, added_at')
    .eq('org_id', orgId)
    .order('added_at', { ascending: true })
  if (error) throw dbFailure('save that', error)
  return (data ?? []) as OrgApprovedEmail[]
}

export async function addOrgUser(
  orgId: string,
  email: string,
  name: string,
  role: string,
): Promise<void> {
  const { supabase } = await requireSuperAdmin()
  const { error } = await supabase.from('approved_emails').insert({
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role,
    org_id: orgId,
  })
  if (error) throw dbFailure('save that', error)
}
