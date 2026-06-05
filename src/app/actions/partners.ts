'use server'

import { createClient } from '@/lib/supabase/server'

export async function upsertPartnerDetails(userId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: partner, error: insertError } = await supabase
    .from('franchise_partners')
    .insert({
      name: formData.get('name') as string,
      contact_name: formData.get('contact_name') as string,
      contact_email: formData.get('contact_email') as string,
      agreement_type: (formData.get('agreement_type') as string) || 'Standard',
      transaction_fee_split_pct: Number(formData.get('transaction_fee_split_pct')) || 0,
      success_fee_split_pct: Number(formData.get('success_fee_split_pct')) || 0,
      contract_link: (formData.get('contract_link') as string) || null,
    })
    .select('id')
    .single()

  if (insertError) throw insertError

  const { error: linkError } = await supabase
    .from('users')
    .update({ franchise_partner_id: partner.id })
    .eq('id', userId)

  if (linkError) throw linkError
  // router.refresh() in the component handles the UI update
}

export async function updatePartnerDetails(partnerId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('franchise_partners')
    .update({
      name: formData.get('name') as string,
      contact_name: formData.get('contact_name') as string,
      contact_email: formData.get('contact_email') as string,
      agreement_type: (formData.get('agreement_type') as string) || 'Standard',
      transaction_fee_split_pct: Number(formData.get('transaction_fee_split_pct')) || 0,
      success_fee_split_pct: Number(formData.get('success_fee_split_pct')) || 0,
      contract_link: (formData.get('contract_link') as string) || null,
    })
    .eq('id', partnerId)

  if (error) throw error
  // router.refresh() in the component handles the UI update
}
