'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createInvestor(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('investors').insert({
    fund_name: formData.get('fund_name') as string,
    contact_name: formData.get('contact_name') as string,
    contact_email: formData.get('contact_email') as string,
    thesis: (formData.get('thesis') as string) || null,
    stage_pref: (formData.get('stage_pref') as string) || null,
    cheque_size_min: formData.get('cheque_size_min') ? Number(formData.get('cheque_size_min')) : null,
    cheque_size_max: formData.get('cheque_size_max') ? Number(formData.get('cheque_size_max')) : null,
  })

  if (error) throw error
  revalidatePath('/investors')
}

export async function addOutreach(dealId: string, investorId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('fund_outreach').upsert({
    deal_id: dealId,
    investor_id: investorId,
    status: 'Sent',
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'deal_id,investor_id' })

  if (error) throw error
  revalidatePath(`/pipeline/${dealId}`)
}

export async function updateOutreachStatus(outreachId: string, status: string, dealId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase.from('fund_outreach').update({
    status,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }).eq('id', outreachId)

  revalidatePath(`/pipeline/${dealId}`)
}
