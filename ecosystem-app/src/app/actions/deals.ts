'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DealStage } from '@/lib/types'

export async function createDeal(formData: FormData, force = false): Promise<{ duplicate: boolean } | void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const companyName = (formData.get('company_name') as string).trim()

  // Duplicate detection
  if (!force) {
    const { count } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .ilike('company_name', companyName)
    if ((count ?? 0) > 0) return { duplicate: true }
  }

  const { data: deal, error } = await supabase
    .from('deals')
    .insert({
      company_name: companyName,
      sector: formData.get('sector') as string,
      funding_stage: formData.get('funding_stage') as string,
      source: formData.get('source') as string,
      founder_name: (formData.get('founder_name') as string) || null,
      founder_email: (formData.get('founder_email') as string) || null,
      assignee_id: user.id,
      current_stage: 'New Lead',
    })
    .select()
    .single()

  if (error) throw error

  await supabase.from('deal_stage_history').insert({
    deal_id: deal.id,
    from_stage: null,
    to_stage: 'New Lead',
    changed_by: user.id,
  })
  // No revalidatePath — router.refresh() in KanbanBoard.handleModalClose handles the UI.
}

export async function moveDeal(dealId: string, toStage: DealStage, fromStage: DealStage) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase.from('deals').update({ current_stage: toStage }).eq('id', dealId)

  await supabase.from('deal_stage_history').insert({
    deal_id: dealId,
    from_stage: fromStage,
    to_stage: toStage,
    changed_by: user.id,
  })

  revalidatePath('/pipeline')
  revalidatePath(`/pipeline/${dealId}`)
  revalidatePath('/dashboard')
}

export async function addNote(dealId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase.from('deal_notes').insert({
    deal_id: dealId,
    content,
    created_by: user.id,
  })
  // No revalidatePath — router.refresh() in DealDetailClient handles the UI.
}

export async function submitPartnerDeal(formData: FormData, franchisePartnerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: deal, error } = await supabase
    .from('deals')
    .insert({
      company_name: formData.get('company_name') as string,
      sector: formData.get('sector') as string,
      funding_stage: formData.get('funding_stage') as string,
      source: 'Franchise Partner',
      referring_partner_id: franchisePartnerId,
      current_stage: 'New Lead',
    })
    .select()
    .single()

  if (error) throw error

  await supabase.from('deal_stage_history').insert({
    deal_id: deal.id,
    from_stage: null,
    to_stage: 'New Lead',
    changed_by: user.id,
  })
  // No revalidatePath — router.refresh() in PortalClient handles the UI.
}
